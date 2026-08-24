/*
 * edgecases.js — 核心功能与边界情况覆盖（无需 Docker）。
 *
 * 目标：用一套更完整的用例暴露潜在缺陷，覆盖：
 *   - envManager 生命周期：创建（仿真）/ 查询 / 列举（按 owner 过滤、排除已销毁）/
 *     未知 labId → NO_SPEC / 重复销毁 → NOT_FOUND / 越权销毁 → FORBIDDEN / 审计落地。
 *   - 配额：每用户上限预约与拒绝（QUOTA 429）、snapshot 计数正确。
 *   - 审计：未知类型/缺失 owner 抛错、list 过滤、环形封顶、summary 结构。
 *   - 鉴权：extractToken 三级优先级、ownerForToken、requireAuth 门禁。
 *   - 回收：空闲 TTL 回收、绝对 TTL 回收、最近有活动（touch）则不被空闲回收。
 *
 * 各节通过重置（audit.__resetForTest）与及时销毁保证互不污染。
 */
process.env.DOCKER_SIMULATE = '1'; // 仿真路径覆盖生命周期，避免依赖 Docker

const config = require('../config');
const envManager = require('../src/envManager');
const quota = envManager.quota;
const audit = require('../src/audit');
const auth = require('../src/auth');
const reclaim = require('../src/reclaim');

let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ ' + msg); }
}
async function expectThrow(fn, code, msg) {
  try { await fn(); fail++; console.log('  ✗ ' + msg + '（预期抛错但未抛）'); }
  catch (e) { assert(e.code === code, `${msg}（code=${e.code}）`); }
}

async function main() {
  // ============ 1. envManager 生命周期 ============
  console.log('envManager 生命周期（仿真路径）:');
  const e1 = await envManager.createEnv('lab_sqli', 'u1');
  assert(e1.status === 'running' && e1.simulated === true, '仿真创建：running + simulated');
  assert(e1.accessUrl === null, '仿真创建：accessUrl 为 null（前端走本地仿真）');
  assert(typeof e1.hostPort === 'number' && e1.id.startsWith('env_'), '分配了 hostPort 与 env id');
  assert(envManager.getEnv(e1.id) === e1, 'getEnv 返回同一对象');

  const e2 = await envManager.createEnv('lab_cmdi', 'u1');
  const listed = envManager.listEnvs('u1').map((x) => x.id);
  assert(listed.includes(e1.id) && listed.includes(e2.id), 'listEnvs 含本用户环境');
  assert(envManager.listEnvs('other').length === 0, 'listEnvs 不含其他用户环境');

  await expectThrow(() => envManager.createEnv('no_such_lab', 'u1'), 'NO_SPEC', '未知 labId 创建拒绝');
  assert(audit.list({ type: 'create_denied' }).some((x) => x.labId === 'no_such_lab'), '未知 labId 记录了 create_denied 审计');

  // 审计：create 事件落地
  assert(audit.list({ type: 'create', owner: 'u1' }).some((x) => x.envId === e1.id), 'create 审计事件含正确 envId/owner');

  // 越权销毁 → FORBIDDEN
  await expectThrow(() => envManager.destroyEnv(e2.id, 'u2'), 'FORBIDDEN', '越权（非 admin）销毁拒绝');
  // 正确销毁 e2
  const d2 = await envManager.destroyEnv(e2.id, 'u1');
  assert(d2.status === 'destroyed', '正确所有者销毁返回 destroyed');
  assert(envManager.getEnv(e2.id) === null, '销毁后 getEnv 为 null');
  assert(envManager.listEnvs('u1').every((x) => x.id !== e2.id), '列举已排除已销毁环境');
  assert(audit.list({ type: 'destroy', owner: 'u1' }).some((x) => x.envId === e2.id), 'destroy 审计事件落地');

  // 重复销毁 → NOT_FOUND（registry 已移除）
  await expectThrow(() => envManager.destroyEnv(e2.id, 'u1'), 'NOT_FOUND', '重复销毁返回 NOT_FOUND');

  // 销毁 e1 收尾
  await envManager.destroyEnv(e1.id, 'u1');

  // ============ 2. 配额每用户上限 ============
  console.log('配额每用户上限:');
  audit.__resetForTest();
  const q1 = await envManager.createEnv('lab_sqli', 'qowner');
  const q2 = await envManager.createEnv('lab_cmdi', 'qowner');
  const snapBefore = quota.snapshot();
  assert(snapBefore.perOwner['qowner'] === 2, 'snapshot 反映 qowner 占 2 个环境');
  await expectThrow(() => envManager.createEnv('lab_xss', 'qowner'), 'QUOTA', '超过每用户上限被 QUOTA 拒绝（429）');
  const snapAfter = quota.snapshot();
  assert(snapAfter.perOwner['qowner'] === 2, '被拒的创建不占用配额名额（仍为 2）');
  assert(audit.list({ type: 'create_denied', owner: 'qowner' }).some((x) => x.detail === 'QUOTA'), 'QUOTA 拒绝记入审计 detail=QUOTA');
  await envManager.destroyEnv(q1.id, 'qowner');
  await envManager.destroyEnv(q2.id, 'qowner');
  assert(quota.snapshot().perOwner['qowner'] === undefined, '全部销毁后 qowner 计数清零');

  // ============ 3. 审计不变量 ============
  console.log('审计不变量:');
  audit.__resetForTest();
  await expectThrow(() => audit.record({ type: 'bogus', owner: 'x' }), undefined, '未知事件类型抛错');
  await expectThrow(() => audit.record({ type: 'create' }), undefined, '缺失 owner 抛错');
  audit.record({ type: 'create', owner: 'a', envId: 'e1', labId: 'lab_sqli' });
  audit.record({ type: 'destroy', owner: 'a', envId: 'e1', labId: 'lab_sqli' });
  audit.record({ type: 'create', owner: 'b', envId: 'e2', labId: 'lab_cmdi' });
  assert(audit.list({ type: 'create' }).length === 2, 'list 按 type 过滤');
  assert(audit.list({ owner: 'a' }).length === 2 && audit.list({ owner: 'b' }).length === 1, 'list 按 owner 过滤');
  const sum = audit.summary();
  assert(sum.total === 3, 'summary.total 正确');
  assert(sum.byType.create === 2 && sum.byType.destroy === 1, 'summary.byType 正确');
  assert(Array.isArray(sum.buckets) && sum.buckets.length === 30, 'summary 含 30 个时间桶');
  assert(sum.buckets[sum.buckets.length - 1].count >= 1, '最近桶含当前事件');

  // 环形封顶
  audit.__resetForTest();
  for (let i = 0; i < audit.MAX_EVENTS + 50; i++) audit.record({ type: 'create', owner: 'x' });
  assert(audit.summary().total === audit.MAX_EVENTS, `环形封顶到 ${audit.MAX_EVENTS}（最旧丢弃）`);

  // ============ 4. 鉴权解析 ============
  console.log('鉴权解析:');
  const fakeReq = (over) => Object.assign({ headers: {}, query: {}, cookies: {} }, over);
  assert(auth.extractToken(fakeReq({ headers: { authorization: 'Bearer tok' } })) === 'tok', 'Bearer 令牌优先');
  assert(auth.extractToken(fakeReq({ query: { t: 'qt' } })) === 'qt', '查询参数 ?t= 次之');
  assert(auth.extractToken(fakeReq({ headers: { cookie: 'sectutor_pt=ck' } })) === 'ck', 'cookie 再次之');
  assert(auth.extractToken(fakeReq({})) === null, '无任何令牌返回 null');
  assert(auth.ownerForToken(config.devToken) === 'demo-user', 'devToken → demo-user');
  assert(auth.ownerForToken('wrong') === null, '错误令牌 → null');
  let nexted = false;
  auth.requireAuth(fakeReq({ headers: { authorization: 'Bearer ' + config.devToken } }), {}, () => { nexted = true; });
  assert(nexted === true, 'requireAuth 合法令牌放行 next');
  let status401 = null;
  auth.requireAuth(fakeReq({}), { status(s) { status401 = s; return { json() {} }; } }, () => {});
  assert(status401 === 401, 'requireAuth 无令牌返回 401');

  // ============ 5. 回收：空闲 / 绝对 / 活动豁免 ============
  console.log('回收器（空闲/绝对 TTL + 活动豁免）:');
  audit.__resetForTest();
  config.idleTtlMs = 1; // 极小空闲阈值，便于确定性触发
  config.absoluteTtlMs = 30 * 60 * 1000; // 绝对 TTL 保持默认，避免干扰

  // 空闲回收：lastActiveAt 陈旧
  const r1 = await envManager.createEnv('lab_sqli', 'ruser');
  r1.lastActiveAt = Date.now() - 60000;
  await reclaim.tick();
  assert(envManager.getEnv(r1.id) === null, '空闲超时（lastActiveAt 陈旧）被回收');
  assert(audit.list({ type: 'reclaim' }).some((x) => x.envId === r1.id), '空闲回收记入审计 reclaim');

  // 最近有活动 → 不被空闲回收（验证 touchEnv 机制，也是反向代理刷新活跃度的修复点）
  const r2 = await envManager.createEnv('lab_cmdi', 'ruser');
  envManager.touchEnv(r2.id); // 模拟代理访问刷新活跃度
  await reclaim.tick();
  assert(envManager.getEnv(r2.id) !== null, '刚有活动（touch）的环境不被空闲回收');

  // 绝对 TTL 回收
  config.absoluteTtlMs = 1;
  const r3 = await envManager.createEnv('lab_xss', 'ruser');
  r3.expiresAt = Date.now() - 1000;
  await reclaim.tick();
  assert(envManager.getEnv(r3.id) === null, '绝对 TTL 过期被回收');
  assert(reclaim.getStats().reclaimed >= 2, '回收器统计 reclaimed 累计（空闲+绝对两次回收）');

  // 清理剩余
  if (envManager.getEnv(r2.id)) await envManager.destroyEnv(r2.id, 'ruser');
  // 复位 TTL 配置（本文件独立进程，影响范围仅限本文件）
  config.idleTtlMs = 10 * 60 * 1000;
  config.absoluteTtlMs = 30 * 60 * 1000;

  console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
