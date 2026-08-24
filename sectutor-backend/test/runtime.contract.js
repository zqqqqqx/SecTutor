/*
 * runtime.contract.js — P5 可插拔运行时契约测试（无需 Docker/K8s/Firecracker 集群）。
 *
 * 验证：
 *   1) 三个运行时模块均可在无 SDK 时加载，且实现 create/destroy 接口（鸭子类型）；
 *   2) K8sRuntime.buildPodSpec / buildDenyEgressPolicy 产出结构合法——
 *      只读根文件系统、drop ALL caps、禁提权、seccomp RuntimeDefault、资源硬上限、
 *      重启策略 Never、不挂 SA token、NetworkPolicy 全封出站+拒绝入站（等价 internal 网络）；
 *   3) FirecrackerRuntime.buildVMConfig 产出微 VM 配置（egressBlock 标记、vcpu/内存/端口）；
 *   4) envManager 在真实路径下正确委托运行时：create 获得 proxyHost/proxyPort/resourceId，
 *      destroy 调用运行时——用注入的 FakeRuntime 在无 Docker 下跑通（弥补沙箱无 Docker 的验证缺口）。
 *
 * 注意：K8s/Firecracker 的 create/destroy 真实 API 调用需集群/特权宿主机，本测试不触发（仅测
 * 纯结构与委托契约）。真链路需在隔离集群/宿主机验证。
 */
// 必须在 require config/envManager 之前设定，确保 simulate=false 走真实运行时路径
process.env.DOCKER_SIMULATE = '0';

const { getSpec } = require('../src/labSpecs');
const dockerRt = require('../src/runtimes/docker');
const k8sRt = require('../src/runtimes/k8s');
const fcRt = require('../src/runtimes/firecracker');
const factory = require('../src/runtimes');

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

function makeCtx(labId) {
  const spec = getSpec(labId);
  return { id: 'env_abc123', labId, spec, owner: 'demo-user', hostPort: 40001, absoluteTtlMs: 1000 };
}

async function main() {
  console.log('运行时模块可加载且实现接口:');
  for (const [name, rt] of [['docker', dockerRt], ['k8s', k8sRt], ['firecracker', fcRt]]) {
    assert(typeof rt.create === 'function' && typeof rt.destroy === 'function', `${name} 实现 create/destroy`);
  }

  console.log('K8s Pod 隔离结构（等价 internal 网络）:');
  const pod = k8sRt.buildPodSpec(makeCtx('lab_sqli'));
  assert(pod.kind === 'Pod' && pod.metadata.name === 'sectutor-env_abc123', 'Pod 名 sectutor-<id>');
  const c = pod.spec.containers[0];
  assert(c.securityContext.readOnlyRootFilesystem === true, '只读根文件系统');
  assert(Array.isArray(c.securityContext.capabilities.drop) && c.securityContext.capabilities.drop.includes('ALL'), 'drop ALL capabilities');
  assert(c.securityContext.allowPrivilegeEscalation === false, '禁止提权');
  assert(c.securityContext.runAsNonRoot === true, 'runAsNonRoot');
  assert(c.securityContext.seccompProfile && c.securityContext.seccompProfile.type === 'RuntimeDefault', 'seccomp RuntimeDefault');
  assert(c.resources && c.resources.limits && c.resources.limits.memory && /m$/.test(c.resources.limits.cpu), '资源硬上限（内存 + CPU 毫核）');
  assert(c.ports[0].containerPort === 3000, '容器端口=spec.internalPort(3000)');
  assert(pod.spec.restartPolicy === 'Never', 'restartPolicy=Never');
  assert(pod.spec.automountServiceAccountToken === false, '不挂 SA token（不给靶机集群凭据）');

  console.log('K8s NetworkPolicy 全封出站 + 拒绝入站:');
  const pol = k8sRt.buildDenyEgressPolicy(makeCtx('lab_sqli'));
  assert(pol.kind === 'NetworkPolicy', 'NetworkPolicy 类型');
  assert(pol.spec.policyTypes.includes('Egress') && pol.spec.policyTypes.includes('Ingress'), 'policyTypes 含 Egress+Ingress');
  assert(!pol.spec.egress, '无 egress 规则 ⇒ 默认全部拒绝出站（防数据外泄/跳板）');
  assert(!pol.spec.ingress, '无 ingress 规则 ⇒ 环境间互不可达');
  assert(pol.spec.podSelector.matchLabels['sectutor.dev/env'] === 'env_abc123', 'podSelector 命中本环境');

  console.log('Firecracker 微 VM 配置:');
  const vm = fcRt.buildVMConfig(makeCtx('lab_xss'));
  assert(vm.egressBlock === true, 'egressBlock 标记（tap 侧封出站，等价 internal 网络）');
  assert(typeof vm.vcpu === 'number' && typeof vm.mem_mib === 'number', 'vcpu/内存 数值');
  assert(vm.internalPort === 3000, '内部端口=spec.internalPort');
  assert(typeof vm.tap === 'string' && vm.tap.length <= 15, 'tap 设备名长度 ≤ 15');
  assert(/lab_xss/.test(vm.rootfs), 'rootfs 含测试点标识（每点独立只读根 fs）');

  console.log('envManager 委托运行时（FakeRuntime 注入，无需 Docker）:');
  let created = 0, destroyed = 0, lastCtx = null, lastEnv = null;
  const fakeRuntime = {
    async create(ctx) {
      created++;
      lastCtx = ctx;
      return { proxyHost: '10.0.0.5', proxyPort: ctx.spec.internalPort, resourceId: 'fake-' + ctx.id, networkName: 'fake-net' };
    },
    async destroy(env) { destroyed++; lastEnv = env; },
  };
  factory.setRuntime(fakeRuntime); // 注入，覆盖默认 docker 运行时
  const envManager = require('../src/envManager');

  const spec = getSpec('lab_sqli');
  const env = await envManager.createEnv('lab_sqli', 'demo-user');
  assert(env.proxyHost === '10.0.0.5' && env.proxyPort === spec.internalPort, 'env 写入运行时返回的 proxyHost/proxyPort');
  assert(env.resourceId && env.resourceId === 'fake-' + env.id, 'resourceId 由运行时写入（fake-<id>）');
  assert(created === 1 && lastCtx && lastCtx.id === env.id, 'runtime.create 被调用且 ctx 含 id');
  assert(env.status === 'running', '真实路径下状态置为 running');

  await envManager.destroyEnv(env.id, 'demo-user');
  assert(destroyed === 1 && lastEnv && lastEnv.id === env.id, 'runtime.destroy 被调用');
  const gone = envManager.getEnv(env.id);
  assert(gone === null, '销毁后 registry 已移除');
  factory.setRuntime(null); // 复位，避免影响其它（若有）

  console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
