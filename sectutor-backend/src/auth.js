/**
 * auth.js — 鉴权 stub（含反向代理场景的令牌解析）。
 *
 * 骨架阶段：接受 config.devToken 作为开发令牌，并把 owner 固定为 demo-user。
 * 生产接入：在 ownerForToken 内替换为真实 JWT 校验（jsonwebtoken.verify），
 * 从 payload 解析出用户标识写入 owner，并保持「谁起的谁才能销毁」的归属约束。
 *
 * 反向代理（/api/envs/:id/proxy）场景下，浏览器导航无法携带 Authorization
 * 头，因此额外支持「查询参数 ?t=」与「cookie sectutor_pt」两种令牌来源：
 *   1) 首次经前端带上 ?t= 进入代理 → 后端下发 httpOnly cookie；
 *   2) 随后的相对链接（同源）自动携带 cookie，无需重复传 token。
 */
const config = require('../config');

function parseCookies(req) {
  const h = req.headers.cookie;
  if (!h) return {};
  const out = {};
  h.split(';').forEach((kv) => {
    const i = kv.indexOf('=');
    if (i > -1) out[kv.slice(0, i).trim()] = decodeURIComponent(kv.slice(i + 1).trim());
  });
  return out;
}

/**
 * 从请求中抽取原始令牌，来源优先级：
 *   Authorization: Bearer  >  查询参数 ?t=  >  cookie sectutor_pt
 * 返回 null 表示没有任何令牌。
 */
function extractToken(req) {
  const header = req.headers.authorization || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1];
  if (req.query && req.query.t) return String(req.query.t);
  const cookies = parseCookies(req);
  if (cookies.sectutor_pt) return cookies.sectutor_pt;
  return null;
}

/**
 * 把原始令牌解析为 owner；无效令牌返回 null。
 * 生产：return require('jsonwebtoken').verify(token, config.jwtSecret).sub || null;
 */
function ownerForToken(token) {
  if (!token) return null;
  if (token === config.devToken) return 'demo-user';
  return null;
}

/** 便捷封装：直接返回 owner（或 null）。 */
function resolveOwner(req) {
  return ownerForToken(extractToken(req));
}

function requireAuth(req, res, next) {
  const owner = resolveOwner(req);
  if (!owner) {
    return res.status(401).json({ ok: false, error: '缺少或无效 token' });
  }
  req.owner = owner;
  return next();
}

module.exports = { requireAuth, resolveOwner, ownerForToken, extractToken, parseCookies };
