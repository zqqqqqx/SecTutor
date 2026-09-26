/**
 * ratelimit.js — 零依赖令牌桶速率限制。
 *
 * 为什么要它：后端虽有令牌鉴权，但**猜令牌**与**滥调创建靶场**这两类滥用此前没有闸门。
 * 这里给两类高危入口加限制，其余流量只做宽松兜底，避免影响正常使用：
 *   - auth-fail：认证失败（连续猜令牌）→ 收得最紧
 *   - write    ：写操作（创建/销毁环境等）→ 适中
 *   - global   ：所有请求的宽松兜底（防脚本刷爆）
 *
 * 设计要点：
 *   - 零依赖：令牌桶手写，不引 redis/express-rate-limit；
 *   - 进程内：单机部署（仅绑 127.0.0.1）足够；多实例时每实例独立计数（可接受）；
 *   - 可关：RATE_LIMIT_OFF=1 全关（压测/stress 用）；上限可用环境变量覆盖；
 *   - 桶自动回收：超过 idleMs 未访问的键被清理，避免内存随 IP 无限增长。
 */
const DEFAULT_LIMITS = {
  // 每 60 秒：写操作 120 次、认证失败 20 次、全局 600 次（宽松，正常使用远达不到）
  write: { capacity: Number(process.env.RL_WRITE || 120), refillMs: 60000 },
  'auth-fail': { capacity: Number(process.env.RL_AUTHFAIL || 20), refillMs: 60000 },
  global: { capacity: Number(process.env.RL_GLOBAL || 600), refillMs: 60000 },
};
const IDLE_MS = 10 * 60 * 1000;

function createLimiter(limits = DEFAULT_LIMITS, opts = {}) {
  const now = opts.now || (() => Date.now());
  const buckets = new Map(); // key = class + '|' + id -> { tokens, at }

  function sweep() {
    const t = now();
    for (const [k, b] of buckets) if (t - b.at > IDLE_MS) buckets.delete(k);
  }

  /**
   * 取一个令牌。
   * @returns {{ allowed: boolean, remaining: number, retryAfterSec?: number }}
   */
  function take(cls, id) {
    const rule = limits[cls] || limits.global;
    const key = cls + '|' + (id || 'anon');
    const t = now();
    let b = buckets.get(key);
    if (!b) {
      b = { tokens: rule.capacity, at: t };
      buckets.set(key, b);
    }
    // 按经过时间补充令牌
    const elapsed = Math.max(0, t - b.at);
    if (elapsed > 0) {
      const refill = (elapsed / rule.refillMs) * rule.capacity;
      b.tokens = Math.min(rule.capacity, b.tokens + refill);
      b.at = t;
    }
    if (b.tokens >= 1) {
      b.tokens -= 1;
      return { allowed: true, remaining: Math.floor(b.tokens) };
    }
    const needMs = ((1 - b.tokens) / rule.capacity) * rule.refillMs;
    return { allowed: false, remaining: 0, retryAfterSec: Math.max(1, Math.ceil(needMs / 1000)) };
  }

  return { take, sweep, buckets, limits };
}

/** 从请求取一个稳定的客户端标识（本机部署下基本就是 127.0.0.1）。 */
function clientId(req, owner) {
  if (owner) return 'owner:' + owner;
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket && req.socket.remoteAddress || 'unknown';
  return 'ip:' + ip;
}

/**
 * 中间件工厂。
 * @param {'write'|'global'} cls 该路由使用的限制类别
 * @param {{methods?: string[]}} [opts] 只对指定方法生效（如写操作只限 POST/DELETE）
 */
function middleware(limiter, cls, opts) {
  const methods = opts && opts.methods ? opts.methods.map((m) => m.toUpperCase()) : null;
  return function rateLimit(req, res, next) {
    if (process.env.RATE_LIMIT_OFF === '1') return next();
    if (methods && methods.indexOf(req.method.toUpperCase()) < 0) return next();
    const r = limiter.take(cls, clientId(req, req.owner));
    res.setHeader('X-RateLimit-Remaining', String(r.remaining));
    if (r.allowed) return next();
    res.setHeader('Retry-After', String(r.retryAfterSec));
    return res.status(429).json({
      ok: false,
      code: 'RATE_LIMITED',
      error: '请求过于频繁，请 ' + r.retryAfterSec + ' 秒后重试',
    });
  };
}

/** 认证失败计数（路由内部调用，不算中间件）。 */
function noteAuthFail(limiter, req) {
  if (process.env.RATE_LIMIT_OFF === '1') return { allowed: true, remaining: 0 };
  return limiter.take('auth-fail', clientId(req, null));
}

module.exports = { createLimiter, middleware, clientId, noteAuthFail, DEFAULT_LIMITS };
