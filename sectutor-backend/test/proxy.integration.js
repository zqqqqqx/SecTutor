/*
 * proxy.integration.js — 反向代理转发集成测试（安全关键路径）。
 *
 * 此前代理「转发」分支（http.request 到运行时目标）从未被任何测试覆盖，
 * 仅由人工 probe 验证过 req.url 剥离行为。本测试用本地 mock 上游（模拟靶机容器）
 * 真正跑通：
 *   1) 代理前缀被剥离、?t= 令牌参数被剔除后再转发；
 *   2) Authorization 头绝不转发给靶机（防令牌泄漏）；
 *   3) Host 头重写为目标地址；
 *   4) POST 请求体被正确透传。
 *
 * 通过注入 FakeRuntime（指向 mock 上游端口）在无 Docker 下验证真实代理链路。
 */
process.env.DOCKER_SIMULATE = '0'; // 走真实路径 → 触发代理转发

const http = require('http');
const factory = require('../src/runtimes');

// 必须在 require envManager / index 之前注入，使 envManager 懒解析拿到 FakeRuntime
const upstreamHits = [];
const upstream = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString();
    upstreamHits.push({ method: req.method, url: req.url, auth: req.headers['authorization'] || null, host: req.headers['host'] || null, body });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, echo: { method: req.method, url: req.url, auth: req.headers['authorization'] || null, host: req.headers['host'] || null, body } }));
  });
});

const fake = {
  async create(ctx) {
    return { proxyHost: '127.0.0.1', proxyPort: upstream.address().port, resourceId: 'fake-' + ctx.id };
  },
  async destroy() {},
};
factory.setRuntime(fake);

const envManager = require('../src/envManager');
const app = require('../src/index');
const TOKEN = 'sectutor-dev-token';

let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ ' + msg); }
}

async function main() {
  await new Promise((r) => upstream.listen(0, r));
  const server = app.listen(0);
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const auth = { Authorization: 'Bearer ' + TOKEN };

  // 创建一个真实路径环境（经 FakeRuntime，目标指向 mock 上游）
  const created = await fetch(`${base}/api/envs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ labId: 'lab_sqli' }),
  });
  const env = (await created.json()).env;
  const id = env.id;
  assert(env && env.status === 'running', '环境创建成功（真实路径 running）');

  // 代理访问应刷新空闲 TTL 活跃度（暴露修复点：此前 lastActiveAt 仅在创建时记录）
  const beforeActive = envManager.getEnv(id).lastActiveAt;
  await new Promise((r) => setTimeout(r, 5));

  console.log('GET 转发（剥离代理前缀 + 剔除 ?t=）:');
  const g = await fetch(`${base}/api/envs/${id}/proxy/foo?x=1&t=${TOKEN}`, { headers: auth });
  const gj = await g.json();
  assert(g.status === 200, '代理 GET 返回 200');
  assert(gj.echo.url === '/foo?x=1', `上游收到路径已剥离代理前缀且剔除 t 参数（实际 ${gj.echo.url}）`);
  assert(!gj.echo.url.includes('t='), '转发后 URL 不含 t= 令牌参数');

  console.log('Authorization 不转发给靶机:');
  assert(gj.echo.auth === null, '上游未收到 Authorization 头（令牌零泄漏）');

  console.log('Host 头重写为目标地址:');
  assert(gj.echo.host === `127.0.0.1:${upstream.address().port}`, `Host 重写为目标（实际 ${gj.echo.host}）`);

  console.log('代理访问刷新空闲 TTL 活跃度:');
  const afterActive = envManager.getEnv(id).lastActiveAt;
  assert(afterActive > beforeActive, `代理访问后 lastActiveAt 已刷新（${beforeActive} → ${afterActive}），活跃会话不会被误回收`);

  console.log('POST 请求体透传:');
  const p = await fetch(`${base}/api/envs/${id}/proxy/bar`, {
    method: 'POST', headers: { 'Content-Type': 'text/plain', ...auth }, body: 'PAYLOAD',
  });
  const pj = await p.json();
  assert(pj.echo.method === 'POST' && pj.echo.body === 'PAYLOAD', 'POST 方法与请求体正确透传');
  assert(pj.echo.url === '/bar', 'POST 路径剥离正确');

  console.log('无有效令牌被拒（代理鉴权门禁）:');
  const forbidden = await fetch(`${base}/api/envs/${id}/proxy/foo`, { headers: { Authorization: 'Bearer wrong-token' } });
  assert(forbidden.status === 401, '错误令牌访问代理返回 401（令牌零泄漏给靶机的前置门禁）');

  // 清理
  await envManager.destroyEnv(id, 'demo-user');
  factory.setRuntime(null);
  server.close();
  upstream.close();

  console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
