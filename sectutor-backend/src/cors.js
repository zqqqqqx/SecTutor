/**
 * cors.js — 跨域资源共享中间件（P5 修复项）
 *
 * 背景：前端 cybersec-agent 单独打开或经别的来源/端口加载时，
 * 向本后端发起的 fetch（带 Authorization 自定义头）会触发浏览器跨域预检
 * (OPTIONS) 与跨域响应校验。此前后端无任何 CORS 处理，导致浏览器直接拦截
 * 请求，前端表现为「Failed to fetch → 回退本地仿真演练」。
 *
 * 本中间件解决该问题：
 *   - 预检 (OPTIONS)：返回 204 并下发 Allow-Methods / Allow-Headers；
 *   - 实际请求：若来源在允许列表内，回显 Access-Control-Allow-Origin 并允许凭据；
 *   - 允许的源可通过 config.corsOrigins 配置（支持 `http://host:*` 通配端口与 `null` 源）。
 *
 * 注意：Credentialed 请求（带 Authorization 或 Cookie）不能使用通配 `*`，
 * 必须回显具体源；因此实现上改为「命中允许列表则回显 req.headers.origin」。
 */
const config = require('../config');

/**
 * 判断请求的 Origin 是否被允许。
 * 允许列表元素可为：
 *   - '*'                         任意源（不推荐与凭据同用）
 *   - 'null'                      file:// 本地页面（Origin 头为字符串 "null"）
 *   - 'http://host:port'          精确匹配
 *   - 'http://host:*'             同 host 任意端口（开发常用）
 */
function isOriginAllowed(origin, allowed) {
  if (!origin) return false;
  for (const a of allowed) {
    if (a === '*') return true;
    if (a === origin) return true;
    const m = /^([a-z]+:\/\/[^/:]+):\*$/i.exec(a);
    if (m) {
      // m[1] 已含协议与 "://"，如 "http://127.0.0.1"，直接作为前缀比较，避免重复拼接。
      const prefix = m[1];
      if (origin.indexOf(prefix) === 0) return true;
    }
  }
  return false;
}

function createCors() {
  const allowed = Array.isArray(config.corsOrigins) ? config.corsOrigins : [];
  // 性能优化：预编译「http://host:*」通配规则为前缀列表，避免每个请求都 exec 正则
  const wildcardPrefixes = [];
  for (const a of allowed) {
    if (a === '*') continue; // 由 allowed.includes 直接命中
    const m = /^([a-z]+:\/\/[^/:]+):\*$/i.exec(a);
    if (m) wildcardPrefixes.push(m[1].toLowerCase());
  }
  return function corsMiddleware(req, res, next) {
    const origin = req.headers.origin;
    if (origin) {
      let ok = allowed.includes(origin);
      if (!ok) {
        const lo = origin.toLowerCase();
        for (const p of wildcardPrefixes) {
          if (lo.indexOf(p) === 0) { ok = true; break; }
        }
      }
      if (ok) {
        // Credentialed 请求必须回显具体源，不能用 '*'
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Vary', 'Origin');
      }
    }

    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,Accept');
      res.setHeader('Access-Control-Max-Age', '600');
      return res.sendStatus(204);
    }

    next();
  };
}

module.exports = { createCors, isOriginAllowed };
