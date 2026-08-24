# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与[语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [0.1.0] - 2026-08-24

### Added
- 前端单页应用（纯静态、离线可用）：
  - 7 大领域知识体系（Web / 二进制 / 密码学 / 渗透 / 网络 / 云安全 / 蓝队），含难度筛选与全局搜索
  - 随机自测：198 道题库，选项乱序 + 长度均衡（杜绝"选最长的就答对"）
  - 自适应能力诊断（答对升级、答错停该域），输出 7 域能力画像
  - 遗忘曲线复习（艾宾浩斯间隔）+ 弱项专项自测
  - 实战靶场：SQL 注入 / XSS / 路径遍历 / NoSQL / JWT 等在线演练，可对接后端一键生成 Docker 环境
  - 工具箱（Base64 / MD5 / SHA256）、智能问答（内置知识引擎 + 可选外部 LLM 流式输出）
- 后端服务（Express + dockerode）：靶场容器编排、配额、审计、CORS、异步回收
- Electron 桌面壳（可打包 NSIS 安装包）
- 测试体系：前端 jsdom 自测 145 项断言 + 题库结构校验 + 单文件构建校验；后端 smoke / quota / stress / Redis 降级 / 审计 / CORS / 契约测试
- CI：前端 GitHub Actions（测试 + 单文件构建）；后端镜像构建 + Trivy 漏洞扫描门禁
- 开源配套：MIT License、SECURITY.md、根 README

### Fixed
- 随机自测"正确答案总在同一位置"：选项乱序 + answer 下标重映射
- 随机自测"选最长的就一定正确"（97% 题正确项为最长选项）：运行时长度均衡，使长度与答案脱钩（正确率降至 ≈25%）
- 自测脚本 jsdom 依赖可移植化（不再绑定本机绝对路径）
