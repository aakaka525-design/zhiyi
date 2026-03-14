---
status: done
priority: P2
created: 2026-03-13
---

# 055 — 内容脚本深色模式 & 悬浮球拖拽偏移量修复

- 来源讨论: [discussions/055-content-darkmode-floatball-drag.md](../discussions/055-content-darkmode-floatball-drag.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/055-content-darkmode-floatball-drag.md](../discussions/055-content-darkmode-floatball-drag.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/content.css` | A：新增深色模式 CSS 变量覆盖块 |
| `content/content.js` | A：新增 `applyContentTheme` helper + 两处调用 |
| `content/modules/floating-ball.js` | B：`onMouseMove` 中用 `dragOffset` 替换硬编码 `20` |
| `tests/content-darkmode-floatball-drag.test.mjs` | A + B |

## 任务清单

### 必做

#### A. 内容脚本 UI 深色模式

内容脚本的所有插件 UI 元素（气泡、侧边栏、小窗、悬浮球、沉浸式译文、Toast、进度条）只有浅色 CSS 变量，忽略 `darkMode` 设置。popup 和 options 通过 `theme.css` 的 `body.dark-mode` 支持深色模式，但内容脚本不能用 `body.dark-mode`（会污染宿主页面）。

- [x] `content/content.css` — 在当前浅色变量块（line 6-29）之后，新增深色变量覆盖块：
  ```css
  /* 改前（line 29 之后是 line 31 的 #st-toast { ... }）*/

  /* 改后（在 line 29 的 } 和 line 31 的 #st-toast { 之间插入）*/

  :root[data-st-theme="dark"] #smart-translator-bubble,
  :root[data-st-theme="dark"] .st-immersive-wrapper,
  :root[data-st-theme="dark"] #st-sidebar,
  :root[data-st-theme="dark"] #st-sidebar-toggle-btn,
  :root[data-st-theme="dark"] #st-float-window,
  :root[data-st-theme="dark"] #st-page-progress,
  :root[data-st-theme="dark"] #st-floating-ball-container,
  :root[data-st-theme="dark"] #smart-translator-icon,
  :root[data-st-theme="dark"] .st-immersive-translation,
  :root[data-st-theme="dark"] .st-translation-separator,
  :root[data-st-theme="dark"] #st-toast {
      --accent: #8FB3A4;
      --accent-light: #A7C9BD;
      --accent-glow: rgba(143, 179, 164, 0.3);
      --bg-secondary: #282C34;
      --bg-tertiary: #323642;
      --surface: rgba(30, 34, 43, 0.95);
      --text-primary: #E8E8E8;
      --text-secondary: #B0B0B0;
      --text-tertiary: #949494;
      --border-color: rgba(255, 255, 255, 0.08);
      --error: #EF9A9A;
  }
  ```

  行为说明：
  - `:root[data-st-theme="dark"]` 选择器 — 只在 `<html>` 元素有 `data-st-theme="dark"` 属性时生效
  - 选择器列表与浅色块完全一致 — 覆盖相同的插件元素集合
  - 深色变量值取自 `options/theme.css:71-99` 的 `body.dark-mode` — 保持全项目视觉一致
  - `--surface: rgba(30, 34, 43, 0.95)` — 半透明深色背景，适应不同宿主页面
  - `--transition` 不需要覆盖 — 浅色块的值在深色模式下仍适用
  - 不影响宿主页面 — 宿主的 CSS 不会匹配 `[data-st-theme]` 选择器

- [x] `content/content.js` — 在 `mergeDefaults` 函数之后、`loadSettings` 函数之前（当前 line 48 和 line 50 之间），新增 `applyContentTheme` helper：
  ```javascript
  // 改前（line 48-50）
  }

  /**
   * 加载设置

  // 改后
  }

  function applyContentTheme(enabled) {
      if (enabled) {
          document.documentElement.setAttribute('data-st-theme', 'dark');
      } else {
          document.documentElement.removeAttribute('data-st-theme');
      }
  }

  /**
   * 加载设置
  ```

  行为说明：
  - `document.documentElement` = `<html>` 元素
  - `setAttribute('data-st-theme', 'dark')` — 设置属性触发 CSS 深色变量覆盖
  - `removeAttribute('data-st-theme')` — 移除属性回到浅色变量
  - 模块级函数，不挂在 `ST` 上 — 仅 content.js 使用

- [x] `content/content.js` — 在 `init()` 函数中，`await loadSettings()` 之后（当前 line 144-145 之间），新增 `applyContentTheme` 调用：
  ```javascript
  // 改前（line 143-145）
  async function init() {
      await loadSettings();
      bindEvents();

  // 改后
  async function init() {
      await loadSettings();
      applyContentTheme(ST.state.settings?.darkMode);
      bindEvents();
  ```

- [x] `content/content.js` — 在 `chrome.storage.onChanged` 监听器中，`ST.state.settings = mergeDefaults(...)` 之后（当前 line 132-133 之间），新增 `applyContentTheme` 调用：
  ```javascript
  // 改前（line 131-134）
  if (areaName === 'local' && changes.settings) {
      ST.state.settings = mergeDefaults(changes.settings.newValue);
      if (ST.state.settings?.showFloatingBall === true && ST.floatingBall?.init) {
          ST.floatingBall.init();

  // 改后
  if (areaName === 'local' && changes.settings) {
      ST.state.settings = mergeDefaults(changes.settings.newValue);
      applyContentTheme(ST.state.settings?.darkMode);
      if (ST.state.settings?.showFloatingBall === true && ST.floatingBall?.init) {
          ST.floatingBall.init();
  ```

  行为说明：
  - `init()` 调用 — 首次加载时根据存储的 darkMode 设置切换主题
  - `onChanged` 调用 — 用户在设置页切换深色模式时实时响应
  - 两处用同一个 `applyContentTheme` helper — 避免两套路径（Codex 约束）
  - `?.darkMode` — 防御性调用，settings 未加载时不切换

**不要做的事**：
- 不要用 `body.dark-mode` — 会污染宿主页面
- 不要给每个插件元素单独加 `.st-dark` class — 沉浸式译文元素分散，逐个加 class 不实际
- 不要改 `options/theme.css` — popup/options 的深色模式逻辑正确
- 不要改 popup.js 中的 `applyDarkMode` — popup 通过 `body.dark-mode` 切换是正确的（popup 有自己的 body）
- 不要改 `options/options.js` 中的深色模式 handler — 053 已修复
- 不要改 `content/content.css` 中已有的浅色变量值
- 不要改任何 content module（sidebar.js、float-window.js、selection.js、immersive.js 等）— 它们通过 CSS 变量自动继承主题

### 必做

#### B. 悬浮球拖拽偏移量修复

`onMouseDown` 计算了 `dragOffset`（鼠标相对于球体的偏移），但 `onMouseMove` 硬编码 `20` 未使用它，导致拖拽时球跳到光标中心。

- [x] `content/modules/floating-ball.js` — `onMouseMove` 中替换硬编码的 `20`（当前 line 216-217）：
  ```javascript
  // 改前（line 216-217）
  let newLeft = clientX - 20; // Center approximation
  let newTop = clientY - 20;

  // 改后
  let newLeft = clientX - dragOffset.x;
  let newTop = clientY - dragOffset.y;
  ```

  行为说明：
  - `dragOffset.x/y` 在 `onMouseDown`（line 194-198）中根据 `ball.getBoundingClientRect()` 计算
  - 拖拽时球体保持用户的抓取点位置，不再跳到光标中心
  - 释放后 `dockToEdge()` 吸附逻辑不受影响

**不要做的事**：
- 不要改 `onMouseDown` — dragOffset 计算正确
- 不要改 `onMouseUp` / `dockToEdge` — 释放和吸附逻辑正确
- 不要改 resize handler — 047 已修复
- 不要引入新的状态变量

## 不做的事

- **不做** `body.dark-mode` 方案 — 会污染宿主页面
- **不做** `options/theme.css` 改动 — popup/options 深色模式正确
- **不做** popup.js `applyDarkMode` 改动 — popup 有自己的 body 上下文
- **不做** content module 改动 — CSS 变量继承自动覆盖
- **不做** `dockToEdge` / 吸附逻辑改动 — 释放后行为正确
- **不碰** popup.js、options.js、options-ui-state.js、options.html、popup.html、service-worker.js、message-router.js、tts.js、offscreen.js、storage.js、translator.js、manifest.json、selection.js、sidebar.js、float-window.js、immersive.js、ad-blocker.js、utils.js、menus.js

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check content/content.js` 通过
- [x] `content/content.css` — 本轮未跑单独 CSS lint，靠 `node --test tests/*.test.mjs` 的静态断言覆盖结构验证
- [x] `node --check content/modules/floating-ball.js` 通过
- [x] `git diff --check` 无输出
