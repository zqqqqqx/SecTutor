# SecTutor 交互感提升 · 详细设计文档

> 版本：v1.1 · 动效强度档位：**明显**（250–350ms，带明显位移与缩放）
> 适用：`cybersec-agent/`（前端单页 + Electron 壳 + 单文件 `sec-tutor.html`）
> 状态：**P0–P3 已全部实施并部署**（第一批 `b655d5c`、第二批 `be0a13b`）
>
> **v1.1 修订记录**
> - 更正 7.3 节对比度结论：原文称「深色主题 `--muted` 仅 4.3:1」属**误判**（实测 5.60:1，本就达标）；
>   真正不达标的是**浅色**主题在页面底色上的 4.23:1，已修正（详见 7.3）。
> - 标注实施时有意偏离本文档的两处（骨架屏、答题 Toast），见第十一节。

---

## 一、目标与设计原则

一句话目标：**让每一次点击都有即时、明确、可预期的回应。**

三条原则：

1. **反馈优先于美观** — 用户点完必须知道"发生了什么"。任何异步操作都要有 pending 态，任何结果都要有通知。
2. **键盘可达 = 一等公民** — 所有鼠标能做的事，键盘都要能做。
3. **动效服务理解** — 动效用于解释"元素从哪来、到哪去、状态怎么变"，不做无意义装饰。

---

## 二、现状基线（实测，非估算）

审计对象：`cybersec-agent/app.js`（3063 行）+ `index.html` + `styles.css`

| 维度 | 实测结果 | 判定 |
| --- | --- | --- |
| 全局 Toast / 通知 | 全项目 **0 处** | 缺失 |
| 键盘快捷键 | 全项目仅 **1 处**（`#chatInput` 的 Enter 发送） | 缺失 |
| `aria-*` / `role` / `tabindex` | `index.html` **0 处**，`app.js` 2 处 | 基本为零 |
| 异步 pending 态 | 仅 `showTyping()` / `setChatBusy()`（聊天）；生成计划、导出 PDF/PNG、启动/销毁靶场、AI 辅助、复习提交 **全部没有** | 缺失 |
| 弹窗 Esc 关闭 | 无，仅 `✕` 按钮与遮罩点击 | 缺失 |
| 弹窗焦点管理 | 无（打开后 Tab 会跑到背景内容） | 缺失 |
| 面板切换滚动位置 | 不记忆，切回回到顶部 | 缺失 |
| `@keyframes` 数量 | **4 个**（`pulse` / `panelIn` / `blink` / `spPulse`） | 单薄 |
| 面板切换动效 | `panelIn .12s` 纯 opacity，无位移 | 几乎不可感知 |
| 空状态文案 | 8 处 | 已有，保留 |
| 破坏性操作确认 | 设置内"重置全部"**有**确认；学习计划页 `#resetPlan` **无**确认；均无撤销 | 不一致 |

**结论**：核心问题是「操作后无反馈」，其次「只能靠鼠标」。

---

## 三、动效规范（明显档）

统一为 CSS 变量，放在 `styles.css` 的 `:root` 与 `[data-theme="dark"]` 之后追加（两套主题共用动效参数）。

```css
:root {
  /* 时长：明显档 */
  --dur-fast: 180ms;    /* 按压、hover 等即时反馈 */
  --dur-base: 260ms;    /* 面板切换、卡片入场 */
  --dur-slow: 340ms;    /* 弹窗、Toast 入场 */
  /* 缓动 */
  --ease-out:   cubic-bezier(.16,.84,.44,1);      /* 标准减速 */
  --ease-spring:cubic-bezier(.34,1.56,.64,1);     /* 轻微过冲，用于缩放/弹入 */
  /* 位移与缩放幅度 */
  --move-sm: 12px;      /* 列表项、Toast */
  --move-md: 20px;      /* 面板切换 */
  --move-lg: 32px;      /* 弹窗 */
  --scale-press: .96;   /* 按压 */
  --scale-pop: 1.04;    /* 强调弹入 */
}
```

### 各场景动效规格

| 场景 | 时长 | 位移 / 缩放 | 缓动 | 说明 |
| --- | --- | --- | --- | --- |
| 面板切换 | 260ms | `translateY(20px) → 0` | `--ease-out` | 替换现有 `.12s` 纯淡入 |
| 卡片 hover | 240ms | `translateY(-6px)` + `scale(1.02)` + `--shadow-lg` | `--ease-out` | 知识点卡、资讯卡、靶场卡 |
| 列表项入场（错峰） | 260ms | `translateY(16px) → 0`，每项延迟 `i × 35ms` | `--ease-out` | 上限 12 项，超出不再延迟 |
| 弹窗入场 | 300ms | `scale(.9) → 1` + `translateY(32px) → 0` | `--ease-spring` | 遮罩 opacity 200ms |
| 弹窗退场 | 200ms | `scale(.96)` + opacity→0 | `--ease-out` | |
| Toast 入场 | 320ms | `translateX(120%) → 0` + `scale(.92) → 1` | `--ease-spring` | 从右下角滑入 |
| Toast 退场 | 220ms | `translateX(120%)` + opacity→0 | `--ease-out` | |
| 按钮按压 | 120ms | `scale(.96)` | `--ease-out` | `:active` 状态 |
| 骨架屏微光 | 1400ms | 背景横扫 | `linear` 循环 | |
| 成功勾选 | 420ms | `scale(.6) → 1.04 → 1` | `--ease-spring` | 掌握度打勾 |

### 无障碍兜底（强制）

所有动效必须包在：

```css
@media (prefers-reduced-motion: no-preference) { /* 动效规则 */ }
```

系统开启"减弱动效"时，全部降级为 0ms（直接显示终态），功能不受任何影响。

---

## 四、P0 · 反馈闭环

### 4.1 全局 Toast 系统

**新增文件**：无（内联到 `app.js` 顶部工具区 + `styles.css`）

**DOM 结构**（首次调用时创建，追加到 `body`）：

```html
<div id="toastHost" class="toast-host" role="status" aria-live="polite"></div>
```

单个 Toast：

```html
<div class="toast toast-ok" role="alert">
  <span class="toast-ic">✓</span>
  <span class="toast-msg">学习计划已生成</span>
  <button class="toast-act">撤销</button>   <!-- 可选 -->
  <button class="toast-x" aria-label="关闭">✕</button>
</div>
```

**API 设计**：

```js
/* 统一通知入口
   type: "ok" | "err" | "info"
   opts: { actionText, onAction, duration }
   返回 toastId，可 closeToast(id) 手动关闭 */
function toast(msg, type, opts) { ... }
function closeToast(id) { ... }
```

**行为规格**：
- 位置：右下角，距边 24px，`z-index` 高于弹窗
- 堆叠：最多同时 3 条，超出移除最早的一条
- 自动消失：`ok` 3000ms，`info` 3500ms，`err` 5000ms
- 带"撤销"按钮的 Toast：duration 提升至 **8000ms**
- 鼠标悬停时暂停自动消失，移开重新计时
- 点击 `✕` 立即关闭（220ms 退场动画后移除 DOM）
- `role="status"` + `aria-live="polite"`（错误用 `role="alert"` + `assertive`）

**配色**：沿用现有主题变量，不新增色板
- `ok`：背景 `var(--ok-bg)`，文字 `var(--ok-ink)`，左色条 `var(--ok)`
- `err`：背景 `var(--bad-bg)`，文字 `var(--bad-ink)`，左色条 `var(--bad)`
- `info`：背景 `var(--brand-soft)`，文字 `var(--brand)`，左色条 `var(--brand)`

**接入点（逐个补齐）**：

| 操作 | 当前行为 | 改造后 |
| --- | --- | --- |
| `genPlan` 生成学习计划 | 无提示 | 成功 toast「已生成 N 周计划」 |
| `exportPlanPdf` / `exportPlanPng` | 无提示 | 成功 / 失败 toast |
| `requestEnv` 启动靶场 | 只有倒计时 | 成功 toast「环境已就绪，剩余 30 分钟」 |
| `destroyEnvFront` 销毁靶场 | 无提示 | info toast「环境已销毁」 |
| `aiAssistToChat` AI 辅助 | 静默跳转 | info toast「已带入智能问答」 |
| 掌握度打勾 | 无提示 | ok toast（带 8s 撤销） |
| 靶场提交答案 | 无提示 | 对/错 toast |
| 复习完成 | 无提示 | ok toast「已完成 N 项复习」 |
| 后端启动失败 / 网络错误 | 静默 | err toast + 可复制的错误详情 |

### 4.2 按钮 Loading 态

**统一工具**：

```js
/* 把按钮置为忙碌态，返回恢复函数 */
function withPending(btn, busyText) { ... }
```

**行为规格**：
- 点击后立即：`disabled = true`，按钮内插入 spinner，文案替换为 `busyText`（如「生成中…」）
- 按钮宽度锁定为原宽度（避免文字变化导致布局跳动）
- 结束（成功或失败）后恢复原文案并解禁
- **必须**在 `try/finally` 中调用恢复，防止异常导致按钮永久禁用

**接入点**：`genPlan`、`exportPlanPdf`、`exportPlanPng`、`requestEnv`、`destroyEnvFront`、靶场提交、复习提交、`startQuiz`

**spinner 样式**：18px 圆环，`border: 2px solid` + `border-top-color: transparent`，`animation: spin .7s linear infinite`（新增第 5 个 keyframe）

### 4.3 骨架屏

**接入位置**：知识体系 `#topicGrid` 首次渲染、资讯列表 `#newsList` 首次渲染

**规格**：
- 卡片骨架：标题条 60% 宽 + 两条正文条（100%、70%）+ 一个按钮占位块
- 显示 6 张，覆盖首屏
- 背景 `var(--panel-2)`，微光 `linear-gradient(90deg, transparent, var(--glass), transparent)` 横扫 1400ms 循环
- 真实内容渲染完成后立即替换（无淡出，避免延迟感）

---

## 五、P1 · 键盘导航

### 5.1 全局快捷键表

| 快捷键 | 功能 | 实现要点 |
| --- | --- | --- |
| `Ctrl / ⌘ + K` | 打开全局搜索 | 直接复用已有 `openGlobalSearch()`，成本极低 |
| `Esc` | 关闭当前弹窗 / 搜索 / 清空输入 | 按优先级：弹窗 > 搜索弹层 > 输入框清空 |
| `1` – `8` | 切换面板 | 映射顺序见下表 |
| `/` | 聚焦当前面板搜索框 | 知识体系聚焦 `#kbSearch` |
| `?` | 打开快捷键帮助面板 | 复用 `openModal` |
| `Enter` | 聊天发送 | 已有，保留 |

**数字键 → 面板映射**（与左侧导航顺序一致）：

| 键 | 面板 id | 名称 |
| --- | --- | --- |
| `1` | `knowledge` | 知识体系 |
| `2` | `chat` | 智能问答 |
| `3` | `range` | 实战靶场 |
| `4` | `plan` | 学习计划 |
| `5` | `news` | 安全资讯 |
| `6` | `tools` | 工具与代码 |
| `7` | `quiz` | 随机自测 |
| `8` | `compliance` | 合规声明 |

**触发条件**：焦点不在 `input` / `textarea` / `select` / `[contenteditable]` 内时才响应（否则打字会误触发）。`Esc` 与 `Ctrl+K` 例外，任何情况都响应。

**视觉提示**：左侧导航项右下角显示对应数字角标（小号、低对比度，hover 时提亮）。

### 5.2 焦点陷阱与归还

改造 `openModal(titleHtml, bodyHtml)`：

- 打开时：记录 `document.activeElement` 为 `lastFocused`，聚焦弹窗首个可聚焦元素
- Tab / Shift+Tab 在弹窗内循环（不逃逸到背景）
- 关闭时：`lastFocused.focus()` 归还焦点
- 遮罩加 `role="dialog"` `aria-modal="true"` `aria-labelledby`

`closeModal()` 当前仅 `classList.add("hidden")`，需补充退场动画 + 焦点归还 + 200ms 后真正隐藏。

### 5.3 焦点可见环

```css
:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; border-radius: 6px; }
```

全局生效，替换浏览器默认样式。注意：赛博朋克深色主题下 `--brand` 对比度足够。

---

## 六、P2 · 状态安全

### 6.1 面板滚动位置记忆

在 `activateTab(tabName)` 中：
- 切走前：记录当前面板内滚动容器的 `scrollTop`（按 tab 名存到 `Map`）
- 切回后：`requestAnimationFrame` 内恢复 `scrollTop`

需处理的容器：知识体系的 `.kb-side` 与 `.kb-main`、资讯列表、靶场列表、工具列表。

### 6.2 破坏性操作：确认 + 撤销

**不一致现状**：设置内"重置全部"有 `confirm`，学习计划页 `#resetPlan` 没有。

**统一方案**：

1. `#resetPlan` 补二次确认（与设置内文案一致）
2. 重置改为**软删除**：先把 `state.mastery` 快照存入 `pendingUndo`（内存 + `sessionStorage`），再执行清空
3. 弹出带「撤销」按钮的 Toast（8 秒）
4. 点撤销 → 从快照恢复；超时 → 丢弃快照
5. 同样机制应用于「清空靶场战绩」「清空聊天记录」

**数据结构**：

```js
const undoStack = new Map();  // undoId -> { label, restore: Function, timer }
```

### 6.3 输入草稿自动保存

- `#chatInput`：输入时防抖 400ms 写入 `localStorage["sectutor_chat_draft"]`
- 页面加载后恢复；发送成功或手动清空时移除
- 学习计划表单参数（周数/每周小时/领域）同样持久化

---

## 七、P3 · 质感与无障碍

### 7.1 微交互清单

| 元素 | 交互 |
| --- | --- |
| 知识点卡 | hover 抬升 6px + 缩放 1.02 + 阴影加深；领域色条从左展开 |
| 掌握度打勾 | `scale(.6) → 1.04 → 1` 420ms 弹入 + 短暂绿色高亮 |
| 进度条 | 数值变化时宽度过渡 600ms；数字滚动计数 500ms |
| 靶场倒计时 | 最后 60 秒变红并轻微脉动（已有 `pulse`，调整节奏） |
| 按钮 | `:active` 缩放 .96，120ms |
| 标签页切换 | 活动指示条平滑滑动（而非跳变） |

### 7.2 无障碍补齐清单

| 位置 | 补充 |
| --- | --- |
| 左侧导航 `.rail-item` | `role="tab"` + `aria-selected` + `aria-label` |
| 各 `.panel` | `role="tabpanel"` + `aria-labelledby` |
| 弹窗 | `role="dialog"` + `aria-modal="true"` + `aria-labelledby` |
| 所有图标按钮 | `aria-label`（AI 辅助、开始学习、关闭等） |
| Toast | `role="status"` / `role="alert"` + `aria-live` |
| 进度条 | `role="progressbar"` + `aria-valuenow/min/max` |
| 难度筛选、领域选择 | 语义化 `radiogroup` / `listbox` |
| 语言切换 | `aria-pressed` |

### 7.3 对比度检查（已实测修正）

> **本节 v1 的结论是错的，v1.1 已更正。** 教训：不能用「看着差不多」估对比度，必须用 WCAG 公式算。

用 WCAG 相对亮度公式实测四种组合：

| 组合 | v1 结论 | 实测 | 判定 |
| --- | --- | --- | --- |
| 深色 `--muted #7d93a8` on `--panel #111824` | 4.3:1（误判） | **5.60:1** | 达标，无需改 |
| 深色 `--muted` on `--bg #0a0e14` | — | 6.09:1 | 达标 |
| 浅色 `--muted #64748b` on `--panel #ffffff` | — | 4.76:1 | 达标（勉强） |
| 浅色 `--muted #64748b` on `--bg #eef2f7` | — | **4.23:1** | **不达标** |

结论：**问题在浅色主题，不在深色主题**（v1 搞反了）。深色 `--muted` 实际是 `#7d93a8` 而非文档假设的 `#64748b`。

修正方案：浅色 `--muted` 由 `#64748b` 调深为 **`#5e6c82`**（在 bg / panel / panel-2 上分别为 4.74 / 5.33 / 5.09，全部达标，且视觉变化极小）。已把对比度计算写进自测断言，防止后续回退。

**§7.2 完成度说明**：已完成导航 `role=tab`/`aria-selected`/`aria-controls`、面板 `role=tabpanel`、图标栏 `role=tablist`、顶栏图标按钮 `aria-label`、弹窗 `role=dialog`/`aria-modal`、Toast `aria-live`。
**未完成**（低优先，可后续补）：进度条 `role=progressbar` + `aria-valuenow`、筛选器 `radiogroup`/`listbox` 语义、语言切换 `aria-pressed`。

---

## 八、代码组织

不拆分现有 IIFE（风险高、收益低），按职责在文件内分区：

```
app.js
├── [新增] 反馈层      toast() / closeToast() / withPending() / skeleton()
├── [新增] 键盘层      initHotkeys() / HOTKEY_MAP / trapFocus()
├── [新增] 状态层      rememberScroll() / restoreScroll() / undoStack
├── 现有 索引层        （已实现：INV / BM25 / TOPIC_BY_ID）
├── 现有 渲染层        renderTopicGrid / renderNews / ...
└── 现有 业务层
```

`styles.css` 末尾新增两个分区：`/* ===== 交互反馈组件 ===== */` 与 `/* ===== 动效规范 ===== */`。

---

## 九、验证方案

每完成一层，必须通过：

| 检查项 | 命令 | 期望 |
| --- | --- | --- |
| 语法 | `node --check app.js` | 通过 |
| 自测 | `node selftest.js` | **153/153**（现有基线） |
| 新增断言 | 见下 | 全部通过 |
| 单文件 | `node build-single.js && node verify-single.js` | 6/6 |
| 性能 | `node _bench.js` | 不劣于 257.9ms |

**新增自测断言（P0/P1 完成后追加，预计 +14 条，总数 167）**：

- Toast 宿主存在且 `aria-live` 正确
- `toast()` 三种类型均产生对应 class 的节点
- Toast 超时后自动移除（用假定时器或短 duration 验证）
- 带撤销按钮的 Toast 点击后回调被触发
- `withPending()` 期间按钮 `disabled` 且文案已替换
- `withPending()` 回调抛异常后按钮仍被恢复（finally 生效）
- 骨架屏在内容渲染后被移除
- `Esc` 能关闭弹窗（`dispatchEvent` 模拟）
- `Ctrl+K` 能打开全局搜索
- 数字键 `1`/`8` 能切到对应面板
- 在输入框内按数字键**不会**切换面板（防误触）
- 弹窗打开后焦点在弹窗内
- 弹窗关闭后焦点归还触发元素
- 撤销能恢复被清空的掌握度

---

## 十、风险与对策

| 风险 | 对策 |
| --- | --- |
| 动效影响 jsdom 自测（异步时序） | 自测中不等待动画；断言只看最终状态。动画时长用 CSS 变量，测试环境可通过 `prefers-reduced-motion` 关闭 |
| `prefers-reduced-motion` 在 jsdom 不生效 | 兜底：提供 `window.__disableMotion()` 测试钩子 |
| 焦点陷阱与 Electron 壳冲突 | 仅在 `#modalOverlay` 存在时启用，不影响主流程 |
| 快捷键与浏览器/Electron 默认键冲突 | 只占用 `Ctrl+K`（无默认）、数字键、`/`、`?`、`Esc`；`preventDefault` 精确控制 |
| Toast 堆叠遮挡内容 | 最多 3 条 + 右下角 + 不覆盖左侧导航与顶栏按钮 |
| 单文件构建体积 | 预计增加 8–12KB（473KB → 约 485KB），可接受 |

---

## 十一、实施顺序建议

| 批次 | 内容 | 计划断言 | 实际 |
| --- | --- | --- | --- |
| 第 1 批（commit `b655d5c`） | P0 反馈闭环 + P1 键盘导航 | +14 | **+22**（153 → 175） |
| 第 2 批（commit `be0a13b`） | P2 状态安全 + P3 无障碍 | +11 | **+14**（175 → 189） |

每批独立提交、独立验证、独立同步部署（两处 `resources/` + NSIS 重建）。

### 实施结果

| 项目 | 结果 |
| --- | --- |
| 自测 | 153 → **189**，连跑 3 次稳定，异常 0 |
| 性能 | 与 `384b013`（含 BM25 不含 P0–P3）同区间，**未引入性能成本** |
| 单文件 | 473.6KB → **500.2KB**，校验 6/6 |
| 部署 | 三处 `app.js` md5 一致，NSIS 重建到桌面分发目录 |

### 有意偏离本文档的两处

1. **跳过骨架屏（§4.3）** — 知识体系与资讯列表都是同步渲染（<10ms），加骨架屏只会造成闪屏，没有实际收益。骨架屏的价值在于掩盖**异步等待**，此处不存在。
2. **答题不给 Toast（§4.1 接入点表）** — 答题已有醒目的内联对错反馈（✅/❌ + 解析），再弹 Toast 属于重复噪音。

### 实施中新增的两个防硬性 bug 设计（文档 v1 未预见）

1. **弹窗延迟隐藏会误伤新弹窗** — 为做退场动效，`closeModal()` 的隐藏延后 260ms。但代码里大量 `closeModal(); doSomething();` 写法，会让这 260ms 后的回调把**期间新打开的弹窗一起隐藏**。解法：引入 `modalGen` 代际令牌，`openModal()` 自增令所有挂起的隐藏失效。
2. **按钮忙碌态可能永久卡死** — `withPending()` 若业务抛异常而恢复逻辑未执行，按钮将永远禁用。解法：恢复函数做成幂等，调用处一律 `try/finally`，并为此写了专门断言。
