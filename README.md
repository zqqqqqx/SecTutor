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
node selftest.js          # 前端 jsdom 自测（145 项断言）
node quiz_validate.js     # 题库结构校验
node build-single.js && node verify-single.js   # 单文件构建与校验
```

后端测试见 `sectutor-backend/test/`。

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
