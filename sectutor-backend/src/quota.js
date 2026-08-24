/**
 * quota.js — 配额 / 并发协调（多实例 / 多租户就绪）。
 *
 * 默认内存实现：直接从 envManager 的 registry 派生每用户与全局计数，单一数据源，
 * 行为与本服务原有逻辑完全一致（单实例场景零差异）。
 *
 * 若设置环境变量 REDIS_URL 且已安装 ioredis，则切换到 Redis 实现：
 *   - 跨实例全局并发上限与环境计数，适合多副本部署；
 *   - 内存实现不可用时自动回退并告警，绝不阻断启动。
 *
 * 接口（两种实现一致）：
 *   tryCreate(owner, id) -> { ok, code?, status?, error? }  原子校验并预约名额
 *   release(id, owner)                              释放名额（幂等）
 *   snapshot()        -> { perOwner, global, maxPerOwner, maxConcurrent }
 */
const config = require('../config');
const REDIS_KEY_GLOBAL = 'sectutor:global';
const REDIS_KEY_OWNER = 'sectutor:owner'; // hash: owner -> count
const REDIS_KEY_IDS = 'sectutor:ids';     // hash: envId -> owner（存活映射，用于幂等释放）

/**
 * 两段 Lua 脚本集中定义并导出，便于契约测试精确断言「RedisQuota 实际调用了哪段脚本」。
 * 语义由各 Redis 客户端（ioredis.eval）在 Redis 服务端原子执行：
 *   - LUA_TRY_CREATE：INCR 全局 → 超全局上限则回滚返回 GLOBAL_CAP；HINCRBY owner → 超每用户上限则回滚返回 QUOTA；
 *     否则 HSET ids(id→owner) 并返回 OK。三步在同一原子脚本内完成，杜绝并发竞态。
 *   - LUA_RELEASE：仅当 ids(id) 仍为指定 owner 时才回收（HDEL ids + HINCRBY owner -1 + DECR global），
 *     返回 1；映射不一致（重复释放/越权释放）返回 0，避免计数漂移。
 */
const LUA_TRY_CREATE = `
  local g = redis.call('INCR', KEYS[1])
  if g > tonumber(ARGV[2]) then
    redis.call('DECR', KEYS[1])
    return 'GLOBAL_CAP'
  end
  local o = redis.call('HINCRBY', KEYS[2], ARGV[1], 1)
  if o > tonumber(ARGV[3]) then
    redis.call('HINCRBY', KEYS[2], ARGV[1], -1)
    redis.call('DECR', KEYS[1])
    return 'QUOTA'
  end
  redis.call('HSET', KEYS[3], ARGV[4], ARGV[1])
  return 'OK'
`;
const LUA_RELEASE = `
  local alive = redis.call('HGET', KEYS[3], ARGV[1])
  if alive == ARGV[2] then
    redis.call('HDEL', KEYS[3], ARGV[1])
    redis.call('HINCRBY', KEYS[2], ARGV[2], -1)
    if redis.call('GET', KEYS[1]) then redis.call('DECR', KEYS[1]) end
    return 1
  end
  return 0
`;

class MemQuota {
  constructor(registryRef) {
    this.registryRef = registryRef; // () => Map
  }
  _list() {
    return this.registryRef() || new Map();
  }
  async tryCreate(owner, id) {
    const all = this._list();
    let ownerCount = 0;
    let globalCount = 0;
    for (const e of all.values()) {
      if (e.status === 'destroyed') continue;
      globalCount++;
      if (e.owner === owner) ownerCount++;
    }
    if (ownerCount >= config.maxEnvsPerOwner) {
      return {
        ok: false,
        code: 'QUOTA',
        status: 429,
        error: `已达每用户环境上限(${config.maxEnvsPerOwner})，请先结束已有环境`,
      };
    }
    if (globalCount >= config.maxConcurrentEnvs) {
      return {
        ok: false,
        code: 'GLOBAL_CAP',
        status: 503,
        error: `全局并发环境已达上限(${config.maxConcurrentEnvs})，请稍后再试`,
      };
    }
    return { ok: true };
  }
  async release() {
    // 内存实现计数从 registry 实时派生，无需额外记账
    return true;
  }
  snapshot() {
    const all = this._list();
    const perOwner = {};
    let global = 0;
    for (const e of all.values()) {
      if (e.status === 'destroyed') continue;
      global++;
      perOwner[e.owner] = (perOwner[e.owner] || 0) + 1;
    }
    return {
      perOwner,
      global,
      maxPerOwner: config.maxEnvsPerOwner,
      maxConcurrent: config.maxConcurrentEnvs,
    };
  }
}

class RedisQuota {
  constructor(redis) {
    this.redis = redis;
  }
  async tryCreate(owner, id) {
    const res = await this.redis.eval(
      LUA_TRY_CREATE,
      3,
      REDIS_KEY_GLOBAL,
      REDIS_KEY_OWNER,
      REDIS_KEY_IDS,
      owner,
      String(config.maxConcurrentEnvs),
      String(config.maxEnvsPerOwner),
      id
    );
    if (res === 'GLOBAL_CAP') {
      return { ok: false, code: 'GLOBAL_CAP', status: 503, error: `全局并发环境已达上限(${config.maxConcurrentEnvs})，请稍后再试` };
    }
    if (res === 'QUOTA') {
      return { ok: false, code: 'QUOTA', status: 429, error: `已达每用户环境上限(${config.maxEnvsPerOwner})，请先结束已有环境` };
    }
    return { ok: true };
  }
  async release(id, owner) {
    // 仅当该 id 仍被记为存活（id->owner 映射一致）时才回收，避免重复释放导致计数漂移
    await this.redis.eval(
      LUA_RELEASE,
      3,
      REDIS_KEY_GLOBAL,
      REDIS_KEY_OWNER,
      REDIS_KEY_IDS,
      id,
      owner
    );
    return true;
  }
  async snapshot() {
    const [global, perOwner] = await Promise.all([
      this.redis.get(REDIS_KEY_GLOBAL).then((v) => (v ? +v : 0)),
      this.redis.hgetall(REDIS_KEY_OWNER).then((o) => o || {}),
    ]);
    // 过滤回落到 0 的残留字段（HINCRBY 不会自动删除值为 0 的 field），
    // 与内存实现（从不存储零计数）保持 /api/stats 输出一致。
    const perOwnerNum = {};
    for (const [k, v] of Object.entries(perOwner)) {
      const n = +v;
      if (n > 0) perOwnerNum[k] = n;
    }
    return {
      perOwner: perOwnerNum,
      global,
      maxPerOwner: config.maxEnvsPerOwner,
      maxConcurrent: config.maxConcurrentEnvs,
    };
  }
}

let instance = null;

/**
 * 获取配额实现单例：REDIS_URL 且 ioredis 可用 → Redis；否则内存。
 * @param {() => Map} registryRef 返回 envManager 的 registry（仅内存实现需要）
 */
function getQuota(registryRef) {
  if (instance) return instance;
  if (process.env.REDIS_URL) {
    try {
      const Redis = require('ioredis');
      const redis = new Redis(process.env.REDIS_URL);
      redis.on('error', (e) => console.error('[quota] Redis 错误：', e.message));
      instance = new RedisQuota(redis);
      console.log('[quota] 使用 Redis 实现（跨实例配额）');
    } catch (e) {
      console.warn('[quota] Redis 不可用，回退内存实现：', e.message);
      instance = new MemQuota(registryRef);
    }
  } else {
    instance = new MemQuota(registryRef);
  }
  return instance;
}

module.exports = { getQuota, MemQuota, RedisQuota, LUA_TRY_CREATE, LUA_RELEASE };
