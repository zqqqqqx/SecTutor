/**
 * base.js — RuntimeBackend 接口约定（鸭子类型，运行时不强制继承此类）。
 *
 * 设计动机（P5 可插拔运行时）：原 envManager 把 dockerode 逻辑硬编码进创建/销毁流程，
 * 无法扩展到 K8s / Firecracker。现把「在隔离运行时中启动一个靶机实例」抽象为 RuntimeBackend，
 * envManager 只负责 registry / 配额 / TTL / 审计 / 回收，运行时不关心这些横切关注点。
 *
 * 接口（统一）：
 *   async create(ctx) -> { proxyHost, proxyPort, resourceId, networkName?, ready? }
 *       ctx = { id, labId, spec, owner, hostPort, absoluteTtlMs }
 *       - proxyHost:proxyPort 为「后端反向代理可达地址」：
 *           Docker = 127.0.0.1:hostPort（回环端口绑定）
 *           K8s    = PodIP:containerPort（后端通常在集群内，直连 PodIP）
 *           FC     = tapIP:port（微 VM 的 tap 设备地址）
 *       - resourceId：实例在运行时内的唯一标识（容器 id / Pod 名 / VM id），destroy 据此定位
 *       - networkName：可选，隔离网络名（Docker internal 网络 / K8s namespace）
 *       - ready：可选，布尔；false 表示已启动但健康检查超时（仅告警，不致命）
 *       - 失败抛错；envManager 负责回滚配额/端口/元数据
 *
 *   async destroy(env) -> void
 *       env 含 resourceId / networkName 等（由 create 写入），运行时据此拆除实例与专属网络
 *
 *   async inspect(env) -> { running: boolean }   // 可选，健康检查
 *
 * 安全约束（所有运行时必须等价满足，与 P2 Docker internal 网络一致）：
 *   - 出站全封锁（靶机无法主动访问公网/内网，防被当跳板或外泄数据）；
 *   - 环境间互不可达；
 *   - 资源硬上限（内存/CPU/PID）+ 最小权限（去能力 / 禁提权 /只读根）；
 *   - 镜像仅用预构建并扫描过的，绝不允许运行时拉取。
 */
module.exports = {};
