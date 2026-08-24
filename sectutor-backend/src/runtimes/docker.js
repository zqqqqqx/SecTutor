/**
 * docker.js — DockerRuntime（RuntimeBackend 实现之一）。
 *
 * 把原 envManager 内联的 dockerode 逻辑整体迁移过来，行为与原先完全一致：
 *   - 每环境独立 Internal:true 网络（Docker 移除默认网关路由 ⇒ 出站全封锁 + 环境间互不可达）；
 *   - 容器发布端口仅绑定 127.0.0.1（外部不可直达，必须经后端鉴权反向代理）；
 *   - 资源硬上限（内存/CPU/PID）+ CapDrop:ALL + no-new-privileges；
 *   - 镜像存在性检查（缺失报 NO_IMAGE 引导 build:images）+ 健康检查等待 + 失败回滚容器/网络。
 *
 * dockerode 懒加载（getDocker 内 require），模块顶层不依赖 dockerode，便于无 Docker 环境仅加载。
 */
const config = require('../../config');

let docker = null;
let dockerError = null;

function getDocker() {
  if (docker === null) {
    try {
      const Docker = require('dockerode');
      docker = new Docker({ socketPath: config.dockerSocket });
    } catch (e) {
      docker = false;
      dockerError = e.message;
    }
  }
  return docker || null;
}

/**
 * 轮询容器状态直到 Running（或启动失败）。
 * @returns {Promise<boolean>} true=已运行；false=超时仍未确认（可能仍在启动）。
 */
async function waitForRunning(container, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 15000);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let info;
    try { info = await container.inspect(); } catch (e) { return false; }
    const st = info.State || {};
    if (st.Running) return true;
    if (st.Status === 'exited' || st.Status === 'dead') {
      throw Object.assign(
        new Error('容器启动后立即退出（' + (st.Error || (st.OOMKilled ? '内存超限 OOMKilled' : '非 0 退出')) + '）'),
        { code: 'CONTAINER_EXITED', status: 502 }
      );
    }
    if (Date.now() >= deadline) return false;
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function create(ctx) {
  const { id, owner, spec, hostPort } = ctx;
  const d = getDocker();
  if (!d) {
    const e = new Error(
      'Docker 不可用（' + (dockerError || '未连接守护进程') + '）。开发/测试可设置 DOCKER_SIMULATE=1 启用仿真模式。'
    );
    e.code = 'NO_DOCKER';
    e.status = 503;
    throw e;
  }

  let container = null;
  let net = null;
  try {
    // 镜像必须预先构建并扫描（绝不运行时拉取），否则给出明确引导
    const img = d.getImage(spec.image);
    try {
      await img.inspect();
    } catch (e) {
      throw Object.assign(
        new Error(`所需镜像未构建或不存在：${spec.image}（请先运行 npm run build:images 构建并 npm run scan:images 扫描）`),
        { code: 'NO_IMAGE', status: 502 }
      );
    }

    // 每环境独立 internal 网络：Internal:true 移除默认网关路由，实现出站全封锁
    // （靶机无法主动访问公网/内网，防被当跳板或外泄数据），且环境间互不可达。
    const netName = 'sectutor_' + id;
    net = await d.createNetwork({
      Name: netName,
      Driver: 'bridge',
      Internal: true,
      CheckDuplicate: true,
      Labels: { 'sectutor.env': id, 'sectutor.owner': owner },
    });

    const portKey = `${spec.internalPort}/tcp`;
    container = await d.createContainer({
      Image: spec.image,
      ExposedPorts: { [portKey]: {} },
      HostConfig: {
        // 仅绑定回环地址：外部主机不可直达容器，必须经后端反向代理访问（反向代理隔离）
        PortBindings: { [portKey]: [{ HostIp: '127.0.0.1', HostPort: String(hostPort) }] },
        Memory: config.container.memory,
        CpuQuota: config.container.cpuQuota,
        PidsLimit: config.container.pidsLimit,
        NetworkMode: netName, // 接入本环境隔离的 internal 网络
        CapDrop: ['ALL'], // 剥离全部 Linux capabilities
        SecurityOpt: ['no-new-privileges'], // 禁止提权
        AutoRemove: false,
        ReadonlyRootfs: false, // 模板镜像保留可写；生产可置 true + tmpfs
      },
    });
    await container.start();
    // 等待容器真正进入 Running（并尽量等待健康检查通过），避免提前返回不可达地址
    const ready = await waitForRunning(container, config.containerStartTimeoutMs);
    return {
      proxyHost: '127.0.0.1', // 回环绑定 ⇒ 后端代理直连本机端口
      proxyPort: hostPort,
      resourceId: container.id,
      networkName: netName,
      ready,
    };
  } catch (e) {
    // 回滚已创建的资源，避免容器/网络泄漏
    if (container) {
      try {
        await container.stop().catch(() => {});
        await container.remove({ force: true, v: true }).catch(() => {});
      } catch (_) { /* 忽略清理失败 */ }
    }
    if (net) {
      try { await net.remove().catch(() => {}); } catch (_) { /* 忽略清理失败 */ }
    }
    throw e;
  }
}

async function destroy(env) {
  const d = getDocker();
  if (!d) return;
  if (env.resourceId) {
    try {
      const c = d.getContainer(env.resourceId);
      await c.stop().catch(() => {}); // 已停止则忽略
      await c.remove({ force: true, v: true }).catch(() => {}); // v:true 一并清理匿名卷，避免磁盘泄漏
    } catch (e) {
      // 容器可能已被手动清理，记录但不阻断元数据清理
    }
  }
  if (env.networkName) {
    try {
      await d.getNetwork(env.networkName).remove().catch(() => {});
    } catch (e2) {
      // 网络可能已不存在，忽略
    }
  }
}

async function inspect(env) {
  const d = getDocker();
  if (!d || !env.resourceId) return { running: false };
  try {
    const info = await d.getContainer(env.resourceId).inspect();
    return { running: !!(info.State && info.State.Running) };
  } catch (e) {
    return { running: false };
  }
}

module.exports = { create, destroy, inspect, _getDocker: getDocker };
