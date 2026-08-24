/**
 * reclaim.js — 后台回收器（含运行统计）。
 *
 * 双保险：绝对 TTL（硬上限）到期 + 空闲 TTL（无活动）到期，任一触发即销毁并释放资源。
 * 不依赖前端心跳：即使页面被关，服务侧 TTL 也会兜底回收，避免端口/容器泄漏。
 *
 * 同时导出 getStats()，供 /api/stats 指标端点聚合回收器运行数据（上次扫描时刻、
 * 扫描到的存活数、已回收数），实现路线图 P3 的「僵尸清扫 + 指标」要求。
 */
const config = require('../config');
const envManager = require('./envManager');
const audit = require('./audit');

let lastRunAt = null;
let scanned = 0;
let reclaimed = 0;

async function tick() {
  const now = Date.now();
  lastRunAt = now;
  let count = 0;
  const expired = [];
  for (const e of envManager.listAll()) {
    if (e.status === 'destroyed' || e.status === 'pending') continue;
    count++;
    const expiredNow = now >= e.expiresAt;
    const idle = now - e.lastActiveAt >= config.idleTtlMs;
    if (expiredNow || idle) {
      expired.push({ e, reason: expiredNow ? 'absolute-ttl' : 'idle-ttl' });
    }
  }
  // 性能优化：多个到期环境并行回收（Docker 停/删/网络拆除相互独立），
  // 避免逐条 await 串行销毁把单次扫描拖长 N 倍。
  const results = await Promise.allSettled(
    expired.map(async ({ e, reason }) => {
      try {
        await envManager.destroyEnv(e.id, e.owner, true);
        audit.record({ type: 'reclaim', owner: e.owner, envId: e.id, labId: e.labId, detail: reason });
        console.log(`[reclaim] 已回收 ${e.id} (${reason}) lab=${e.labId}`);
        return true;
      } catch (err) {
        console.error(`[reclaim] 回收失败 ${e.id}: ${err.message}`);
        return false;
      }
    })
  );
  reclaimed += results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
  scanned = count;
}

function startReclaimer() {
  const timer = setInterval(tick, config.reclaimIntervalMs);
  if (timer.unref) timer.unref(); // 不阻止进程退出
  console.log(
    `[reclaim] 已启动，间隔 ${config.reclaimIntervalMs}ms，绝对TTL ${config.absoluteTtlMs}ms，空闲TTL ${config.idleTtlMs}ms`
  );
  return timer;
}

/** 回收器运行统计（供 /api/stats 聚合）。 */
function getStats() {
  return { lastRunAt, scanned, reclaimed, intervalMs: config.reclaimIntervalMs };
}

module.exports = { startReclaimer, getStats, tick };
