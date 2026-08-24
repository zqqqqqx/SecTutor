/*
 * audit.test.js — 审计事件流模块单测（确定性，无需 Docker）。
 * 直接构造 audit 模块，验证：
 *   - record 写入、list 最新优先与按 type/owner 过滤；
 *   - summary 按类型计数 + 30 个时间桶趋势；
 *   - 环形缓冲封顶（MAX_EVENTS），超出丢弃最旧；
 *   - 非法输入（未知类型 / owner 缺失）抛错。
 */
const audit = require('../src/audit');

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
  audit.__resetForTest();

  console.log('record + list 最新优先:');
  audit.record({ type: 'create', owner: 'u1', envId: 'e1', labId: 'lab_sqli' });
  audit.record({ type: 'destroy', owner: 'u1', envId: 'e1', labId: 'lab_sqli' });
  let list = audit.list({ limit: 10 });
  assert(list.length === 2, '共 2 条事件');
  assert(list[0].type === 'destroy', 'list 最新优先（首条为 destroy）');

  console.log('list 过滤:');
  audit.__resetForTest();
  audit.record({ type: 'create', owner: 'u1', envId: 'e1' });
  audit.record({ type: 'reclaim', owner: 'u2', envId: 'e2' });
  audit.record({ type: 'create', owner: 'u2', envId: 'e3' });
  assert(audit.list({ type: 'create' }).length === 2, '按 type=create 过滤得 2 条');
  assert(audit.list({ owner: 'u2' }).length === 2, '按 owner=u2 过滤得 2 条');
  assert(audit.list({ type: 'create', owner: 'u2' }).length === 1, 'type+owner 组合过滤得 1 条');

  console.log('summary 计数 + 时间桶:');
  const s = audit.summary();
  assert(s.total === 3, `summary.total=3（实际 ${s.total}）`);
  assert(s.byType.create === 2 && s.byType.reclaim === 1, 'byType 计数正确');
  assert(Array.isArray(s.buckets) && s.buckets.length === 30, 'buckets 为 30 个时间桶');
  assert(s.buckets.every((b) => typeof b.count === 'number'), '每个桶含 count');

  console.log('环形缓冲封顶:');
  audit.__resetForTest();
  const N = audit.MAX_EVENTS + 50;
  for (let i = 0; i < N; i++) audit.record({ type: 'create', owner: 'u', detail: 'seq' + i });
  const capped = audit.list({ limit: 100000 });
  assert(capped.length === audit.MAX_EVENTS, `缓冲封顶为 MAX_EVENTS=${audit.MAX_EVENTS}（实际 ${capped.length}）`);
  assert(!capped.some((e) => e.detail === 'seq0'), '最旧的 seq0 已被丢弃');

  console.log('非法输入抛错:');
  let threwType = false, threwOwner = false;
  try { audit.record({ type: 'bogus', owner: 'u' }); } catch { threwType = true; }
  try { audit.record({ type: 'create' }); } catch { threwOwner = true; }
  assert(threwType, '未知事件类型抛错');
  assert(threwOwner, 'owner 缺失抛错');

  console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
