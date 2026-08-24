/**
 * audit.js — 临时环境生命周期审计事件流（append-only，内存环形缓冲）。
 *
 * 为什么需要它：原 /api/stats 只有「实时 registry 计数」+「回收累计计数」，没有
 * 「谁、何时、起了什么、何时销毁、是否被回收/被配额拒绝」的事件记录——而这正是
 * 安全合规审计与运营看板必需的。这里用封顶的内存环形缓冲承载事件流，既能支撑
 * 实时仪表盘，又不会无限占用内存。
 *
 * 设计要点：
 *   - 事件类型：create（创建成功）/ create_denied（配额/端口/资源拒绝）/
 *     destroy（手动销毁）/ reclaim（TTL 僵尸回收）/ error（创建中途失败回滚）。
 *   - record 不接受 owner 为空（审计必须能追溯到人）；envId/labId/detail 可选。
 *   - 生产若要持久化审计（防进程重启丢失），把 ring 换成写入追加日志文件或
 *     外部存储即可，record/list/summary 接口不变（见 README 路线图）。
 *
 * 接口：
 *   record({ type, owner, envId, labId, detail }) -> event
 *   list({ limit, type, owner })                  -> event[]（最新优先）
 *   summary()                                     -> { total, byType, buckets }
 */
const EVENT_TYPES = ['create', 'create_denied', 'destroy', 'reclaim', 'error'];
const MAX_EVENTS = 2000; // 环形缓冲封顶，超出丢弃最旧
const BUCKET_MS = 60 * 1000; // 时间桶粒度：1 分钟
const BUCKET_COUNT = 30; // 仪表盘展示最近 30 个桶（30 分钟趋势）

let ring = []; // 旧→新；超过 MAX_EVENTS 时 shift 最旧

// 性能优化：summary() 结果缓存，仅在 record()/__resetForTest() 后失效。
// 仪表盘轮询 /api/stats 与 /api/audit 时，不再每次遍历 ring 重算聚合。
let summaryCache = null;
let summaryDirty = true;

function isValidType(t) {
  return EVENT_TYPES.includes(t);
}

/**
 * 记录一条审计事件。owner 为必填（审计可追溯性）。
 */
function record({ type, owner, envId, labId, detail } = {}) {
  if (!isValidType(type)) {
    throw new Error('audit.record: 未知事件类型 ' + type);
  }
  if (!owner) {
    throw new Error('audit.record: owner 必填（审计必须能追溯到人）');
  }
  const ev = {
    ts: Date.now(),
    type,
    owner,
    envId: envId || null,
    labId: labId || null,
    detail: detail || null,
  };
  ring.push(ev);
  if (ring.length > MAX_EVENTS) ring.shift();
  summaryDirty = true; // 事件流变化，聚合缓存失效
  return ev;
}

/**
 * 列出近期事件（最新优先）。可按类型/owner 过滤。
 */
function list({ limit = 100, type, owner } = {}) {
  let out = ring;
  if (type) out = out.filter((e) => e.type === type);
  if (owner) out = out.filter((e) => e.owner === owner);
  out = out.slice(-limit); // 取最近的 limit 条
  return out.reverse(); // 最新在前
}

/**
 * 聚合摘要：总数、按类型计数、最近 BUCKET_COUNT 个时间桶的事件数（用于趋势条形图）。
 * 结果缓存到下一次 record()，轮询场景零重算。
 */
function summary() {
  if (!summaryDirty && summaryCache) return summaryCache;
  const byType = {};
  for (const t of EVENT_TYPES) byType[t] = 0;
  for (const e of ring) byType[e.type] = (byType[e.type] || 0) + 1;

  // 时间桶：以当前时间为末尾，向前 BUCKET_COUNT 个桶
  const nowBucket = Math.floor(Date.now() / BUCKET_MS);
  const buckets = [];
  for (let i = BUCKET_COUNT - 1; i >= 0; i--) {
    buckets.push({ bucket: nowBucket - i, count: 0 });
  }
  const firstBucket = buckets[0].bucket;
  for (const e of ring) {
    const b = Math.floor(e.ts / BUCKET_MS);
    const idx = b - firstBucket;
    if (idx >= 0 && idx < BUCKET_COUNT) buckets[idx].count++;
  }

  summaryCache = { total: ring.length, byType, buckets, bucketMs: BUCKET_MS };
  summaryDirty = false;
  return summaryCache;
}

/** 仅供测试重置（环形缓冲是模块级单例）。 */
function __resetForTest() {
  ring = [];
  summaryCache = null;
  summaryDirty = true;
}

module.exports = { record, list, summary, __resetForTest, EVENT_TYPES, MAX_EVENTS };
