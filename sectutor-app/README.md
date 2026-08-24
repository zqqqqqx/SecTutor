# SecTutor 桌面应用（sectutor-app）

把 SecTutor 网络安全实战训练**打包成一个自包含的正经桌面软件（Windows 安装包）**。

- 后端（`sectutor-backend`）以「应用内进程」方式直接运行在桌面应用主进程里；
- 前端（`cybersec-agent`）由内嵌后端同源托管，窗口直接加载 `http://127.0.0.1:8787/`；
- 主页上的 **▶ 启动后端 / ■ 停止后端** 按钮通过 IPC 直接让主进程启停后端——
  **不需要自定义协议、不需要管理员、不需要强制开机自启、不需要常驻 launcher**，点一下就成。
- 整个项目（后端 + 前端 + 运行环境）随安装包一起分发，**安装即用，无需用户再装 Node / Docker**。

## 正经软件外壳

- **系统托盘常驻**：关闭窗口仅最小化到托盘，应用不退出、内嵌后端继续运行；托盘图标右键可「显示主界面 / 启动后端 / 停止后端 / 退出 SecTutor」；单击或双击托盘图标均可恢复窗口。
- **单实例锁**：重复启动会自动聚焦已有窗口，避免多开。
- **不做开机自启**：按你的要求，应用**完全不做开机自启**（不弹窗、不注册），启动完全由你控制；如想开机自启，可在 Windows「设置 → 应用 → 启动」里手动添加 SecTutor。
- **应用图标**：`assets/icon.ico` 用于窗口、任务栏、托盘与安装包；蓝色盾牌 + 锁设计，符合网络安全训练定位。
- **Windows 安装包**：基于 NSIS 的安装程序，支持选择安装目录、创建桌面/开始菜单快捷方式、安装完成后自动启动。

## 目录约定

```
NewAgent/
├─ sectutor-backend/     # 后端（被本应用以相对路径引用）
├─ cybersec-agent/       # 前端（被本应用同源托管）
└─ sectutor-app/         # 本桌面应用
   ├─ package.json       # electron + electron-builder 配置
   ├─ main.js            # 主进程：内嵌后端 + 窗口 + 托盘 + IPC
   ├─ preload.js         # 安全暴露 IPC 给前端
   ├─ assets/            # 应用图标（icon.ico / icon.png）
   ├─ make_icon.py       # 图标生成脚本
   └─ README.md
```

## 拿到安装包（两种途径）

### 途径 A：直接安装（已为你构建好的话）

安装包位于：

```
sectutor-app/dist/SecTutor-Setup-1.0.0.exe
```

双击运行，按向导选择安装目录（默认 `C:\Users\<你>\AppData\Local\Programs\SecTutor`），
勾选「创建桌面快捷方式」，装完自动启动。之后像普通软件一样从**桌面 / 开始菜单**打开即可。

> 安装包内已自带 Electron 运行时、后端及其全部依赖，**用户机器无需预装 Node 或 Docker**。

> 若不想安装，也可直接用**免安装版**：运行 `sectutor-app/dist/win-unpacked/SecTutor.exe`（自包含，拷到任意目录双击即跑）。

### 途径 B：自己重新构建（如需更新或换机器）

需要本机有 [Node.js](https://nodejs.org/)（建议 18+）且能联网。

> **国内网络提示**：打包工具（winCodeSign / NSIS）默认从 GitHub 下载，国内可能很慢或失败。
> 构建前先设置镜像环境变量：
> - PowerShell：`$env:ELECTRON_BUILDER_BINARIES_MIRROR="https://registry.npmmirror.com/-/binary/electron-builder-binaries/"`
> - CMD：`set ELECTRON_BUILDER_BINARIES_MIRROR=https://registry.npmmirror.com/-/binary/electron-builder-binaries/`

```bash
cd sectutor-app
npm install          # 安装依赖；.npmrc 已让 Electron 走国内镜像
npm run dist         # 生成 dist/SecTutor-Setup-<版本>.exe
```

`package.json` 已配置 `electronDist` 指向本机已装的 `node_modules/electron/dist`，
**打包时直接使用本地 Electron，无需再去 GitHub 下载 Electron 运行时**，更稳更快。

## 使用方式

1. 从桌面 / 开始菜单打开 **SecTutor**；
2. 应用启动即**自动内嵌启动后端**（默认仿真模式，无需 Docker），窗口直接打开训练界面；
3. 侧边栏「后端控制」卡片显示 🟢 运行中；「启动 / 停止后端」按钮由主进程直接控制；
4. 关闭窗口只是最小化到**系统托盘**（后端继续跑）；真正退出从托盘右键「退出 SecTutor」。

## 关于「真实靶机」与仿真模式

桌面版默认 `DOCKER_SIMULATE=1`（仿真模式），**无需在本机安装 Docker** 即可完成全部前端练习与本地仿真演练。
若你已安装 Docker 并希望「实战靶场 → 在线演练」生成真实隔离靶机，可在打包前设置：

```bash
# Windows PowerShell
$env:DOCKER_SIMULATE="0"
npm run dist
```

## 已知边界

- 关闭应用窗口默认最小化到系统托盘；真正退出请从托盘右键选择「退出 SecTutor」，退出时会一并停止内嵌后端。
- 打包后 `sectutor-backend`、`cybersec-agent` 作为 `extraResources` 一并入安装包，无需单独部署。
- 安装包未做代码签名（沙箱/本地环境限制），Windows SmartScreen 首次运行可能提示「未知发布者」，点「仍要运行」即可；如需消除提示需自行购买代码签名证书后配置 `CSC_LINK`。
