/*
 * cors.test.js — CORS 中间件契约测试（无需 Docker）。
 * 验证：跨域预检(OPTIONS)返回 204 + 正确响应头；带 Origin 的跨域 POST /api/envs
 * 能回显 Access-Control-Allow-Origin 并允许凭据；同源（无 Origin）不注入 CORS 头；
 * 来源不在允许列表时不回显 ACAO（浏览器据此拦截）；isOriginAllowed 通配逻辑。
 */
process.env.DOCKER_SIMULATE = '1';
const app = require('../src/index.js');
const { isOriginAllowed } = require('../src/cors');

const PORT = 8781;
const BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = 'sectutor-dev-token';

let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ ' + msg); }
}

async function main() {
  const server = app.listen(PORT);
  await new Promise((r) => server.once('listening', r));

  try {
    console.log('isOriginAllowed 通配逻辑（单元）:');
    assert(isOriginAllowed('http://127.0.0.1:3000', ['http://127.0.0.1:*']), '同 host 任意端口匹配 *');
    assert(isOriginAllowed('http://localhost:5173', ['http://localhost:*']), 'localhost 任意端口匹配 *');
    assert(isOriginAllowed('null', ['null']), 'file:// 的 null 源被允许');
    assert(!isOriginAllowed('http://evil.com', ['http://localhost:*']), '不在列表的源被拒绝');
    assert(isOriginAllowed('http://127.0.0.1:3000', ['*']), '* 允许任意源');

    console.log('预检 (OPTIONS) 命中允许源:');
    const preflight = await fetch(`${BASE}/api/envs`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://127.0.0.1:3000' },
    });
    assert(preflight.status === 204, '预检返回 204');
    assert(preflight.headers.get('access-control-allow-origin') === 'http://127.0.0.1:3000', '预检回显具体源（非 *）');
    assert(preflight.headers.get('access-control-allow-credentials') === 'true', '预检允许凭据');
    assert(/Authorization/.test(preflight.headers.get('access-control-allow-headers') || ''), '预检允许 Authorization 头');

    console.log('预检 (OPTIONS) 命中拒绝源:');
    const blocked = await fetch(`${BASE}/api/envs`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://evil.com' },
    });
    assert(blocked.status === 204, '拒绝源预检仍 204（由浏览器据 ACAO 判定拦截）');
    assert(!blocked.headers.get('access-control-allow-origin'), '拒绝源不回显 ACAO（浏览器将拦截实际请求）');

    console.log('跨域 POST /api/envs（带 Origin + 鉴权）:');
    const res = await fetch(`${BASE}/api/envs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}`, Origin: 'http://127.0.0.1:3000' },
      body: JSON.stringify({ labId: 'lab_sqli' }),
    });
    const data = await res.json();
    assert(res.status === 201, '跨域 POST 返回 201');
    assert(data && data.ok === true && data.env, '返回 ok 且含 env（仿真）');
    assert(res.headers.get('access-control-allow-origin') === 'http://127.0.0.1:3000', '实际请求回显 ACAO');
    assert(res.headers.get('access-control-allow-credentials') === 'true', '实际请求允许凭据');

    console.log('同源（无 Origin）不注入 CORS 头:');
    const same = await fetch(`${BASE}/api/envs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ labId: 'lab_cmdi' }),
    });
    assert(same.status === 201, '同源 POST 返回 201');
    assert(!same.headers.get('access-control-allow-origin'), '同源不注入 ACAO（无必要）');

    console.log('带 Origin 的查询 GET /api/envs:');
    const getRes = await fetch(`${BASE}/api/envs`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: 'http://localhost:4000' },
    });
    assert(getRes.headers.get('access-control-allow-origin') === 'http://localhost:4000', 'GET 同样回显 ACAO');
  } catch (e) {
    fail++;
    console.log('  ✗ 异常: ' + (e && e.stack || e));
  } finally {
    server.close();
  }

  console.log(`\n${pass} 通过, ${fail} 失败`);
  if (fail > 0) process.exit(1);
}

main();
