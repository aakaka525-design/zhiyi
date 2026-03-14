---
status: done
priority: P2
created: 2026-03-14
---

# 062 — 沉浸式 SPA DOM 脱离注入 & Options 保存覆盖并发修改

- 来源讨论: [discussions/062-immersive-detach-options-stale.md](../discussions/062-immersive-detach-options-stale.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/062-immersive-detach-options-stale.md](../discussions/062-immersive-detach-options-stale.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | A：`injectTranslation` 加 `document.contains()` 守卫 |
| `options/options.js` | B：`saveSettings()` 改为 diff-only 保存 + merge 更新 snapshot |
| `tests/062-immersive-detach-options-stale.test.mjs` | 回归测试 |

## 任务清单

### 必做

#### A. `injectTranslation` 加 `document.contains()` 守卫

- [x] `content/modules/immersive.js:160` — 在函数体最开头加守卫：
  ```javascript
  // 改前（line 160）
  ST.injectTranslation = function (container, translation) {
      const nextSibling = container.nextElementSibling;

  // 改后
  ST.injectTranslation = function (container, translation) {
      if (!document.contains(container)) return;
      const nextSibling = container.nextElementSibling;
  ```

  行为说明：
  - 正常 DOM 中的元素：`document.contains()` = true → 与之前完全相同
  - SPA 路由切换后脱离文档的元素：`document.contains()` = false → 跳过注入
  - 同时覆盖 block 路径（line 196 `parentNode.insertBefore`）和 inline 路径（line 184 `appendChild`）
  - 性能开销可忽略（原生 DOM 方法，O(depth)，每次几微秒）

#### B. `saveSettings()` 改为 diff-only 保存

- [x] `options/options.js:488-503` — 改为只发差异字段：
  ```javascript
  // 改前（line 488-503）
  async function saveSettings() {
      const settings = collectCurrentSettings();

      try {
          const response = await chrome.runtime.sendMessage({ action: 'patchSettings', updates: settings });
          if (response?.error) {
              throw new Error(response.error);
          }
          initialSettingsSnapshot = settings;
          setDirtyState(false);
          showToast('设置保存成功');
      } catch (err) {
          refreshDirtyState();
          showToast('保存失败: ' + err.message, 'error');
      }
  }

  // 改后
  async function saveSettings() {
      const current = collectCurrentSettings();
      const diff = {};
      for (const key of Object.keys(current)) {
          if (current[key] !== initialSettingsSnapshot[key]) {
              diff[key] = current[key];
          }
      }

      if (Object.keys(diff).length === 0) {
          setDirtyState(false);
          return;
      }

      try {
          const response = await chrome.runtime.sendMessage({ action: 'patchSettings', updates: diff });
          if (response?.error) {
              throw new Error(response.error);
          }
          initialSettingsSnapshot = buildSettingsSnapshot({ ...initialSettingsSnapshot, ...diff });
          setDirtyState(false);
          showToast('设置保存成功');
      } catch (err) {
          refreshDirtyState();
          showToast('保存失败: ' + err.message, 'error');
      }
  }
  ```

  行为说明：
  - 计算 `current` 与 `initialSettingsSnapshot` 的逐字段 diff
  - diff 为空时直接 `setDirtyState(false)` + return（无变化无需网络请求）
  - `patchSettings` 只发送用户实际修改的字段 → 不覆盖其他上下文的并发修改
  - 保存成功后用 `buildSettingsSnapshot({ ...initialSettingsSnapshot, ...diff })` 合并更新基线
  - **关键约束**：绝不能写 `initialSettingsSnapshot = current`（会把陈旧 DOM 的未修改字段值写回基线）

#### C. 回归测试

- [x] 新建 `tests/062-immersive-detach-options-stale.test.mjs`，至少覆盖：
  1. **A — DOM 脱离守卫**：`injectTranslation` 源码第一条有效语句是 `document.contains` 检查
  2. **B — diff-only 保存**：`saveSettings` 发送给 `patchSettings` 的 `updates` 只包含变化字段，不包含未修改字段
  3. **B — snapshot merge**：`saveSettings` 成功后 `initialSettingsSnapshot` 是通过 merge（`{ ...initialSettingsSnapshot, ...diff }`）更新，不是直接赋值整份 DOM 快照

**不要做的事**：
- 不要在 batch loop（line 118-125）或 observer 回调（line 276-281）里加 `document.contains()` 检查 — `injectTranslation` 内部的守卫已覆盖
- 不要给 `injectTranslation` 加返回值
- 不要修改 `translatedCount` 统计逻辑或 toast 消息
- 不要给 options.js 加 `chrome.storage.onChanged` 监听器 — 这是后续增强，不在本轮范围
- 不要改 `collectCurrentSettings()` 或 `buildSettingsSnapshot()` 函数
- 不要改 `saveImmediateToggle()` — 053 已正确实现
- 不要碰 content.js、sidebar.js、float-window.js、popup.js、service-worker.js、message-router.js、tts.js、offscreen.js、selection.js、floating-ball.js、ad-blocker.js、utils.js、storage.js、translator.js、manifest.json、menus.js、options-ui-state.js

## 不做的事

- **不做** 整页 reactive storage 同步（`storage.onChanged` → DOM 回写）— Codex 明确排除，可作为后续增强
- **不做** `translatedCount`/toast 统计准确性修复 — 更早就存在的独立问题
- **不做** batch loop / observer callback 内的 `document.contains()` 重复检查

## 验证要求

- [x] `node --test tests/062-immersive-detach-options-stale.test.mjs` 通过
- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check content/modules/immersive.js` 通过
- [x] `node --check options/options.js` 通过
- [x] `git diff --check` 无输出
