---
status: done
priority: P1
created: 2026-03-13
---

# 014 — 打磨与一致性修复

- 来源讨论: [discussions/014-polish-and-consistency.md](../discussions/014-polish-and-consistency.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/014-polish-and-consistency.md](../discussions/014-polish-and-consistency.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `popup/popup.js` | A + B |
| `content/content.js` | C |
| `content/modules/immersive.js` | D |
| `content/content.css` | E + F |
| `content/modules/sidebar.js` | F |
| `tests/polish-consistency.test.mjs` | A + B + C + D + E + F |

## 任务清单

### 必做

#### A. Popup toast 深色模式可见性修复

- [x] `popup/popup.js` — `showToast()` 函数中将 `background: var(--text-primary)` 改为固定深色值 `rgba(50, 54, 66, 0.95)`
- [x] 保留 `color: white` 不变
- [x] 验证：浅色和深色模式下 toast 都清晰可读

#### B. Popup TTS 失败 fallback 到系统语音

- [x] `popup/popup.js` — `speak()` 函数中，当非 `system` provider 的远程 TTS 调用失败时，catch 后 fallback 到 `speechSynthesis`（与 sidebar/float-window 行为一致）
- [x] fallback 时只 `console.warn`，**不加额外 toast**
- [x] 不要在 throw 路径上改动调用方的 catch handler（`btnSpeak` 的 click handler），只在 `speak()` 内部兜底

#### C. Content script settings 合并一致性

目标：确保 content.js 中所有获取 settings 的路径都产出 merged（含 DEFAULT_SETTINGS 默认值）的完整对象。

- [x] 在 `content/content.js` 中新增一个本地 `mergeDefaults(raw)` helper 函数，内含当前 `storage.js:DEFAULT_SETTINGS` 的完整 key-value 对象，返回 `{ ...DEFAULTS, ...raw }`
- [x] `chrome.storage.onChanged` handler（当前 line 97）：将 `ST.state.settings = changes.settings.newValue` 改为经过 `mergeDefaults()` 后赋值
- [x] `loadSettings()` 的 fallback 路径（当前 line 29-30）：将 `const settings = result.settings || {}` 改为经过 `mergeDefaults()` 后赋值
- [x] **不改** `loadSettings()` 的主路径（走 sendMessage → SW → `StorageManager.getSettings()`），因为 SW 侧已经做了合并
- [x] `mergeDefaults` 中的默认值必须和 `storage.js:DEFAULT_SETTINGS` 保持一致。虽然是复制，但 content script 不能 import ES module，这是已知的权衡

#### D. 沉浸式翻译同语言过滤

- [x] `content/modules/immersive.js` — 在通用网站过滤链中（约 line 73 `text.length < 20` 之后），加入：
  ```javascript
  if (ST.detectLanguage(text) === targetLang) return false;
  ```
- [x] 与 Twitter 路径（line 38）保持一致
- [x] MutationObserver 中的过滤（约 line 238）已有此检查，不需要改

### 推荐

#### E. 翻译气泡加载动画 CSS

- [x] `content/content.css` — 补入 `.st-loading-dots` 及子元素样式：
  - 三个圆点（`span`），大小约 6-8px，圆形
  - 使用 `var(--accent)` 作为圆点颜色
  - 交替跳动动画（`@keyframes st-bounce`），时长约 1.2s，三个点依次延迟
  - 整体居中，与气泡浅色调性一致
- [x] 风格：三点跳动，不做脉冲/渐变/sweep

### 顺手

#### F. Content script 硬编码颜色 token 化

分两类处理：

**F1. 文本/badge — 复用现有 token：**
- [x] `content/modules/sidebar.js:77` — 空状态 `color: #999` → `color: var(--text-tertiary)`
- [x] `content/modules/sidebar.js:82` — 快捷键 badge `background: #eee` → `background: var(--bg-secondary)`

**F2. 卡片型表面 — 新增 content token 后迁移：**
- [x] `content/content.css` — 在已有的 scoped design tokens 块中新增 `--surface: rgba(255, 255, 255, 0.95);`（或其他合适的半透明白色值）
- [x] `content.css:381` `.st-sidebar-result-card { background: white }` → `var(--surface)`
- [x] `content.css:487` `.st-history-item:hover { background: white }` → `var(--surface)`
- [x] `content.css:689` `.st-orb-menu-item { background: white }` → `var(--surface)`
- [x] **不改** 非卡片型的 `white`（如 `swap-btn:hover color: white` 这类前景白色）

## 不做的事

- **不做** TTS speak 公共模块提取 — 跨 content + popup，单独任务
- **不做** translateBatch fallback chain — 架构任务
- **不做** content script 深色模式 — 需宿主页检测 + 独立设计
- **不碰** service worker、manifest、options、translator.js

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check popup/popup.js` 通过
- [x] `node --check content/content.js` 通过
- [x] `node --check content/modules/immersive.js` 通过
- [x] `node --check content/modules/sidebar.js` 通过
- [x] `git diff --check` 无输出
