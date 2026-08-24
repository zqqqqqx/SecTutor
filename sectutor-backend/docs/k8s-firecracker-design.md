# K8s / Firecracker 可插拔运行时设计文档

> 范围：本文档对应 P5 的「可插拔运行时抽象 + K8s + Firecracker 骨架」交付。
> 目标：把「在隔离运行时中启动一个靶机实例」从硬编码的 dockerode 逻辑中抽离成统一接口，使 Docker / Kubernetes / Firecracker 三者共享同一份编排、配额、TTL、审计、回收逻辑，差异只在「实例落在哪种隔离运行时」。

---

## 1. 动机

原 `envManager.js` 把 dockerode 的 `createContainer / start / inspect / stop / remove` 硬编码进创建 / 销毁流程。这带来两个问题：

1. **无法扩展到容器之外的运行时**。某些部署场景需要比容器更强的边界（硬件级隔离的微 VM）或更云原生的调度（K8s Pod），而编排层不应为每种运行时重写一遍。
2. **横切关注点被污染**。配额、端口分配、TTL、审计、回收是「编排」职责，与「实例用什么技术启动」无关。把它们混在一起，任何运行时改动都要改动核心逻辑。

抽象后的分层：

```
envManager（编排：registry / 配额 / 端口 / TTL / 审计 / 回收）
     │  调用统一接口
     ▼
RuntimeBackend（可插拔：docker / k8s / firecracker）
     │  只负责「在隔离运行时中启动一个靶机实例」与「拆掉它」
     ▼
真实隔离原语：Docker 容器 / K8s Pod / Firecracker microVM
```

---

## 2. RuntimeBackend 接口契约

文件：`src/runtimes/base.js`（接口约定，鸭子类型，运行时不强制继承）。

### 2.1 `async create(ctx) -> { proxyHost, proxyPort, resourceId, networkName?, ready? }`

- **ctx 入参**：`{ id, labId, spec, owner, hostPort, absoluteTtlMs }`
  - `id`：环境唯一 id（registry 主键）
  - `spec`：测试点规格（`labSpecs.js` 映射出的镜像 + `internalPort`）
  - `owner`：配额归属用户
  - `hostPort`：宿主端口（Docker 回环绑定用；K8s / FC 一般不直接用）
  - `absoluteTtlMs`：硬 TTL，用于 Pod annotation 等元数据

- **返回字段语义**：
  - `proxyHost : proxyPort` —— **后端反向代理可达地址**（关键泛化点，见第 4 节）：
    - Docker = `127.0.0.1 : hostPort`（回环端口绑定）
    - K8s = `PodIP : containerPort`（集群内直连 PodIP）
    - Firecracker = `tapIP : internalPort`（微 VM 的 tap 设备地址）
  - `resourceId` —— 实例在运行时内的唯一标识（容器 id / Pod 名 / VM id），`destroy` 据此定位
  - `networkName` —— 可选，隔离网络名（Docker internal 网络名 / K8s namespace）
  - `ready` —— 可选布尔；`false` 表示已启动但健康检查超时（仅告警，不致命）
  - **失败抛错**；envManager 负责回滚配额 / 端口 / 元数据

### 2.2 `async destroy(env) -> void`

- `env` 含 `resourceId` / `networkName` / `id` 等（由 `create` 写入），运行时据此拆除实例与专属网络 / 策略。
- 失败应尽力清理（`.catch(() => {})` 吞掉次级错误），避免泄漏。

### 2.3 `async inspect(env) -> { running: boolean }`（可选）

- 健康检查；envManager 的回收器 / 状态查询可调用。

---

## 3. 安全不变量（所有运行时必须等价满足）

无论实例跑在容器、Pod 还是微 VM，都必须满足与 P2 Docker `Internal: true` 网络一致的四条安全约束（这是合规上线底线，否则不得交付）：

| 不变量 | Docker | K8s | Firecracker |
|---|---|---|---|
| **出站全封锁**（靶机无法主动访问公网 / 内网，防被当跳板或外泄数据） | `Internal: true` 自定义网络（移除默认网关路由） | NetworkPolicy：`policyTypes` 含 `Egress` 且**不写任何 egress 规则** ⇒ 默认全部拒绝 | tap 侧 / VM 内 nftables 丢弃所有出站 |
| **环境间互不可达** | 独立 internal 网络 + 回环端口绑定（无跨容器路由） | 同上 NetworkPolicy 同时拒绝 Ingress | 不同 tap + 独立网桥 |
| **资源硬上限** | Memory / CPU / PIDs cgroups | Pod `resources.limits`（memory / cpu） | vcpu / mem_mib / 只读 rootfs |
| **最小权限** | `CapDrop: ALL` + `no-new-privileges` | `runAsNonRoot` + `readOnlyRootFilesystem` + `drop ALL` + `seccomp RuntimeDefault` + `allowPrivilegeEscalation:false` | firecracker 进程非 root + seccomp，仅给 KVM 设备 |
| **不给集群 / 宿主凭据** | （容器无挂载凭据） | `automountServiceAccountToken: false` | （无 K8s 凭据概念） |
| **镜像仅预构建并扫描过** | 镜像存在性检查（`NO_IMAGE` 引导 `build:images`） | `spec.image`（同一套授权镜像） | 每测试点只读 rootfs 模板 |

> 关键洞察：**出站封锁在 K8s 里不需要逐个写拒绝规则**。NetworkPolicy 默认语义是「无匹配策略则允许；有策略命中但规则为空则拒绝」。因此 `podSelector` 命中本 Pod + `policyTypes: [Ingress, Egress]` + 不写任何规则 ⇒ 该 Pod 的入站与出站都被默认拒绝，恰好等价于 Docker `Internal: true`。

---

## 4. 代理目标泛化（proxyHost / proxyPort）

原 Docker 实现里，代理目标写死为 `127.0.0.1:hostPort`。抽象后，代理目标完全由运行时决定并写入 `env.proxyHost / env.proxyPort`，envManager 只透传、不关心具体地址。

`src/index.js` 的反向代理处理器据此转发：

```js
const proxyHost = env.proxyHost || '127.0.0.1';
const proxyPort = env.proxyPort || env.hostPort;
const target = `http://${proxyHost}:${proxyPort}${targetPath}`;
```

这样：

- **Docker**：`proxyHost=127.0.0.1`、`proxyPort=hostPort`，与旧行为完全一致（回环绑定，外部不可直达）。
- **K8s**：`proxyHost=PodIP`、`proxyPort=containerPort`。前提是后端自身也跑在集群内（或经 ClusterIP Service），可直接路由到 PodIP。
- **Firecracker**：`proxyHost=tapIP`、`proxyPort=internalPort`。微 VM 经 tap 接入宿主网桥，后端直连 tapIP。

> 边界：K8s / Firecracker 的真实代理可达性依赖于后端与实例在同一网络平面（集群内 / 同一宿主网桥）。跨网络平面的代理（如集群外访问 PodIP）需额外 Service / 端口映射，不在本骨架范围。

---

## 5. 三种运行时实现现状

### 5.1 Docker（`src/runtimes/docker.js`，生产可用）

- 从 `envManager.js` 迁移出来的真实 dockerode 逻辑：自定义 internal 网络、回环端口绑定、`CapDrop: ALL` + `no-new-privileges` + 资源硬上限、镜像存在性检查、健康检查轮询（`Running/healthy` 超时标记 warn 不致命）、销毁 `stop → remove({ force, v })` 一并清匿名卷。
- `getDocker()` 懒加载 dockerode，模块顶层不依赖该 SDK，可在无 Docker 环境加载（仿真 / 单测）。
- 默认运行时（`RUNTIME` 缺省 = `docker`）。

### 5.2 Kubernetes（`src/runtimes/k8s.js`，骨架 + 结构可验证）

- `buildPodSpec(ctx)` / `buildDenyEgressPolicy(ctx)` 为**纯函数**，无需 SDK / 集群即可由契约测试直接校验结构（见第 6 节）。
- `create` / `destroy` / `inspect` 懒加载 `@kubernetes/client-node`，真实 API 调用需在可访问的隔离集群中验证（本沙箱无集群，未实跑）。
- 已覆盖的安全清单：`runAsNonRoot` + `readOnlyRootFilesystem` + `drop ALL` + `seccomp RuntimeDefault` + `allowPrivilegeEscalation:false`；`resources.limits`（memory / cpu）；`restartPolicy: Never`；`automountServiceAccountToken: false`；Pod 命名 `sectutor-<id>`，打 `sectutor.dev/env` + `sectutor.dev/owner` 标签；NetworkPolicy deny-all 入站 + 出站。
- 失败路径回滚：策略创建失败先删已建 Pod；Pod 超时先删 Pod + 策略，再抛 `POD_TIMEOUT/502`。

### 5.3 Firecracker（`src/runtimes/firecracker.js`，骨架 + 配置可验证）

- `buildVMConfig(ctx)` 为**纯函数**：`vmId = sectutor-<id>`、`tap`（Linux 接口名 ≤ 15 字符，用 id 尾段构造）、`vcpu` / `mem_mib` / `kernel` / 每测试点只读 `rootfs` 模板、`internalPort`、`egressBlock: true`。
- `create` 当前抛 `NO_FC`（503）占位 —— 真实实现需特权宿主机 + VMM 编排（firecracker / jailer 起微 VM、建 tap、下发 nftables、轮询端口可达）。
- `destroy` / `inspect` 为占位（无 VMM 不执行实际动作）。

---

## 6. 工厂与测试注入

`src/runtimes/index.js`：

- `getRuntime()`：按 `config.runtime`（`docker` / `k8s` / `kubernetes` / `firecracker` / `fc`）选择实现，单例缓存。
- `setRuntime(r)`：供测试注入 `FakeRuntime`，或未来运行时热切换；传 `null` 清空缓存以便按 config 重新选择。

`test/runtime.contract.js`（29 断言）验证了：

1. 三个运行时**无需 SDK / 集群**即可 `require` 加载，且都导出 `create` / `destroy`；
2. K8s Pod 结构：`readOnlyRootFilesystem` / `drop: ['ALL']` / `seccompProfile RuntimeDefault` / `resources.limits` / `restartPolicy: Never` / `automountServiceAccountToken: false`；NetworkPolicy：`policyTypes: [Ingress, Egress]` 且无 ingress / egress 规则（deny-all）；
3. Firecracker：`egressBlock: true` / `tap` ≤ 15 字符 / 每测试点独立 `rootfs`；
4. **envManager 通过注入 FakeRuntime 委托真实路径**（无 Docker）：`create` 返回的 `proxyHost / proxyPort / resourceId` 正确写入 `env`，`destroy` 被调用，`registry` 在销毁后清除。

> 这套契约测试是「沙箱无 Docker / K8s / Firecracker 集群」前提下，关闭验证缺口的关键手段：用纯函数结构断言 + FakeRuntime 委托断言，证明抽象层与三种运行时的接口契约成立，而无需真实集群。

---

## 7. 配置项（`config.js` 新增）

| 配置键 | 环境变量 | 默认 | 说明 |
|---|---|---|---|
| `runtime` | `RUNTIME` | `docker` | 运行时选择：`docker` / `k8s` / `firecracker` |
| `k8sNamespace` | `K8S_NAMESPACE` | `sectutor` | K8s 命名空间 |
| `k8sKubeconfig` | `K8S_KUBECONFIG` | `''` | 为空则走 kubectl 默认上下文 |
| `fcVcpu` | `FC_VCPU` | `1` | 微 VM vCPU 数 |
| `fcMemMib` | `FC_MEM_MIB` | `256` | 微 VM 内存（MiB） |
| `fcKernel` | `FC_KERNEL` | `/var/lib/sectutor/vmlinux` | 微 VM 内核路径 |
| `fcRootfsDir` | `FC_ROOTFS_DIR` | `/var/lib/sectutor/rootfs` | 只读 rootfs 模板目录 |

---

## 8. 沙箱边界（诚实声明）

本开发 / 隔离环境**没有 Docker 守护进程、没有 K8s 集群、没有 Firecracker VMM / 特权宿主机**。因此：

- **Docker 真实路径**：代码完整，但本仓只能以仿真模式（`DOCKER_SIMULATE=1`）冒烟验证；真实联调需可访问 Docker 守护进程的主机。
- **K8s / Firecracker 真实路径**：仅交付骨架（纯函数结构 + 懒加载 SDK 占位 + `NO_FC` 占位）。结构正确性由契约测试保证；真实链路需在对应隔离集群 / 特权宿主机中补全并验证。
- 任何「已在集群实跑」的声称都是不诚实的；本交付仅保证**抽象层正确**与**契约成立**。

---

## 9. 后续落地清单（待集群 / 特权宿主机就绪）

- [ ] K8s：部署 `create` / `destroy` 到真实隔离集群，验证 Pod Running 后 `podIP` 可达、NetworkPolicy 真正阻断出站（用 `kubectl exec` 测外网连通性）。
- [ ] K8s：补充 ServiceAccount / RBAC（仅允许 sectutor 命名空间内 create/delete Pod + NetworkPolicy）。
- [ ] Firecracker：实现 `create` 真实起微 VM（firecracker / jailer）、建 tap、下发 nftables 封出站、轮询端口可达；`destroy` 杀 VM + 删 tap + 清规则 + 回收 rootfs 快照。
- [ ] Firecracker：特权宿主机的 jailer 隔离（独立用户 / cgroup / chroot）+ seccomp 策略文件。
- [ ] 三者统一补 `inspect` 到回收器（当前 Docker 走端口探活，K8s / FC 走各自 inspect）。
- [ ] 把 `audit.js` 的开关缓冲换持久化（防进程重启丢审计），接口不变。
