/*
 * redis-quota.contract.js — P3 Redis 集成验证（契约测试）。
 *
 * 本沙箱无 Redis 集群，无法跑真 ioredis；此处用一份「内存镜像」FakeRedis 实现 Redis 服务端
 * 对那两段 Lua 脚本的语义，从而在不依赖真 Redis/ioredis 的前提下：
 *   1) 断言 RedisQuota 实际调用的是 quota.js 导出的「精确 Lua 脚本常量」（契约刚性）；
 *   2) 端到端验证 tryCreate 的原子预约（全局上限 / 每用户上限，超限回滚）、
 *      release 的幂等释放（重复/越权释放不漂移计数）、snapshot 计数正确。
 *
 * 语义对齐说明：FakeRedis.eval 仅接受 LUA_TRY_CREATE / LUA_RELEASE 两段脚本，其余抛错——
 * 这恰好保证「若 RedisQuota 改用任意其它脚本，测试立刻失败」，把契约锁死。
 *
 * 上限用低值（全局 3 / 每用户 2）以保证确定性。
 */
process.env.MAX_ENVS_PER_OWNER = '2';
process.env.MAX_CONCURRENT_ENVS = '3';

const { RedisQuota, LUA_TRY_CREATE, LUA_RELEASE } = require('../src/quota');

let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) {
    pass++;
    console.log('  ✓ ' + msg);
  } else {
    fail++;
    console.log('  ✗ ' + msg);
  }
}

/** 内存版 Redis：仅实现那两段 Lua 脚本用到的命令语义。 */
class FakeRedis {
  constructor() {
    this.strings = new Map(); // key -> string
    this.hashes = new Map(); // key -> Map(field -> string)
    this.evalCalls = [];
  }
  _int(v) { return v == null ? 0 : Number(v); }
  _hget(h, f) { const m = this.hashes.get(h); return m ? m.get(f) : undefined; }
  _hset(h, f, v) { let m = this.hashes.get(h); if (!m) { m = new Map(); this.hashes.set(h, m); } m.set(f, String(v)); }
  _hdel(h, f) { const m = this.hashes.get(h); if (m) m.delete(f); }
  async get(k) { return this.strings.has(k) ? this.strings.get(k) : null; }
  async hgetall(k) { const m = this.hashes.get(k); if (!m) return {}; const o = {}; for (const [f, v] of m) o[f] = v; return o; }
  async eval(script, numkeys, ...rest) {
    const keys = rest.slice(0, numkeys);
    const args = rest.slice(numkeys);
    this.evalCalls.push({ script, keys, args });
    if (script === LUA_TRY_CREATE) return this._tryCreate(keys, args);
    if (script === LUA_RELEASE) return this._release(keys, args);
    throw new Error('FakeRedis: 收到未预期的 Lua 脚本（契约被破坏）');
  }
  _tryCreate(keys, args) {
    const [gKey, oKey, idKey] = keys;
    const [owner, maxConc, maxPer, id] = args;
    let g = this._int(this.strings.get(gKey)) + 1;
    this.strings.set(gKey, String(g));
    if (g > Number(maxConc)) {
      this.strings.set(gKey, String(g - 1)); // DECR 回滚
      return 'GLOBAL_CAP';
    }
    let o = this._int(this._hget(oKey, owner)) + 1;
    this._hset(oKey, owner, String(o));
    if (o > Number(maxPer)) {
      this._hset(oKey, owner, String(o - 1)); // HINCRBY -1 回滚
      this.strings.set(gKey, String(g - 1)); // DECR 回滚
      return 'QUOTA';
    }
    this._hset(idKey, id, owner); // HSET ids[id]=owner
    return 'OK';
  }
  _release(keys, args) {
    const [gKey, oKey, idKey] = keys;
    const [id, owner] = args;
    const alive = this._hget(idKey, id);
    if (alive === owner) {
      this._hdel(idKey, id); // HDEL ids[id]
      this._hset(oKey, owner, String(this._int(this._hget(oKey, owner)) - 1)); // HINCRBY owner -1
      if (this.strings.has(gKey)) this.strings.set(gKey, String(this._int(this.strings.get(gKey)) - 1)); // DECR global
      return 1;
    }
    return 0; // 映射不一致（重复/越权释放）→ 不漂移
  }
}

async function main() {
  const fr = new FakeRedis();
  const q = new RedisQuota(fr);

  console.log('tryCreate 上限与回滚（全局 3 / 每用户 2）:');
  let r;
  r = await q.tryCreate('u1', 'id_a'); assert(r.ok, 'u1 第 1 个创建 OK');
  r = await q.tryCreate('u1', 'id_b'); assert(r.ok, 'u1 第 2 个创建 OK');
  r = await q.tryCreate('u1', 'id_c'); assert(!r.ok && r.code === 'QUOTA' && r.status === 429, 'u1 第 3 个超每用户上限 → QUOTA/429');
  r = await q.tryCreate('u2', 'id_d'); assert(r.ok, 'u2 第 1 个创建 OK（全局到 3）');
  r = await q.tryCreate('u3', 'id_e'); assert(!r.ok && r.code === 'GLOBAL_CAP' && r.status === 503, 'u3 触发全局上限 → GLOBAL_CAP/503');

  console.log('超限回滚不漂移计数:');
  let s = await q.snapshot();
  assert(s.global === 3, `snapshot.global=3（超限回滚生效），实际 ${s.global}`);
  assert(s.perOwner.u1 === 2 && s.perOwner.u2 === 1, 'perOwner 计数精确（u1=2,u2=1）');
  assert(s.maxPerOwner === 2 && s.maxConcurrent === 3, 'max 值正确');

  console.log('release 幂等（防重复/越权释放导致计数漂移）:');
  await q.release('id_a', 'u1'); // 合法释放
  s = await q.snapshot();
  assert(s.global === 2 && s.perOwner.u1 === 1, '释放 id_a 后 global=2, u1=1');
  await q.release('id_a', 'u1'); // 重复释放：映射已不存在 → 不降级
  s = await q.snapshot();
  assert(s.global === 2 && s.perOwner.u1 === 1, '重复释放 id_a 不改变计数');
  await q.release('id_a', 'u9'); // 越权释放（owner 不匹配）→ 不降级
  s = await q.snapshot();
  assert(s.global === 2 && s.perOwner.u1 === 1, '越权释放不改变计数');
  await q.release('id_ghost', 'u9'); // 未知 id → 安全 no-op
  s = await q.snapshot();
  assert(s.global === 2, '未知 id 释放不改变计数');

  console.log('全部释放后计数归零:');
  await q.release('id_b', 'u1');
  await q.release('id_d', 'u2');
  s = await q.snapshot();
  assert(s.global === 0 && Object.keys(s.perOwner).length === 0, '全部释放后 global=0 且 perOwner 空');

  console.log('契约刚性：RedisQuota 调用的正是导出的精确 Lua 脚本:');
  const calls = fr.evalCalls;
  assert(calls.length > 0, `共发生 ${calls.length} 次 redis.eval 调用`);
  assert(calls.some((c) => c.script === LUA_TRY_CREATE), '使用 LUA_TRY_CREATE（预约脚本）');
  assert(calls.some((c) => c.script === LUA_RELEASE), '使用 LUA_RELEASE（释放脚本）');
  assert(calls.every((c) => c.script === LUA_TRY_CREATE || c.script === LUA_RELEASE), '未调用任何非契约脚本（eval 仅接受这两段）');

  console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
