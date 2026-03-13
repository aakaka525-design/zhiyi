---
status: done
priority: P1
created: 2026-03-13
---

# 013 — 深色模式缺失 & 健壮性问题修复

- 来源讨论: [discussions/013-dark-mode-and-robustness.md](../discussions/013-dark-mode-and-robustness.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/013-dark-mode-and-robustness.md](../discussions/013-dark-mode-and-robustness.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `popup/popup.js` | A |
| `popup/popup.css` | A |
| `popup/popup.html` | D + E |
| `options/options.css` | B + B-顺手 |
| `options/options.html` | E |
| `content/modules/selection.js` | C |
| `tests/dark-mode-robustness.test.mjs` | A + B + C + D + E |

## 任务清单

### 必做

#### A. Popup 深色模式支持

- [x] `popup/popup.js` — `loadSettings()` 中增加读取 `settings.darkMode`，若为 `true` 则给 `document.body` 添加 `dark-mode` 类
- [x] `popup/popup.css` — 将以下硬编码 `background: white` 替换为 theme 变量：
  - `popup.css:113` `.input-section:focus-within` → `var(--bg-card-solid)`
  - `popup.css:179` `.result-section` → `var(--bg-card-solid)`
  - `popup.css:236` `.quick-btn` → `var(--bg-card-solid)`

#### B. Options 深色模式硬编码修复

- [x] `options/options.css` — 将以下硬编码 `background: white` 替换为 theme 变量：
  - `options.css:67` `.nav-item:hover` → `var(--bg-card-solid)`
  - `options.css:72` `.nav-item.active` → `var(--bg-card-solid)`
  - `options.css:96` `.content-area` → `var(--bg-card-solid)`
  - `options.css:163` `.input` → `var(--bg-input)`
  - `options.css:484` `.history-item` → `var(--bg-card-solid)`
- [x] **不改** `options.css:264` 的 `.switch .slider:before` — 那是 UI 设计值，不属于深色模式 bug

#### C. 右键翻译 rect null 崩溃修复

- [x] `content/modules/selection.js` — `showBubble()` 中加 3 级 fallback：
  1. 首选 `ST.state.selection.rect`
  2. 若 null，尝试 `window.getSelection()`：`rangeCount > 0` 时取 `getRangeAt(0).getBoundingClientRect()`；还需检查返回的 rect 尺寸是否有效（width/height > 0）
  3. 若仍无有效 rect，退到安全固定视口位置（如 `{ top: 100, left: window.innerWidth / 2 - 150 }`）

### 推荐

#### D. 状态点去掉误导性 active 类

- [x] `popup/popup.html:151` — 将 `<span class="status-dot active"></span>` 改为 `<span class="status-dot"></span>`

#### E. 版本号动态化

- [x] `popup/popup.html:154` — 将 `<span class="version">v1.0.0</span>` 改为 `<span class="version" id="app-version"></span>`
- [x] `popup/popup.js` — 初始化时填充：`document.getElementById('app-version').textContent = 'v' + chrome.runtime.getManifest().version`
- [x] `options/options.html:57` — 将 `版本 v1.0.0` 改为含 id 的占位元素，如 `<span id="app-version"></span>`
- [x] `options/options.js` — 初始化时填充：`document.getElementById('app-version').textContent = '版本 v' + chrome.runtime.getManifest().version`

### 顺手

#### B-顺手. Select 箭头颜色变量化

- [x] `options/options.css:183` — select 下拉箭头 SVG 中 `stroke='%236A6A6A'` 替换为 `var(--text-secondary)` 对应的颜色值，或改用 CSS 方案绘制箭头
- [x] 注意：data URL 内不能直接使用 CSS 变量，需要权衡实现方式（如改用 border trick 或 currentColor 方案）。如果成本过高可以跳过

## 不做的事

- **不改** `options.css:264` slider 圆点的 `white` — UI 设计值
- **不做** 服务健康检查（D 方案 b）— 复杂度不值得
- **不做** Popup loading state — 低优先级，留给后续
- **不做** TTS speak 公共模块提取 — 单独任务
- **不碰** service worker、manifest、translator.js

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check popup/popup.js` 通过
- [x] `node --check content/modules/selection.js` 通过
- [x] `git diff --check` 无输出
