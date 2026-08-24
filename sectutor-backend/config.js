/**
 * config.js — SecTutor 临时靶场后端集中配置
 *
 * 所有可调项均可通过环境变量覆盖，便于在开发 / 测试 / 生产之间切换。
 */
const config = {
  // 后端监听端口
  port: +(process.env.PORT || 8787),

  // Docker 守护进程套接字（Windows 命名管道 / Linux unix socket）
  dockerSocket:
    process.env.DOCKER_SOCKET ||
    (process.platform === 'win32'
      ? '//./pipe/docker_engine'
      : '/var/run/docker.sock'),

  /**
   * 仿真模式：置 1 时完全不调用 Docker，仅在内存中登记环境并返回模拟访问地址。
   * 用于无 Docker 的开发 / 单测 / 前端联调；生产务必置 0 并配置真实 Docker。
   */
  simulate: process.env.DOCKER_SIMULATE === '1',

  // —— 生命周期 ——
  absoluteTtlMs: +(process.env.ABS_TTL_MS || 30 * 60 * 1000), // 硬上限：30 分钟
  idleTtlMs: +(process.env.IDLE_TTL_MS || 10 * 60 * 1000),    // 空闲回收：10 分钟无活动
  reclaimIntervalMs: +(process.env.RECLAIM_MS || 30 * 1000),  // 回收扫描间隔

  // —— 配额（每用户）——
  maxEnvsPerOwner: +(process.env.MAX_ENVS_PER_OWNER || 2),

  // —— 配额（全局并发上限，防御资源耗尽型 DoS）——
  maxConcurrentEnvs: +(process.env.MAX_CONCURRENT_ENVS || 20),

  // —— 容器资源硬上限（仅在真实 Docker 下生效）——
  container: {
    memory: +(process.env.ENV_MEM || 256 * 1024 * 1024), // 256 MB
    cpuQuota: +(process.env.ENV_CPU_QUOTA || 50000),      // ≈ 0.5 CPU
    pidsLimit: +(process.env.ENV_PIDS || 128),
    // P2 隔离加固：每个临时环境创建独立的 internal 网络（Docker Internal:true 会移除
    // 默认网关路由，从而实现出站全封锁——靶机无法主动访问公网/内网，且环境间互不可达）；
    // 容器发布端口仅绑定 127.0.0.1，外部不可直达，必须经后端鉴权反向代理
    // （/api/envs/:id/proxy）访问。NetworkMode 在 envManager 中按每环境网络名动态设置。
    startTimeoutMs: +(process.env.ENV_START_TIMEOUT_MS || 15000), // 等待容器 Running/healthy 的超时
  },

  // 主机端口分配区间（避免与常用端口冲突）
  portBase: +(process.env.ENV_PORT_BASE || 40000),
  portRange: +(process.env.ENV_PORT_RANGE || 1000),

  // —— 可插拔运行时（P5：docker / k8s / firecracker）——
  runtime: (process.env.RUNTIME || 'docker').toLowerCase(),
  k8sNamespace: process.env.K8S_NAMESPACE || 'sectutor',
  k8sKubeconfig: process.env.K8S_KUBECONFIG || '', // 为空则走 kubectl 默认上下文
  fcVcpu: +(process.env.FC_VCPU || 1),
  fcMemMib: +(process.env.FC_MEM_MIB || 256),
  fcKernel: process.env.FC_KERNEL || '/var/lib/sectutor/vmlinux',
  fcRootfsDir: process.env.FC_ROOTFS_DIR || '/var/lib/sectutor/rootfs',

  // 开发鉴权令牌（生产需替换为真实 JWT 校验）
  devToken: process.env.DEV_TOKEN || 'sectutor-dev-token',

  /**
   * 允许的跨域来源（CORS）。前端 cybersec-agent 单独打开或经别的端口加载时，
   * 需把其后端请求来源加入此处，否则浏览器会因跨域预检失败而报 "Failed to fetch"。
   * 支持 '*' / 'null'(file://) / 精确 'http://host:port' / 'http://host:*'(同 host 任意端口)。
   * 默认允许本机 localhost / 127.0.0.1 任意端口及 file:// 本地页面。
   */
  corsOrigins: (process.env.CORS_ORIGINS ||
    'http://localhost:*,http://127.0.0.1:*,null').split(',').filter(Boolean),

  // 可选：把前端（如 cybersec-agent）同源自建服务于此后端根路径，彻底避免跨域。
  // 设为前端目录的绝对/相对路径（相对 sectutor-backend 工作目录）即生效；为空则关闭。
  frontendDir: process.env.FRONTEND_DIR || '',

  // 访问地址前缀（容器映射到宿主端口后，用户实际访问的 host）
  host: process.env.PUBLIC_HOST || 'localhost',
};

module.exports = config;
