/*
 * ratelimit.test.js — 令牌桶速率限制单元测试（确定性：注入假时钟；无需网络与 Docker）。
 * 覆盖：
 *   - 容量内放行、超出返回 429 且带 Retry-After
 *   - 令牌随时间补充（假时钟推进）
 *   - 不同类别/不同客户端互不影响
 *   - RATE_LIMIT_OFF=1 时全关
 *   - 中间件只对指定方法生效（写操作限制不误伤 GET）
 *   - 认证失败挂钩：带无效令牌连猜 → 直接被限流
 */
const { createLimiter, middleware, noteAuthFail, clientId } = require('../src/ratelimit');

let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); }
}

// ---- 假时钟 ----
let nowMs = 1000000;
const clock = { now: () => nowMs };

// ---- ① 容量与补充 ----
{
  const lim = createLimiter({ write: { capacity: 3, refillMs: 1000 } , global: { capacity: 100, refillMs: 1000 } }, clock);
  const r1 = lim.take('write', 'ip:1.1.1.1');
  assert(r1.allowed && r1.remaining === 2, '容量内放行，剩余令牌正确递减');
  lim.take('write', 'ip:1.1.1.1');
  lim.take('write', 'ip:1.1.1.1');
  const r4 = lim.take('write', 'ip:1.1.1.1');
  assert(!r4.allowed, '超出容量后被拒绝');
  assert(r4.retryAfterSec >= 1, '被拒绝时给出 Retry-After（秒）');
  nowMs += 1000; // 推进 1 秒 → 补满 3 个令牌
  const r5 = lim.take('write', 'ip:1.1.1.1');
  assert(r5.allowed, '令牌按时间补充后可再次通过');
}

// ---- ② 键隔离 ----
{
  nowMs += 100000;
  const lim = createLimiter({ write: { capacity: 1, refillMs: 60000 }, global: { capacity: 100, refillMs: 60000 } }, clock);
  assert(lim.take('write', 'ip:A').allowed, '客户端 A 用掉额度');
  assert(!lim.take('write', 'ip:A').allowed, '客户端 A 第二次被拒');
  assert(lim.take('write', 'ip:B').allowed, '客户端 B 的额度不受 A 影响');
  assert(lim.take('global', 'ip:A').allowed, '同一客户端的不同类别互不影响');
}

// ---- ③ 中间件：状态码 / 头 / 方法过滤 / 关闭开关 ----
{
  nowMs += 100000;
  const lim = createLimiter({ write: { capacity: 1, refillMs: 60000 }, global: { capacity: 5, refillMs: 60000 } }, clock);
  const mw = middleware(lim, 'write', { methods: ['POST', 'DELETE'] });
  const mk = (method) => {
    const res = {
      code: 200, headers: {}, body: null,
      setHeader(k, v) { this.headers[k] = v; },
      status(c) { this.code = c; return this; },
      json(b) { this.body = b; return this; },
    };
    let nexted = false;
    mw({ method, headers: {}, socket: { remoteAddress: '127.0.0.1' } }, res, () => { nexted = true; });
    return { res, nexted };
  };
  const g1 = mk('GET');
  assert(g1.nexted, 'GET 不受写操作限制（方法过滤生效）');
  const p1 = mk('POST');
  assert(p1.nexted, '第一个 POST 放行');
  const p2 = mk('POST');
  assert(!p2.nexted && p2.res.code === 429, '第二个 POST 被限流返回 429');
  assert(p2.res.body && p2.res.body.code === 'RATE_LIMITED', '响应体带 RATE_LIMITED 代码');
  assert(Number(p2.res.headers['Retry-After']) >= 1, '响应带 Retry-After 头');
  assert(p2.res.headers['X-RateLimit-Remaining'] === '0', '响应带剩余额度头');

  process.env.RATE_LIMIT_OFF = '1';
  const off = mk('POST');
  assert(off.nexted, 'RATE_LIMIT_OFF=1 时全部放行（压测用）');
  delete process.env.RATE_LIMIT_OFF;
}

// ---- ④ 认证失败挂钩 ----
{
  nowMs += 100000;
  const lim = createLimiter({ 'auth-fail': { capacity: 2, refillMs: 60000 }, global: { capacity: 100, refillMs: 60000 } }, clock);
  const req = { headers: {}, socket: { remoteAddress: '10.0.0.9' } };
  assert(noteAuthFail(lim, req).allowed, '第 1 次认证失败被记录（未触发限流）');
  assert(noteAuthFail(lim, req).allowed, '第 2 次仍在额度内');
  assert(!noteAuthFail(lim, req).allowed, '第 3 次触发限流（防猜令牌）');
  process.env.RATE_LIMIT_OFF = '1';
  assert(noteAuthFail(lim, req).allowed, '关闭开关时认证失败也不限流');
  delete process.env.RATE_LIMIT_OFF;
}

// ---- ⑤ clientId 归属优先 ----
{
  const withOwner = clientId({ headers: {}, socket: {} }, 'demo-user');
  const withIp = clientId({ headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }, socket: {} }, null);
  assert(withOwner === 'owner:demo-user', '已鉴权请求按 owner 计数（代理后也能区分用户）');
  assert(withIp === 'ip:1.2.3.4', '取 X-Forwarded-For 的第一段作为客户端 IP');
}

console.log('\nratelimit: 通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
