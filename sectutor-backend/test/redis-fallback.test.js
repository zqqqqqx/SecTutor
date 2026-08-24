/*
 * redis-fallback.test.js — P3 Redis 集成验证（降级路径）。
 *
 * 验证 getQuota 在不满足 Redis 条件时的「优雅降级」：
 *   - REDIS_URL 已设置、但 ioredis 未安装 → 自动回退内存实现（MemQuota），并打印告警；
 *   - 不设置 REDIS_URL → 默认内存实现；
 *   - 必须保证 require('ioredis') 确实会抛错（否则本测试的前提不成立，需更新）。
 *
 * 注意：本沙箱无 Redis 集群，无法实跑真 Redis；该测试覆盖的是「降级契约」而非真链路。
 * 真链路需在装有 Redis + ioredis 的隔离主机验证（见 quota.js RedisQuota）。
 */
process.env.REDIS_URL = 'redis://127.0.0.1:6379/0'; // 故意指向不可用地址

const { MemQuota, RedisQuota, getQuota } = require('../src/quota');

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

async function main() {
  console.log('前提：ioredis 确实不可用（否则降级前提不成立）:');
  let ioredisThrows = false;
  try {
    require('ioredis');
  } catch (e) {
    ioredisThrows = e.code === 'MODULE_NOT_FOUND';
  }
  assert(ioredisThrows, 'require("ioredis") 抛 MODULE_NOT_FOUND（本环境未装）');

  console.log('REDIS_URL 已设但 ioredis 缺失 → 回退内存:');
  const warns = [];
  const origWarn = console.warn;
  console.warn = (...a) => warns.push(a.join(' '));
  let quota;
  try {
    quota = getQuota(() => new Map());
  } finally {
    console.warn = origWarn;
  }
  assert(quota instanceof MemQuota, 'getQuota 返回 MemQuota 实例（已降级）');
  assert(!(quota instanceof RedisQuota), '未返回 RedisQuota（未连真 Redis）');
  assert(warns.some((w) => /回退|fallback|Redis/i.test(w)), '打印了 Redis 回退告警');

  console.log('无 REDIS_URL → 默认内存（用干净模块实例重新判定）:');
  delete process.env.REDIS_URL;
  delete require.cache[require.resolve('../src/quota')]; // 丢弃已缓存的单例，强制重新判定
  const { getQuota: getQuota2, MemQuota: MemQuota2 } = require('../src/quota');
  const q2 = getQuota2(() => new Map());
  assert(q2 instanceof MemQuota2, '无 REDIS_URL 时仍为 MemQuota');

  console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
