/**
 * firecracker.js — FirecrackerRuntime（RuntimeBackend 实现之一，骨架）。
 *
 * Firecracker 用「微 VM（microVM）」而非容器承载每个靶机：启动快、内存开销极低、硬件级隔离，
 * 比容器更强的边界（默认无宿主内核共享）。每个临时环境 = 一个独立微 VM + 一张专属 tap 设备。
 *
 * 隔离等价性（与 P2 Docker internal 网络 / P5 K8s NetworkPolicy 一致）：
 *   - 出站全封锁：在 tap 侧或 VM 内用 nftables 丢弃所有出站（除必要的回环/DNS 白名单），
 *     靶机无法主动访问公网/内网；
 *   - 微 VM 间经不同 tap + 独立网桥 ⇒ 互不可达；
 *   - 资源硬上限：vcpu / 内存 / 文件系统只读（rootfs 用快照，写时复制或 tmpfs）；
 *   - 最小权限：firecracker 进程以非 root + seccomp 运行，仅给 KVM 设备。
 *
 * 后端代理：微 VM 经 tap 接入宿主网桥，后端直连 tapIP:port。
 *
 * 注意：
 *   - 本沙箱无 Firecracker / 特权宿主机，create/destroy 的真实 VMM 调用无法实跑；
 *     真实实现需经 firecracker + jailer（或上层编排）起微 VM、建 tap、下发 nftables 规则。
 *   - buildVMConfig 为纯函数，由契约测试直接校验结构（无需 VMM）。
 *   - create 当前抛 NO_FC 占位，待特权宿主机/VMM 编排就绪后替换为真实调用。
 */
const config = require('../../config');

/** 纯函数：构造微 VM 配置（无需 VMM 即可验证）。 */
function buildVMConfig(ctx) {
  const { id, spec } = ctx;
  const vmId = 'sectutor-' + id;
  // tap 设备名长度受限（Linux 接口名 ≤ 15 字符），用 id 尾段构造
  const tap = 'fc' + id.replace(/[^a-z0-9]/gi, '').slice(-12);
  return {
    vmId,
    tap,
    vcpu: config.fcVcpu,
    mem_mib: config.fcMemMib,
    kernel: config.fcKernel,
    rootfs: `${config.fcRootfsDir}/rootfs-${spec.labId}.ext4`, // 每测试点一套只读根 fs 模板
    internalPort: spec.internalPort,
    egressBlock: true, // 在 tap/VM 侧 nftables 封出站（等价 internal 网络）
  };
}

async function create(ctx) {
  const vm = buildVMConfig(ctx);
  // —— 真实实现占位（需特权宿主机 + VMM 编排）——
  // 实际步骤：
  //   1) 准备 rootfs 快照（基于模板写时复制或 overlay/tmpfs）；
  //   2) 起 firecracker/jailer 微 VM（--kernel-path / --root-drive / --cpu-template / --memory-size / --vcpu-count）；
  //   3) 建 tap 设备并把 VM 接入宿主网桥；
  //   4) 在 tap 侧下发 nftables 规则封出站；
  //   5) 轮询 VM 内靶机端口可达，返回 { proxyHost: tapIP, proxyPort: internalPort, resourceId: vmId }。
  const e = new Error(
    'Firecracker 运行时需要特权宿主机与 VMM 编排（firecracker/jailer），当前环境未配置。'
  );
  e.code = 'NO_FC';
  e.status = 503;
  throw e;
}

async function destroy(env) {
  // —— 真实实现占位 ——
  // 杀微 VM（按 env.resourceId 定位 jailer cgroup/进程）+ 删 tap + 清 nftables 规则 + 回收 rootfs 快照。
  // 本沙箱无 VMM，骨架不执行实际动作。
  return;
}

async function inspect(env) {
  // 真实实现：查询微 VM 是否仍在运行（如检查 jailer 进程或 API）。
  return { running: false };
}

module.exports = { create, destroy, inspect, buildVMConfig };
