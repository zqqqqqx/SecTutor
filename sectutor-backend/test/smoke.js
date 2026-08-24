/*
 * smoke.js — 后端 API 冒烟测试（无需 Docker）。
 * 通过 DOCKER_SIMULATE=1 启动仿真模式，用 Node 内置 fetch 验证核心接口契约。
 */
const path = require('path');
process.env.DOCKER_SIMULATE = '1';
const app = require(path.join(__dirname, '..', 'src', 'index.js'));

const PORT = 8799;
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
  const server = app.listen(PORT);
  await new Promise((r) => server.once('listening', r));

  try {
    console.log('health:');
    const h = await fetch(BASE + '/health').then((r) => r.json());
    assert(h.ok && h.simulate === true, 'GET /health 就绪且 simulate=true');

    console.log('创建临时环境（lab_sqli）:');
    const created = await json('POST', '/api/envs', { labId: 'lab_sqli' });
    assert(created.status === 201 && created.data.ok, 'POST /api/envs 返回 201');
    const envId = created.data.env && created.data.env.id;
    assert(!!envId, '返回 env.id');
    assert(
      created.data.env && created.data.env.status === 'running',
      '环境状态为 running'
    );
    assert(
      created.data.env && created.data.env.simulated === true,
      '仿真模式标记'
    );
    assert(
      created.data.env && created.data.env.accessUrl === null,
      '仿真模式下 accessUrl=null（真实模式为后端反向代理地址）'
    );

    console.log('查询单个环境:');
    const got = await json('GET', '/api/envs/' + envId);
    assert(got.status === 200 && got.data.env.id === envId, 'GET /api/envs/:id 命中');

    console.log('列出环境:');
    const list = await json('GET', '/api/envs');
    assert(
      list.status === 200 && list.data.envs.some((e) => e.id === envId),
      'GET /api/envs 包含该环境'
    );

    console.log('反向代理鉴权与降级:');
    const proxyNoAuth = await fetch(BASE + '/api/envs/' + envId + '/proxy/');
    assert(proxyNoAuth.status === 401, '代理缺少 token 返回 401');
    const proxyWithTok = await fetch(BASE + '/api/envs/' + envId + '/proxy/?t=' + TOKEN);
    assert(proxyWithTok.status === 409, '代理仿真环境返回 409（无真实容器可代理）');

    console.log('配额上限:');
    const second = await json('POST', '/api/envs', { labId: 'lab_cmdi' });
    assert(second.status === 201, '再创建一个成功');
    const third = await json('POST', '/api/envs', { labId: 'lab_xss' });
    assert(third.status === 429, '超过每用户上限(2) 返回 429');

    console.log('无规格测试点:');
    const noSpec = await json('POST', '/api/envs', { labId: 'lab_b64' });
    assert(noSpec.status === 400 && noSpec.data.code === 'NO_SPEC', '纯前端演练返回 NO_SPEC');

    console.log('鉴权:');
    const noAuth = await fetch(BASE + '/api/envs', { method: 'GET' });
    assert(noAuth.status === 401, '缺少 token 返回 401');

    console.log('销毁环境:');
    const del = await json('DELETE', '/api/envs/' + envId);
    assert(del.status === 200 && del.data.ok, 'DELETE /api/envs/:id 成功');
    const afterDel = await json('GET', '/api/envs/' + envId);
    assert(afterDel.status === 404, '销毁后查询返回 404（资源已释放）');

    console.log('统计端点:');
    const stats = await json('GET', '/api/stats');
    assert(stats.status === 200 && stats.data.ok && !!stats.data.stats, 'GET /api/stats 返回 200');
    assert(stats.data.stats.maxPerOwner === 2, 'stats.maxPerOwner = 2');
    assert(stats.data.stats.maxConcurrent === 20, 'stats.maxConcurrent = 20');
    assert(typeof stats.data.stats.reclaim === 'object', 'stats.reclaim 存在');
    assert(stats.data.stats.config.quotaBackend === 'memory', 'stats 标注内存配额后端');
    assert(typeof stats.data.stats.audit === 'object' && stats.data.stats.audit.total >= 4, 'stats 含审计摘要（total>=4）');

    console.log('审计事件流与仪表盘:');
    const dash = await fetch(BASE + '/dashboard.html');
    assert(dash.status === 200, 'GET /dashboard.html 200（静态托管仪表盘）');
    const dashBody = await dash.text();
    assert(/SecTutor 审计看板/.test(dashBody), 'dashboard.html 含看板标题');

    const auditResp = await json('GET', '/api/audit?limit=200');
    assert(auditResp.status === 200 && auditResp.data.ok, 'GET /api/audit 返回 200');
    assert(Array.isArray(auditResp.data.events) && auditResp.data.events.length >= 4, `审计事件数 >= 4（实际 ${auditResp.data.events.length}）`);
    const by = auditResp.data.summary.byType;
    assert((by.create || 0) >= 2, `含至少 2 条 create（实际 ${by.create || 0}）`);
    assert((by.create_denied || 0) >= 1, `含至少 1 条 create_denied（实际 ${by.create_denied || 0}）`);
    assert((by.destroy || 0) >= 1, `含至少 1 条 destroy（实际 ${by.destroy || 0}）`);
    assert(auditResp.data.summary.buckets.length === 30, '审计摘要含 30 个时间桶');
  } finally {
    server.close();
  }

  console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
