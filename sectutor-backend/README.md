# SecTutor 临时靶场后端

为每个前端「测试点」动态创建**隔离的临时演练环境**，测试结束（或超过 TTL）后**自动销毁并释放资源**，且不影响原有靶场环境与其他用户。

> 本服务是独立项目，与离线版前端 `sec-tutor` 单页应用解耦：前端通过 HTTP 调用本服务；后端不可用时前端自动回退到浏览器内仿真演练。

## 架构

```
前端 SecTutor
   │  POST /api/envs {labId}
   ▼
API 网关 / 鉴权(Bear令牌 → owner)         ← 当前为 dev token stub，生产换 JWT
   │
环境编排(EnvManager) ── 内存元数据登记(registry) + 端口分配 + 配额/TTL
   │
可插拔运行时(RuntimeBackend) ── Docker / K8s / Firecracker 三选一，等价隔离(每用户标签 / 资源硬上限 / 最小权限 / 网络出站全封锁)
   │
后台回收器 ── 绝对TTL(30m) + 空闲TTL(10m) 双保险回收并释放端口/容器
```

原始靶场（静态演示/持久部署）与临时实例是**同一镜像的独立副本**，无共享状态，销毁临时实例对原环境零影响。

## 目录

```
sectutor-backend/
├─ config.js              配置（端口 / TTL / 配额 / 容器资源 / 仿真开关 / CORS / 前端目录）
├─ src/
│  ├─ index.js            Express 入口
│  ├─ cors.js             CORS 中间件（跨域预检 + 回显源 + 允许凭据，解决前端 Failed to fetch）
│  ├─ auth.js             鉴权 stub（Bearer → owner）
│  ├─ labSpecs.js         测试点 → 训练镜像规格映射
│  ├─ envManager.js       创建/查询/销毁/回收（仿真 + 可插拔运行时委托）
│  ├─ reclaim.js          后台 TTL 回收器（含运行统计）
│  ├─ quota.js            配额 / 并发协调（内存 + 可选 Redis）
│  ├─ audit.js            审计事件流（生命周期事件记录 + 摘要）
│  ├─ runtimes/
│  │  ├─ base.js          RuntimeBackend 接口约定（鸭子类型契约：create/destroy/inspect + 安全不变量）
│  │  ├─ index.js         运行时工厂（按 RUNTIME 选择 docker / k8s / firecracker，支持测试注入）
│  │  ├─ docker.js        Docker 运行时（真实 dockerode：internal 网络 + 回环绑定 + 最小权限，生产可用）
│  │  ├─ k8s.js           K8s 运行时（Pod + NetworkPolicy 等价隔离，骨架 + 纯函数结构可验证）
│  │  └─ firecracker.js   Firecracker 微 VM 运行时（骨架 + 纯函数配置可验证，create 占位 NO_FC）
│  └─ routes/envs.js      REST 接口
├─ images/                sqli/cmdi/xss/traversal/nosql 五个最小可构建镜像模板
├─ scripts/               build-images.js（构建）/ scan-images.js（Trivy 扫描）/ sim-flag.js（默认仿真预加载）/ fe-flag.js（默认同源前端预加载）
├─ Dockerfile             后端服务镜像
├─ docker-compose.yml     后端编排（挂载 docker.sock 动态创建靶机）
├─ .github/workflows/scan.yml   GitHub Actions：构建+扫描门禁+单测
├─ .gitlab-ci.yml              GitLab CI：构建+扫描门禁+单测
├─ public/
│  └─ dashboard.html      审计看板（轮询 /api/audit，自包含无构建）
└─ test/
   ├─ smoke.js              无需 Docker 的 API 冒烟测试（仿真模式）
   ├─ quota.test.js         配额/并发协调单测（MemQuota）
   ├─ stress.js             P3 压力测试（并发 GLOBAL_CAP + 无泄漏 + 无 unhandledRejection）
   ├─ redis-fallback.test.js  Redis 降级契约（REDIS_URL 设但无 ioredis → 回退内存并告警）
   ├─ redis-quota.contract.js Redis 契约（FakeRedis 镜像 Lua 语义 + 精确脚本断言）
   ├─ audit.test.js         审计事件流单测
   ├─ runtime.contract.js   P5 可插拔运行时契约（三运行时结构与 envManager 委托，无需集群）
   ├─ proxy.integration.js  反向代理转发集成测试（剥离前缀/?t= + 不转发 Authorization + Host 重写 + 透传体）
   └─ cors.test.js          CORS 中间件契约（预检 + 跨域回显 + 同源不注入 + 通配匹配）
   └─ edgecases.js          核心功能与边界覆盖（生命周期/配额上限/审计不变量/鉴权解析/回收空闲·绝对·活动豁免）
```

## 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/envs` | `{ labId }` → 创建临时环境，返回 `accessUrl / expiresAt` |
| GET | `/api/envs` | 列出当前用户环境 |
| GET | `/api/envs/:id` | 查询状态 |
| DELETE | `/api/envs/:id` | 手动结束并销毁（释放资源） |
| GET | `/api/stats` | 聚合指标：配额用量 / 全局并发 / 回收器统计 / 审计摘要 / 配置快照（需鉴权） |
| GET | `/api/audit` | 审计事件流：近期事件（最新优先）+ 按类型计数 + 30 分钟时间桶趋势（需鉴权） |
| GET | `/dashboard.html` | 审计看板页面（静态托管，轮询 /api/audit 与 /api/stats 可视化） |

## 运行

### 1) 开发 / 测试（仿真模式，无需 Docker）

```bash
npm install
npm run start:sim    # DOCKER_SIMULATE=1，内存登记 + 模拟地址（跨平台，推荐）
# 或
npm run dev:fe      # 同上 + 把 ../cybersec-agent 前端同源自建服务于根路径（打开 http://localhost:8787/ 即前后端一体，零跨域）
# 或
npm test             # 跑全部测试：smoke + quota + stress + redis 降级/契约 + cors（均无需 Docker）
```

> **前端联调（解决「临时靶场后端不可用 / Failed to fetch」）**：前端 cybersec-agent 独立打开或经别的端口加载时，其 `POST /api/envs`（带 `Authorization` 头）会触发浏览器跨域预检。本后端现已内置 CORS —— 默认允许 `http://localhost:*` / `http://127.0.0.1:*` / `file://`(null) 源，因此：
> - 用 `npm run dev:fe` 把前端同源自建服务于 `:8787`，前端与 API 同源，**完全无跨域**；
> - 或前端经 Vite 等跑在 `:5173` 等端口，只要来源是 localhost/127.0.0.1 即被 CORS 放行；
> - 若前端部署在其他域名，设置 `CORS_ORIGINS=https://your.domain,http://other:*` 显式放行即可。

### 1.5) 前端主页「启动 / 停止后端」按钮（本地 launcher，零配置）

首页（cybersec-agent，离线打开的 `sec-tutor.html` 亦可）侧边栏有紫色卡片，含 **▶ 启动后端** 与 **■ 停止后端** 两个按钮。按钮通过本机常驻的轻量 launcher（Node 零依赖，监听 `127.0.0.1:8799`）直接启停后端，**无需自定义协议、无需管理员、无浏览器确认框**，任何人即可一键操作。

**一次性准备（双击即可，无需管理员）：**

```bash
# 双击 sectutor-backend/SecTutor.bat
# 它会：启动 launcher 后台常驻 → 调 launcher 启动后端（仿真模式）→ 打开 http://localhost:8787/
```

之后主页按钮直接可用。关闭 SecTutor.bat 弹出的窗口不影响后端，但**不要关闭「SecTutor Launcher」窗口**，否则按钮失效（可再次双击 SecTutor.bat 恢复）。

**若未先运行 SecTutor.bat**：点按钮时页面会提示「启动器未运行」，按提示双击 `SecTutor.bat` 后再点即可。也可手动 `npm run dev:fe` 起后端，主页状态轮询会回退到后端 `/health` 显示 🟢。

- `launcher.js`：零依赖 Node 服务，提供 `/start`（spawn `npm run dev:fe`）、`/stop`（按端口杀进程）、`/status`（探测 8787），全部 CORS `*`。
- 如需开机自动就绪，把 `SecTutor.bat` 放入「启动」文件夹或建计划任务（可选）。
- 旧方案 `sectutor://` 自定义协议已弃用；若你之前注册过该协议，运行 `unregister-protocol.bat` 清理注册表即可。

### 2) 生产（真实 Docker）

真实 Docker 联调需要一台**可访问 Docker 守护进程**的主机（本代码仓在隔离开发环境中无法实跑 Docker，相关路径已通过仿真冒烟 + 代码审查验证）。

```bash
npm install

# ① 构建 5 个授权靶机镜像（脚本内部调用 docker build，路径安全转义）
npm run build:images

# ② 镜像漏洞扫描（合规门禁，Trivy 未装时会提示安装并以退出码 75 跳过）
npm run scan:images

# ③ 启动后端（连本地 Docker 守护进程；Windows 上 DOCKER_SOCKET 默认命名管道）
DOCKER_SIMULATE=0 PORT=8787 node src/index.js
# 或使用编排：docker compose up --build
```

> 真实路径创建容器时会先做**镜像存在性检查**（缺失则报 `NO_IMAGE` 并引导 `npm run build:images`），再 `createContainer → start → 轮询 inspect 直到 Running/healthy`（超时则标记 warn），销毁时 `stop → remove({ force:true, v:true })` 一并清除匿名卷，避免磁盘泄漏。每个镜像已内置 `HEALTHCHECK`。

环境变量：`PORT` `DOCKER_SOCKET` `ABS_TTL_MS` `IDLE_TTL_MS` `RECLAIM_MS` `MAX_ENVS_PER_OWNER` `MAX_CONCURRENT_ENVS` `REDIS_URL` `ENV_MEM` `ENV_CPU_QUOTA` `ENV_PIDS` `ENV_START_TIMEOUT_MS` `DEV_TOKEN` `PUBLIC_HOST` `RUNTIME` `K8S_NAMESPACE` `K8S_KUBECONFIG` `FC_VCPU` `FC_MEM_MIB` `FC_KERNEL` `FC_ROOTFS_DIR` `CORS_ORIGINS`（逗号分隔允许源，默认 `http://localhost:*,http://127.0.0.1:*,null`）`FRONTEND_DIR`（可选，把前端同源自建服务于根路径，如 `../cybersec-agent`）。

> 配额后端：默认内存实现（单实例零差异）；设置 `REDIS_URL`（并安装 `ioredis`）后切换为 Redis 实现，跨副本共享全局并发与环境计数，Redis 不可用时自动回退内存并告警。

> **可插拔运行时（P5 新增）**：通过 `RUNTIME`（默认 `docker`）在三种隔离运行时间切换 —— `docker`（默认，真实 dockerode）/ `k8s`（Pod + NetworkPolicy，骨架）/ `firecracker`（微 VM，骨架）。三者共享同一份编排 / 配额 / TTL / 审计 / 回收逻辑，仅「实例落在哪种隔离原语」不同；代理目标统一由运行时写入 `env.proxyHost:env.proxyPort`（Docker=回环端口、K8s=PodIP、FC=tapIP）。设计细节见 `docs/k8s-firecracker-design.md`。

> 说明：每个临时环境的网络隔离（出站全封锁 + 环境间互不可达）由所选运行时自动处理 —— Docker 用 `Internal: true` 自定义网络 + 回环端口绑定，K8s 用 deny-all NetworkPolicy，Firecracker 用 tap 侧 nftables；三者安全不变量等价，无需手动配置网络模式。

## 前端对接要点

- 每个测试点卡片加「生成临时环境」按钮 → `POST /api/envs { labId }`。
- 展示倒计时（`expiresAt`）与 `accessUrl`，并轮询 `GET /api/envs/:id`。
- 提供「结束并销毁」→ `DELETE /api/envs/:id`。
- **优雅降级**：若后端不可达（网络错误 / 503 `NO_DOCKER`），前端继续走内置浏览器仿真演练，体验不中断。

## 审计看板

为安全合规审计与运营观测，后端记录每个临时环境的生命周期事件（创建 / 配额拒绝 / 手动销毁 / TTL 回收 / 创建错误），并提供可视化看板：

- 事件流：`src/audit.js` 内存环形缓冲（封顶 2000 条，超出丢弃最旧），记录「谁、何时、起了什么、何时销毁」；
- 数据接口：`GET /api/audit`（需鉴权）返回近期事件（最新优先）+ 按类型计数 + 30 分钟时间桶趋势；`/api/stats` 也附带 `audit` 摘要；
- 看板页面：启动后端后访问 `http://<host>:<port>/dashboard.html`，填入后端令牌（开发默认 `sectutor-dev-token`）即可看到摘要卡片、事件趋势条形图与最近事件表，每 5 秒自动刷新。

> 生产若要审计持久化（防进程重启丢失），把 `audit.js` 的环形缓冲替换为追加日志文件或外部存储即可，`record/list/summary` 接口不变。

## 安全合规（本类平台必做，否则不得上线）

- **隔离与可达性**：每个临时环境创建独立的 `Internal: true` 自定义网络（出站全封锁——靶机无法主动访问公网/内网，且环境间互不可达）；容器发布端口仅绑定 `127.0.0.1`，外部主机不可直达，必须经后端鉴权反向代理 `/api/envs/:id/proxy` 访问。镜像内不含任何生产凭据。K8s 运行时用 deny-all NetworkPolicy（等价 internal 网络）、Firecracker 用 tap 侧 nftables 实现同一组安全不变量，详见 `docs/k8s-firecracker-design.md`。
- **反向代理隔离（P2 已落地）**：用户只与后端通信，后端校验归属后转发至回环端口的靶机容器；后端 Bearer 令牌不泄露给靶机，并通过 httpOnly cookie 支持浏览器后续相对链接免 token。
- **最小权限**：`CapDrop: ALL` + `no-new-privileges` + 内存/PID/CPU 硬上限（cgroups）。
- **镜像预构建+扫描**：只用预置且扫过的漏洞镜像，**绝不允许用户自定义 `docker run` 拉镜像**。
- **每用户隔离**：容器打 owner 标签，按用户限并发、限速率，杜绝邻居抢占。
- **审计 + 限流**：谁、何时、起了什么、何时销毁全记录；配额防资源耗尽型 DoS。
- 建议跑在**独立隔离主机/VM**，不混业务生产。
- 所有镜像仅为**授权防御训练**存在，严禁部署到非授权/生产网络。

## 路线图（P0–P5）

- P0 为现有 lab 写 `LabSpec` + 构建并扫描漏洞镜像 ✅（骨架已含模板与 `build:images`/`scan:images`）
- P1 后端 MVP：spawn/destroy/status + 鉴权 + 基础 TTL 回收 ✅；真实 Docker 路径硬化（镜像检查 + 健康检查等待 + 卷清理）✅；镜像扫描门禁（Trivy 退出码门禁，scan-images.js）✅
- P2 隔离加固：每环境 internal 网络（egress 全封锁）+ 回环端口绑定 + 鉴权反向代理访问 ✅
- P3 多租户与调度：Redis 配额（内存实现默认 + 可选 Redis 跨实例）、全局并发上限(防资源耗尽 DoS)、空闲 TTL + 僵尸清扫（回收器含运行统计）、指标端点 `/api/stats` ✅
- P4 前端集成 + 降级 + 倒计时/销毁 UX ✅（按钮已接入，含优雅降级与本地仿真回退）
- P5 镜像扫描 CI 接入流水线（GitHub Actions + GitLab CI：build:images + Trivy 门禁 + npm test）✅；审计看板（src/audit.js 事件流 + /api/audit + public/dashboard.html 可视化）✅；可插拔运行时抽象 + K8s/Firecracker 骨架（RuntimeBackend 接口 + docker/k8s/firecracker 三实现 + 契约测试 29 断言，真实 K8s/FC 链路待集群与特权宿主机就绪）✅
