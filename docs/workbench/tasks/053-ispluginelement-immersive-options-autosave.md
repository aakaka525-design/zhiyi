---
status: done
priority: P3
created: 2026-03-13
---

# 053 — 沉浸式翻译文本排除划词触发 & options 开关只保存自身字段

- 来源讨论: [discussions/053-ispluginelement-immersive-options-autosave.md](../discussions/053-ispluginelement-immersive-options-autosave.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/053-ispluginelement-immersive-options-autosave.md](../discussions/053-ispluginelement-immersive-options-autosave.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/selection.js` | A：新增 `isImmersiveElement` helper + `handleMouseUp`/`handleDoubleClick` 各加一行守卫 |
| `options/options.js` | B：新增 `saveImmediateToggle` helper + 两个 change handler 替换 |
| `tests/immersive-selection-options-toggle.test.mjs` | A + B |

## 任务清单

### 必做

#### A. 沉浸式翻译文本不再触发划词翻译

沉浸式翻译注入的译文（`.st-immersive-translation`、`.st-immersive-wrapper`、`.st-translation-separator`）不在 `isPluginElement` 检查范围内，选中或双击译文会触发二次翻译。不能直接扩展 `isPluginElement` — 那会改变 `handleMouseDown` 的语义（点击译文时不关闭 bubble）。

- [x] `content/modules/selection.js` — 在 `var ST = window.SmartTranslator;` 之后（当前 line 6 之后），新增 `isImmersiveElement` helper：
  ```javascript
  // 改前（line 6-7）
  var ST = window.SmartTranslator;

  /**

  // 改后
  var ST = window.SmartTranslator;

  function isImmersiveElement(el) {
      return el.closest('.st-immersive-wrapper') ||
          el.classList?.contains('st-immersive-translation') ||
          el.classList?.contains('st-translation-separator');
  }

  /**
  ```

  行为说明：
  - `el.closest('.st-immersive-wrapper')` — 覆盖 block 模式：wrapper 内所有子元素（`div.st-immersive-translation`）
  - `el.classList?.contains('st-immersive-translation')` — 覆盖 inline 模式：直接在原文容器内的翻译 span（无 wrapper 包裹，`closest` 找不到）
  - `el.classList?.contains('st-translation-separator')` — 覆盖 inline 模式的分隔符 span
  - `?.` 防御性调用：SVG 元素等可能没有 `classList`
  - 模块级 `function`，不挂在 `ST` 上 — 仅 selection 模块使用

- [x] `content/modules/selection.js` — 在 `handleMouseUp` 中（当前 line 14），在 `ST.isPluginElement` 检查之后，新增 `isImmersiveElement` 守卫：
  ```javascript
  // 改前（line 11-14）
  ST.handleMouseUp = function (e) {
      if (!ST.state.settings?.enableSelection) return;
      if (e.detail >= 2) return;
      if (ST.isPluginElement(e.target)) return;

  // 改后
  ST.handleMouseUp = function (e) {
      if (!ST.state.settings?.enableSelection) return;
      if (e.detail >= 2) return;
      if (ST.isPluginElement(e.target)) return;
      if (isImmersiveElement(e.target)) return;
  ```

- [x] `content/modules/selection.js` — 在 `handleDoubleClick` 中（当前 line 55-57），在 `ST.isPluginElement` 检查之后，新增 `isImmersiveElement` 守卫：
  ```javascript
  // 改前（line 55-57）
      if (ST.isPluginElement(e.target)) {
          return;
      }

  // 改后
      if (ST.isPluginElement(e.target)) {
          return;
      }
      if (isImmersiveElement(e.target)) return;
  ```

  行为说明：
  - `handleMouseUp`：选中沉浸式译文 → `isImmersiveElement` 返回 `true` → 跳过，不显示 icon/bubble
  - `handleDoubleClick`：双击沉浸式译文 → `removeIcon()` 先执行（清理残留），然后 `isPluginElement` 不匹配，`isImmersiveElement` 匹配 → 跳过，不触发二次翻译
  - `handleMouseDown`：不改 — 点击沉浸式译文仍然关闭现有 bubble/icon，保持"点击其他地方关闭弹窗"的用户预期

**不要做的事**：
- 不要改 `ST.isPluginElement()` — 它是共享 helper，改动会影响 `handleMouseDown` 和 `immersive.js` 观察器
- 不要改 `handleMouseDown` — 点击译文关闭 bubble 是正确行为
- 不要改 `immersive.js` — DOM 注入逻辑正确
- 不要改 `utils.js` — 共享工具函数不变
- 不要改 `showBubble`、`removeBubble`、`showIcon`、`removeIcon`

### 必做

#### B. options 深色模式/调试模式只保存自身字段

深色模式和调试模式的 change handler 调用 `saveSettings()` 导致所有表单值（包括未完成的 API Key 修改）被静默保存。

- [x] `options/options.js` — 在 `saveSettings()` 之后（当前 line 501 之后），新增 `saveImmediateToggle` helper：
  ```javascript
  // 在 saveSettings() 之后新增
  async function saveImmediateToggle(partialSettings) {
      try {
          await StorageManager.updateSettings(partialSettings);
          await chrome.runtime.sendMessage({ action: 'updateSettings' });
          initialSettingsSnapshot = buildSettingsSnapshot({ ...initialSettingsSnapshot, ...partialSettings });
          refreshDirtyState();
      } catch (err) {
          console.error('[智译] 保存开关设置失败:', err);
      }
  }
  ```

  行为说明：
  - `StorageManager.updateSettings(partialSettings)` 是 merge 模式 — 只更新传入的字段，其他字段保持 storage 中的值
  - `chrome.runtime.sendMessage({ action: 'updateSettings' })` 不传 `settings` — message-router 的 handler 只调用 `translator.refreshSettings()` 自己从 storage 读取
  - `initialSettingsSnapshot = buildSettingsSnapshot({...initialSettingsSnapshot, ...partialSettings})` — immutable 重赋值，只更新 snapshot 中对应字段的基线值
  - `refreshDirtyState()` — 重新比较完整 snapshot，其他字段的 dirty 状态保留
  - 不弹 toast — 深色模式/调试模式的视觉反馈已足够（UI 立即变化）
  - 失败只打 `console.error` — dirty 状态由 `refreshDirtyState()` 基于 form 当前值重算

- [x] `options/options.js` — 替换深色模式 change handler（当前 line 149-152）：
  ```javascript
  // 改前（line 149-152）
  elements.enableDarkMode.addEventListener('change', (e) => {
      applyDarkMode(e.target.checked);
      saveSettings(); // 自动保存
  });

  // 改后
  elements.enableDarkMode.addEventListener('change', (e) => {
      applyDarkMode(e.target.checked);
      saveImmediateToggle({ darkMode: e.target.checked });
  });
  ```

- [x] `options/options.js` — 替换调试模式 change handler（当前 line 155-158）：
  ```javascript
  // 改前（line 155-158）
  elements.enableDebugMode.addEventListener('change', async (e) => {
      await saveSettings();
      console.log('[智译] 调试模式:', e.target.checked ? '已开启' : '已关闭');
  });

  // 改后
  elements.enableDebugMode.addEventListener('change', async (e) => {
      await saveImmediateToggle({ debugMode: e.target.checked });
      console.log('[智译] 调试模式:', e.target.checked ? '已开启' : '已关闭');
  });
  ```

  行为说明：
  - 切换深色模式 → 只保存 `darkMode` 字段 → 其他表单字段的 dirty 状态不受影响
  - 切换调试模式 → 只保存 `debugMode` 字段 → 同上
  - 如果用户有未保存的 API Key 修改 → 切换开关后保存按钮仍显示"有未保存更改" → 用户必须明确点击保存
  - `buildSettingsSnapshot` 已在 `options-ui-state.js` 中 import（line 9），无需额外 import

**不要做的事**：
- 不要改 `saveSettings()` 函数 — 全量保存用于"保存按钮"点击场景
- 不要改 `collectCurrentSettings()` / `buildSettingsSnapshot()` — 快照机制正确
- 不要改 `loadSettings()` / `bindDirtyTracking()` — 加载和追踪逻辑正确
- 不要改 `options-ui-state.js`
- 不要给 `saveImmediateToggle` 加 toast

## 不做的事

- **不做** `isPluginElement` 改动 — 共享 helper 不碰
- **不做** `handleMouseDown` 改动 — "点击关闭"语义保持不变
- **不做** `immersive.js` 改动 — DOM 注入和观察器正确
- **不做** `saveSettings` 改动 — 全量保存场景正确
- **不做** `collectCurrentSettings` / `buildSettingsSnapshot` 改动 — 快照机制正确
- **不碰** popup.js、sidebar.js、float-window.js、floating-ball.js、content.js、ad-blocker.js、utils.js、immersive.js、options-ui-state.js、options.html、service-worker.js、message-router.js、tts.js、offscreen.js、storage.js、translator.js、manifest.json

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check content/modules/selection.js` 通过
- [x] `node --check options/options.js` 通过
- [x] `git diff --check` 无输出
