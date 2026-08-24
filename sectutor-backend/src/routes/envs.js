/**
 * routes/envs.js — 临时环境 REST 接口。
 *
 *   POST   /api/envs        body:{ labId }           创建临时环境
 *   GET    /api/envs        列出当前用户的所有环境
 *   GET    /api/envs/stats  聚合指标：配额用量 / 全局并发 / 回收统计 / 配置快照（需鉴权）
 *   GET    /api/envs/:id    查询单个环境状态
 *   DELETE /api/envs/:id    结束并销毁（手动释放资源）
 */
const router = require('express').Router();
const envManager = require('../envManager');
const { requireAuth } = require('../auth');

function publicEnv(e) {
  return {
    id: e.id,
    labId: e.labId,
    title: (require('../labSpecs').getSpec(e.labId) || {}).title || e.labId,
    accessUrl: e.accessUrl,
    status: e.status,
    createdAt: e.createdAt,
    expiresAt: e.expiresAt,
    simulated: !!e.simulated,
    error: e.error || undefined,
  };
}

router.post('/', requireAuth, async (req, res) => {
  const { labId } = req.body || {};
  if (!labId) return res.status(400).json({ ok: false, error: '缺少 labId' });
  try {
    const env = await envManager.createEnv(labId, req.owner);
    return res.status(201).json({ ok: true, env: publicEnv(env) });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, error: e.message, code: e.code });
  }
});

router.get('/', requireAuth, (req, res) => {
  return res.json({ ok: true, envs: envManager.listEnvs(req.owner).map(publicEnv) });
});

router.get('/:id', requireAuth, (req, res) => {
  const env = envManager.getEnv(req.params.id);
  if (!env) return res.status(404).json({ ok: false, error: '环境不存在' });
  if (env.owner !== req.owner) return res.status(403).json({ ok: false, error: '无权访问' });
  return res.json({ ok: true, env: publicEnv(env) });
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await envManager.destroyEnv(req.params.id, req.owner);
    return res.json({ ok: true, message: '环境已销毁并释放资源' });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, error: e.message, code: e.code });
  }
});

module.exports = router;
