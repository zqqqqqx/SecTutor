/**
 * index.js — Express 入口。
 *
 * 仅在直接运行时监听端口；被测试 require 时只导出 app，不监听。
 */
const express = require('express');
const http = require('http');
const url = require('url');
const path = require('path');
const config = require('../config');
const { createCors } = require('./cors');
const envs = require('./routes/envs');
const envManager = require('./envManager');
const { requireAuth, extractToken, parseCookies, setAuthFailHook } = require('./auth');
const { createLimiter, middleware: rateLimit, noteAuthFail } = require('./ratelimit');
const kbCatalog = require('./kbCatalog');
const reclaim = require('./reclaim');
const audit = require('./audit');
const pkgVersion = (function () {
  try { return require('../package.json').version; } catch (e) { return 'unknown'; }
})();

/**
 * 反向代理处理器：把 /api/envs/:id/proxy/* 转发到本环境靶机容器
 * （仅绑定在 127.0.0.1 的发布端口，外部不可直达）。
 *
 * 安全要点：
 *   - 必须先于 express.json 挂载，以保留原始请求体用于转发；
 *   - 校验请求者归属与靶机状态，杜绝越权访问邻户环境；
 *   - 剥离泄漏后端令牌的 ?t= 查询参数，且绝不把 Authorization 头转发给靶机；
 *   - 首次命中（带令牌但无 cookie）下发 httpOnly cookie，使后续相对链接免 token。
 */
async function proxyHandler(req, res) {
  const env = envManager.getEnv(req.params.id);
  if (!env) {
    return res.status(404).json({ ok: false, error: '环境不存在', code: 'NOT_FOUND' });
  }
  if (env.owner !== req.owner) {
    return res.status(403).json({ ok: false, error: '无权访问', code: 'FORBIDDEN' });
  }
  if (env.simulated || !env.hostPort || env.status !== 'running') {
    return res.status(409).json({
      ok: false,
      error: '该环境暂不可代理（仿真模式或未就绪）',
      code: 'NO_PROXY',
    });
  }

  // 代理访问即视为活跃：刷新空闲 TTL 计时，避免「正在使用中却被空闲回收」误杀。
  // （修复：此前 lastActiveAt 仅在创建时记录，代理访问不刷新，导致活跃会话在 idleTtlMs 后被误回收）
  envManager.touchEnv(req.params.id);

  // 引导 cookie：浏览器随后同源相对链接自动携带，免去重复传 token
  const token = extractToken(req);
  const cookies = parseCookies(req);
  if (!cookies.sectutor_pt && token) {
    res.setHeader(
      'Set-Cookie',
      `sectutor_pt=${encodeURIComponent(token)}; Path=/api/envs/${req.params.id}/proxy; HttpOnly; SameSite=Lax; Max-Age=1800`
    );
  }

  // 构造目标路径：剥离代理前缀，并剔除泄漏令牌的 t 参数
  const parsed = url.parse(req.url || '/', true);
  delete parsed.query.t;
  const targetPath = url.format({ pathname: parsed.pathname, query: parsed.query });
  // 代理目标由运行时决定：Docker=127.0.0.1:hostPort；K8s=PodIP:containerPort；FC=tapIP:port
  const proxyHost = env.proxyHost || '127.0.0.1';
  const proxyPort = env.proxyPort || env.hostPort;
  const target = `http://${proxyHost}:${proxyPort}${targetPath}`;

  const headers = { ...req.headers };
  delete headers['authorization']; // 不向后端靶机泄露 Bearer 令牌
  delete headers['connection'];
  headers['host'] = `${proxyHost}:${proxyPort}`;

  const preq = http.request(target, { method: req.method, headers }, (pres) => {
    res.writeHead(pres.statusCode, pres.headers);
    pres.pipe(res);
  });
  preq.on('error', (e) => {
    if (!res.headersSent) {
      res.status(502).json({ ok: false, error: '靶场代理失败：' + e.message, code: 'PROXY_ERR' });
    } else {
      res.end();
    }
  });
  // 请求体转发（代理路由在 express.json 之前挂载，原始流可用）
  req.pipe(preq);
}

function createApp() {
  const app = express();

  // CORS 必须最优先挂载：跨域预检(OPTIONS)与凭据校验需在鉴权之前完成，否则浏览器拦截。
  app.use(createCors());

  // 健康与就绪检查：/health 保留（旧客户端兼容，字段不变），/api/health 为增强版。
  // 增强版面向"自建与排障"：一眼看清 docker 可用性、配额占用、回收器、内容版本。
  const healthPayload = () => {
    const q = envManager.quota.snapshot();
    const r = reclaim.getStats();
    const kb = kbCatalog.readCatalog();
    return {
      ok: true,
      simulate: config.simulate,
      time: Date.now(),
      uptimeSec: Math.round(process.uptime()),
      version: pkgVersion,
      node: process.version,
      envs: { total: q.global, maxPerOwner: q.maxPerOwner, maxConcurrent: q.maxConcurrent },
      reclaim: { lastRunAt: r.lastRunAt, reclaimed: r.reclaimed, intervalMs: r.intervalMs },
      // 当前使用的隔离运行时（可插拔：docker / k8s / firecracker；simulate=true 表示走内存仿真）
      runtime: { name: config.runtime || 'docker', simulate: !!config.simulate },
      content: kb.ok ? { version: kb.version, counts: kb.counts } : { error: kb.error },
      rateLimit: { off: process.env.RATE_LIMIT_OFF === '1' },
    };
  };
  app.get('/health', (req, res) => res.json({ ok: true, simulate: config.simulate, time: Date.now() }));
  app.get('/api/health', (req, res) => res.json(healthPayload()));

  // 速率限制（零依赖令牌桶）：
  //   · 认证失败（带无效令牌）→ 20 次/分钟，防猜令牌；
  //   · /api/envs 的写操作（创建/销毁）→ 120 次/分钟，防滥调靶场；
  //   · 其余 /api 请求 → 600 次/分钟宽松兜底（代理路径不受限：那是正常浏览靶机页面）。
  const limiter = createLimiter();
  setAuthFailHook((req) => noteAuthFail(limiter, req).allowed);
  app.use('/api/envs', rateLimit(limiter, 'write', { methods: ['POST', 'PUT', 'PATCH', 'DELETE'] }));
  app.use('/api', (req, res, next) => {
    if (req.path.indexOf('/envs/') === 0 && req.path.indexOf('/proxy') > 0) return next(); // 靶机页面流量不限
    return rateLimit(limiter, 'global')(req, res, next);
  });

  // 知识库目录（公开，无鉴权）：内容指纹 + 领域/知识点/题库统计。
  // 客户端用它校验"本地内容是否为同一版本"，为多端与将来的增量同步铺路。
  app.get('/api/kb/catalog', (req, res) => {
    const kb = kbCatalog.readCatalog();
    if (!kb.ok) return res.status(503).json({ ok: false, code: 'KB_UNAVAILABLE', error: kb.error });
    return res.json(kb);
  });

  // 反向代理必须先于 express.json 挂载，以保留原始请求体用于转发
  app.use('/api/envs/:id/proxy', requireAuth, proxyHandler);

  app.use(express.json());
  app.use('/api/envs', envs);

  // 聚合指标端点（顶层，独立于 /api/envs 的逐环境路由）：配额用量 / 全局并发 /
  // 回收器运行统计 / 审计摘要 / 配置快照。需鉴权。
  app.get('/api/stats', requireAuth, (req, res) => {
    const q = envManager.quota.snapshot();
    const r = reclaim.getStats();
    return res.json({
      ok: true,
      stats: {
        total: q.global,
        perOwner: q.perOwner,
        maxPerOwner: q.maxPerOwner,
        maxConcurrent: q.maxConcurrent,
        reclaim: {
          lastRunAt: r.lastRunAt,
          scanned: r.scanned,
          reclaimed: r.reclaimed,
          intervalMs: r.intervalMs,
        },
        audit: audit.summary(), // 审计事件总数 / 按类型计数 / 时间桶趋势
        config: {
          absoluteTtlMs: config.absoluteTtlMs,
          idleTtlMs: config.idleTtlMs,
          backendSimulate: config.simulate,
          quotaBackend: process.env.REDIS_URL ? 'redis' : 'memory',
        },
      },
    });
  });

  // 审计事件流端点（需鉴权）：返回近期事件（最新优先）+ 聚合摘要。
  // 仪表盘 public/dashboard.html 轮询此端点绘制审计看板。
  app.get('/api/audit', requireAuth, (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
    return res.json({
      ok: true,
      events: audit.list({ limit }),
      summary: audit.summary(),
    });
  });

  // 可选：把前端（如 cybersec-agent）同源自建服务于根路径，彻底避免跨域。
  // 设为 FRONTEND_DIR=../cybersec-agent 后，直接访问 http://localhost:8787/ 即为前端页面，
  // 其 API 请求与页面同源，浏览器不会触发跨域预检。
  if (config.frontendDir) {
    const fePath = path.isAbsolute(config.frontendDir)
      ? config.frontendDir
      : path.join(process.cwd(), config.frontendDir);
    app.use(express.static(fePath));
  }

  // 静态资源（仪表盘等）：置于 API 路由之后、404 之前，仅匹配存在的文件（/api/* 无对应文件，不受影响）。
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // 兜底 404
  app.use((req, res) => res.status(404).json({ ok: false, error: 'not found' }));

  return app;
}

const app = createApp();

if (require.main === module) {
  reclaim.startReclaimer();
  app.listen(config.port, () => {
    console.log(
      `[sectutor-backend] 监听 :${config.port}  simulate=${config.simulate}`
    );
  });
}

module.exports = app;
