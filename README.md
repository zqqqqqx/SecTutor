# SecTutor · 网络安全学习辅导平台

一款赛博朋克风格的网络安全学习与实战辅导应用，纯本地离线可用：内置 7 大领域知识体系、随机自测、能力诊断、遗忘曲线复习、实战靶场（含 Docker 环境一键生成）、安全资讯与工具箱，并支持接入外部 LLM 做智能问答与 AI 辅助解题。

![主题](sectutor-app/assets/icon.png)

## 项目结构

| 目录 | 说明 | 技术栈 |
| --- | --- | --- |
| `cybersec-agent/` | 前端单页应用（纯静态，无框架） | HTML / CSS / 原生 JS，可选 `build-single.js` 打成单文件 `sec-tutor.html` |
| `sectutor-backend/` | 后端服务：靶场容器编排（dockerode）、审计、CORS 等 | Node.js / Express / Docker |
| `sectutor-app/` | Electron 桌面壳：内嵌前端并拉起后端，可打包 NSIS 安装包 | Electron / electron-builder |

## 功能特性

- 📚 **知识体系**：Web / 二进制 / 密码学 / 渗透测试 / 网络 / 云安全 / 蓝队 7 大领域、74+ 知识点，含难度筛选与全局搜索
- 🧠 **随机自测**：198 道题库按领域/难度随机抽题，选项乱序 + 长度均衡（杜绝"选最长的就答对"），提交即见解析，支持 AI 辅助
- 📊 **能力诊断**：自适应出题（答对升难度、答错停该域），输出 7 域能力画像
- 🔁 **遗忘曲线复习**：按艾宾浩斯间隔推送到期题目
- ⚔️ **实战靶场**：内置 SQL 注入 / XSS / 路径遍历 / NoSQL / JWT 等在线演练；对接后端可一键生成 Docker 临时环境
- 🔧 **工具箱**：Base64 / MD5 / SHA256 等本地离线工具
- 🤖 **智能问答**：内置知识引擎兜底，可配置外部 LLM（OpenAI 兼容接口）获得更深入的推理与流式输出

## 下载桌面版（Windows）

去 [Releases](https://github.com/zqqqqqx/SecTutor/releases) 下最新的 `SecTutor-Setup-x.y.z.exe`，双击装就行。

> **v1.1.0 及更早的用户看这里**
>
> 早期版本里压根没有更新检查的代码，收不到任何更新提示，也没法自己升级——新版本没法"叫醒"旧版本，这不是代码能修的。下个最新安装包直接覆盖装一次就好（数据不会丢），之后就能在应用里自动收更新了。

### 自动更新

安装版从 v1.2.0 起支持自动更新：

| 运行形态 | 自动更新 |
| --- | --- |
| 安装版（Setup） | 支持。启动后查一次，之后每 4 小时静默复查 |
| 免安装版（Portable） | 不支持，NSIS 的更新机制只对安装版有效，手动下新版覆盖吧 |
| 开发模式 | 不启用 |

更新是告知式的：有新版只提示，下不下载、装不装你说了算。检查失败不影响正常用，断网/限流这类会自动退避重试，其它错在侧栏给句人话说明。

## 快速开始

### 方式一：纯前端（最快）

直接用浏览器打开 `cybersec-agent/index.html`，或使用打包好的单文件 `cybersec-agent/sec-tutor.html`，零依赖、零安装、完全离线。

### 方式二：后端 + Docker 靶场（完整能力）

```bash
cd sectutor-backend
npm install
npm start          # 默认监听 8787 端口
```

需要本机已安装 Docker。前端会自动探测后端并启用"生成临时环境"等能力。

### 方式三：Electron 桌面应用

```bash
cd sectutor-app
npm install
npm start
```

打包 Windows 安装包：

```bash
npx electron-builder --win nsis
```

## 测试

```bash
cd cybersec-agent
node selftest.js          # 前端 jsdom 自测（363 项断言）
node quiz_validate.js     # 题库结构校验
node build-single.js && node verify-single.js   # 单文件构建与校验
```

桌面壳的自动更新判定逻辑是纯函数，单独成测，不需要 Electron：

```bash
node sectutor-app/updater-core.test.js   # 版本形态 / 错误分类 / 节流 / 安装守卫 / 重试策略（52 项断言）
```

后端测试见 `sectutor-backend/test/`。

## 已知问题

- 打包机环境如果被注入了接管 `fs.unlink` 的"移回收站"式删除 shim，electron-builder 会在
  "exe 已写完、latest.yml 还没写"这个位置挂掉，留下来的 latest.yml 是旧的，自动更新直接失效
  （v1.2.0 那次真踩到了）。处理办法是封包前清掉相关环境变量重跑。
- ratelimit 的重试目前固定 60s，没有解析 Retry-After——electron-updater 抛上来的错误对象里
  不一定带这个头，先不折腾。
- 免安装版（Portable）强开自动更新会在 quitAndInstall 时出问题，所以直接按运行形态禁用了，
  没做更细的兼容。
- 没做代码签名，Windows 首次运行会弹 SmartScreen「未知发布者」，点「更多信息 → 仍要运行」即可。
  这是目前和"成熟软件"之间最大的一块短板，等证书的事定了再处理。

## 目录结构速览

```
cybersec-agent/
  index.html        # 主页面
  styles.css        # 赛博朋克双主题样式
  data.js           # 题库 / 知识点 / 靶场数据
  app.js            # 应用逻辑（IIFE）
  selftest.js       # jsdom 自测
  build-single.js   # 单文件打包脚本
sectutor-backend/
  src/              # Express 服务、dockerode 编排、审计、CORS
  public/           # 静态资源
  docs/             # 文档
  Dockerfile / docker-compose.yml
sectutor-app/
  main.js           # Electron 主进程
  preload.js
  assets/           # 应用图标
  package.json      # electron-builder 配置
```

## 免责声明

本项目仅用于网络安全学习、教学与授权测试环境。请勿对未授权的系统进行任何测试；因使用本项目产生的任何后果由使用者自行承担。
