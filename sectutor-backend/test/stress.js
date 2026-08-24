/*
 * stress.js — P3 压力测试（内存配额并发安全 + 无泄漏）。
 *
 * 在仿真模式（DOCKER_SIMULATE=1）下并发发起大量 POST /api/envs，验证：
 *   1) 全局并发上限（GLOBAL_CAP/503）在「真实 HTTP 并发」下确实生效，而非仅单测里的同步计数；
 *   2) 配额被拒的请求不会污染 registry（无计数/端口泄漏）；
 *   3) 全部创建的环境销毁后，/api/stats.total 回到 0、perOwner 清空；
 *   4) 整个并发过程中无 unhandledRejection（异步链路未吞异常）。
 *
 * 关键设置：把 MAX_CONCURRENT_ENVS 设得很低（5）、MAX_ENVS_PER_OWNER 设得很高（100），
 * 这样所有并发请求共享同一 owner(demo-user)，优先触发全局上限而非每用户上限，从而单独验证 GLOBAL_CAP。
 */
process.env.DOCKER_SIMULATE = '1';
process.env.MAX_ENVS_PER_OWNER = '100'; // 抬高每用户上限，让全局上限先触发
process.env.MAX_CONCURRENT_ENVS = '5'; // 压低全局并发上限，便于构造争用

const path = require('path');
const app = require(path.join(__dirname, '..', 'src', 'index.js'));

const PORT = 8796;
const BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = 'sectutor-dev-token';
const auth = { Authorization: `Bearer ${TOKEN}` };

let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) {
    pass++;
    console.log('  ✓ ' + msg);
  } else {
    fail++;
    console.log('  ✗ ' + msg);
  }
}

async function json(method, url, body) {
  const opts = { method, headers: { ...auth, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(BASE + url, opts);
  let data = null;
  try { data = await r.json(); } catch {}
  return { status: r.status, data };
}

async function main() {
  // 捕获任何未处理的 Promise 拒绝——压力测试最怕异步链路悄悄吞异常
  const unhandled = [];
  process.on('unhandledRejection', (reason) => unhandled.push(reason));

  const server = app.listen(PORT);
  await new Promise((r) => server.once('listening', r));

  try {
    const N = 50;
    console.log(`并发发起 ${N} 个 POST /api/envs（全局上限=5，每用户上限=100）`);
    const t0 = Date.now();
    const results = await Promise.all(
      Array.from({ length: N }, () => json('POST', '/api/envs', { labId: 'lab_sqli' }))
    );
    const elapsed = Date.now() - t0;

    const created = results.filter((r) => r.status === 201 && r.data && r.data.ok);
    const globalCap = results.filter(
      (r) => r.status === 503 && r.data && r.data.code === 'GLOBAL_CAP'
    );
    const stray = results.filter(
      (r) => !(r.status === 201 && r.data && r.data.ok) && !(r.status === 503 && r.data && r.data.code === 'GLOBAL_CAP')
    );

    assert(created.length === 5, `仅 ${created.length} 个创建成功（期望=全局上限 5）`);
    assert(globalCap.length === N - 5, `${globalCap.length} 个被 GLOBAL_CAP/503 拦截`);
    assert(stray.length === 0, `无意外状态码（仅 201 / 503-GLOBAL_CAP），意外 ${stray.length} 个`);
    console.log(`  并发 ${N} 请求总耗时 ${elapsed}ms`);

    // 配额计数与 registry 一致：/api/stats.total 应等于实际创建数
    const stats = await json('GET', '/api/stats');
    assert(stats.status === 200, 'GET /api/stats 200');
    assert(stats.data.stats.total === 5, `/api/stats.total=5（配额与 registry 一致），实际 ${stats.data.stats.total}`);

    // 销毁所有创建的环境（并发删除），回收端口与配额
    let destroyFail = 0;
    await Promise.all(
      created.map((c) =>
        json('DELETE', '/api/envs/' + c.data.env.id).then((r) => {
          if (r.status !== 200) destroyFail++;
        })
      )
    );
    assert(destroyFail === 0, `全部 ${created.length} 个环境销毁成功`);

    // 销毁后 registry/stats 必须完全清空（无端口/计数泄漏）
    const stats2 = await json('GET', '/api/stats');
    assert(stats2.data.stats.total === 0, `销毁后 /api/stats.total=0（无泄漏），实际 ${stats2.data.stats.total}`);
    assert(
      Object.keys(stats2.data.stats.perOwner || {}).length === 0,
      'perOwner 为空（无归属计数残留）'
    );

    // 重复下发：再次并发创建应仍受全局上限约束且可回收（验证配额状态机可重复进入/退出）
    const round2 = await Promise.all(
      Array.from({ length: 10 }, () => json('POST', '/api/envs', { labId: 'lab_cmdi' }))
    );
    const created2 = round2.filter((r) => r.status === 201 && r.data && r.data.ok);
    assert(created2.length === 5, `第二轮并发仍仅 ${created2.length} 个成功（全局上限稳定）`);
    await Promise.all(created2.map((c) => json('DELETE', '/api/envs/' + c.data.env.id)));
    const stats3 = await json('GET', '/api/stats');
    assert(stats3.data.stats.total === 0, '第二轮销毁后 total 再次归零');

    assert(unhandled.length === 0, `全程无 unhandledRejection（实际 ${unhandled.length}）`);
    if (unhandled.length) console.log('   原因样本：', unhandled.slice(0, 3));
  } finally {
    server.close();
  }

  console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
