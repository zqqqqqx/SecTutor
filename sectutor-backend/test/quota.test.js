/*
 * quota.test.js — 配额 / 并发协调单元测试（确定性，无需 Docker）。
 * 直接构造 MemQuota 并注入受控的 registry，验证：
 *   - 每用户配额上限 → QUOTA/429
 *   - 全局并发上限 → GLOBAL_CAP/503
 *   - snapshot 正确计数且忽略已销毁环境
 */
process.env.MAX_ENVS_PER_OWNER = '2';
process.env.MAX_CONCURRENT_ENVS = '3';
const { MemQuota } = require('../src/quota');

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

// 构造受控 registry：entries 为 [{owner, status}]
function regWith(entries) {
  const m = new Map();
  entries.forEach((e, i) => m.set('id' + i, { owner: e.owner, status: e.status || 'running' }));
  return () => m;
}

async function main() {
  console.log('每用户配额上限:');
  let q = new MemQuota(regWith([{ owner: 'u1' }, { owner: 'u1' }]));
  let r = await q.tryCreate('u1', 'new');
  assert(!r.ok && r.code === 'QUOTA' && r.status === 429, 'u1 已有 2 个 → 第三创建返回 QUOTA/429');

  q = new MemQuota(regWith([{ owner: 'u1' }]));
  r = await q.tryCreate('u1', 'new');
  assert(r.ok, 'u1 已有 1 个 → 可再创建');

  console.log('全局并发上限:');
  q = new MemQuota(regWith([{ owner: 'u1' }, { owner: 'u2' }, { owner: 'u3' }]));
  r = await q.tryCreate('u4', 'new');
  assert(!r.ok && r.code === 'GLOBAL_CAP' && r.status === 503, '全局 3 个 → 新创建返回 GLOBAL_CAP/503');

  q = new MemQuota(regWith([{ owner: 'u1' }, { owner: 'u2' }]));
  r = await q.tryCreate('u3', 'new');
  assert(r.ok, '全局 2 个(<3) → 可创建');

  console.log('snapshot 计数与忽略已销毁:');
  q = new MemQuota(regWith([{ owner: 'u1' }, { owner: 'u1', status: 'destroyed' }, { owner: 'u2' }]));
  const s = q.snapshot();
  assert(s.global === 2, 'snapshot.global 忽略 destroyed = 2');
  assert(s.perOwner.u1 === 1 && s.perOwner.u2 === 1, 'perOwner 计数正确');
  assert(s.maxPerOwner === 2 && s.maxConcurrent === 3, 'max 值正确');

  console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
