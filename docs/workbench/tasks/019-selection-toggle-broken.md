---
status: done
priority: P0
created: 2026-03-13
---

# 019 — 划词翻译开关修复 & Options toast 去重 & 死设置清理

- 来源讨论: [discussions/019-selection-toggle-broken.md](../discussions/019-selection-toggle-broken.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/019-selection-toggle-broken.md](../discussions/019-selection-toggle-broken.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/selection.js` | A: handleMouseUp / handleDoubleClick 加 enableSelection 检查 |
| `options/options.js` | B: showToast 去重 |
| `src/core/storage.js` | C: 删除 enableHover 死设置 |
| `content/content.js` | C: 删除 enableHover 死设置 |
| `tests/selection-toggle.test.mjs` | A + B + C |

## 任务清单

### 必做

#### A. `enableSelection` 开关生效

在 `handleMouseUp` 和 `handleDoubleClick` 开头加 early return。必须在 handler 内动态检查 `ST.state.settings`，不能在 bind 时条件绑定（因为设置可通过 `storage.onChanged` 动态更新）。

**A1. handleMouseUp**

- [x] `content/modules/selection.js` — `ST.handleMouseUp` 函数开头（当前 line 11-12），在 `isPluginElement` 检查之前加入：
  ```javascript
  ST.handleMouseUp = function (e) {
      if (!ST.state.settings?.enableSelection) return;
      if (ST.isPluginElement(e.target)) return;
      // ... rest unchanged
  ```

**A2. handleDoubleClick**

- [x] `content/modules/selection.js` — `ST.handleDoubleClick` 函数开头（当前 line 47-48），在 input/textarea 检查之前加入：
  ```javascript
  ST.handleDoubleClick = function (e) {
      if (!ST.state.settings?.enableSelection) return;
      if (e.target.matches('input, textarea, [contenteditable="true"]')) {
      // ... rest unchanged
  ```

**不要做的事**：
- 不要改 `handleMouseDown` — 它只做 UI 清理（关闭气泡/图标），不受 enableSelection 控制
- 不要改 `showTranslation` / `translateSelection` 消息处理 — 那些是 popup/右键菜单的显式操作
- 不要在 `bindEvents()` 里条件绑定事件 — 设置可动态变化，必须运行时检查

### 必做

#### B. Options showToast 去重

与 popup 018-B 同模式。

- [x] `options/options.js` — `showToast()` 函数（当前 line 710-711），在创建新 toast 前清理所有旧的：
  ```javascript
  function showToast(message, type = 'success') {
      document.querySelectorAll('.toast').forEach(el => el.remove());
      const toast = document.createElement('div');
      // ... rest unchanged
  ```

### 推荐

#### C. 删除 `enableHover` 死设置

全仓无 UI、无运行时读取、无消息路径。从两处 defaults 中删除。

- [x] `src/core/storage.js` — DEFAULT_SETTINGS 中删除（当前 line 66）：
  ```javascript
  enableHover: false,       // 悬停翻译
  ```
- [x] `content/content.js` — mergeDefaults 中删除（当前 line 26）：
  ```javascript
  enableHover: false,
  ```

## 不做的事

- **不做** `refreshSettings` message handler 清理 — 不在 019 范围
- **不做** `content.js` mergeDefaults 与 `storage.js` DEFAULT_SETTINGS 合并 — 架构任务
- **不做** `handleMouseDown` 加 enableSelection 检查 — 它只做清理，无需控制
- **不碰** service worker、manifest、popup、sidebar、float-window、immersive、ad-blocker、floating-ball

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check content/modules/selection.js` 通过
- [x] `node --check options/options.js` 通过
- [x] `node --check src/core/storage.js` 通过
- [x] `node --check content/content.js` 通过
- [x] `git diff --check` 无输出
