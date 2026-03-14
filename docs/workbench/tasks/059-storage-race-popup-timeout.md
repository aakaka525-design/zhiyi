---
status: done
priority: P1/P2
created: 2026-03-13
---

# 059 — Background Settings Patch 单入口 & Popup 翻译/TTS 超时保护

- 来源讨论: [discussions/059-storage-race-popup-timeout.md](../discussions/059-storage-race-popup-timeout.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/059-storage-race-popup-timeout.md](../discussions/059-storage-race-popup-timeout.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `background/modules/message-router.js` | A：新增 `patchSettings` action + module-level queue |
| `content/modules/sidebar.js` | A：`saveLanguageSettings` 改为 sendMessage |
| `content/modules/float-window.js` | A：`saveLanguageSettings` 改为 sendMessage |
| `popup/popup.js` | A：`saveLanguageSettings` 改为 sendMessage；B：新增 `withTimeout` + 3 处 timeout |
| `options/options.js` | A：`saveImmediateToggle` + `saveSettings` 改为 sendMessage |
| `tests/059-storage-race-popup-timeout.test.mjs` | A + B |

## 任务清单

### 必做

#### A. Background Settings Patch 单入口 — 消除跨上下文 read-modify-write 竞态

所有 UI 上下文（popup、options、content script）不再直接写 `chrome.storage.local` 的 settings，统一通过 background 的 `patchSettings` action 串行化写入。

- [x] `background/modules/message-router.js` — 新增 module-level queue 和 `patchSettings` case（在 `updateSettings` case 之前插入）：
  ```javascript
  // 改前（line 1-42 整体）
  export async function routeMessage(request, deps) {
      const { translator, storage, tts } = deps;

      switch (request.action) {
          // ... existing cases ...

          case 'updateSettings':
              await translator.refreshSettings();
              return { success: true };

          default:
              // ...
      }
  }

  // 改后
  let settingsQueue = Promise.resolve();

  export async function routeMessage(request, deps) {
      const { translator, storage, tts } = deps;

      switch (request.action) {
          // ... existing cases ...

          case 'patchSettings': {
              const task = settingsQueue.then(async () => {
                  await storage.updateSettings(request.updates);
                  await translator.refreshSettings();
                  return { success: true };
              });
              settingsQueue = task.catch(() => {});
              return task;
          }

          case 'updateSettings':
              await translator.refreshSettings();
              return { success: true };

          default:
              // ...
      }
  }
  ```

  行为说明：
  - `settingsQueue` 是 module-level 变量 — background/service worker 是单进程，所有消息经过同一个 `routeMessage`，queue 保证串行
  - `settingsQueue = task.catch(() => {})` — 如果某次写入失败，不阻塞后续写入
  - `return task` — 调用方仍能拿到 reject（如果写入失败）
  - `storage.updateSettings(request.updates)` — 复用 `StorageManager.updateSettings` 的 `sanitizeSettings` 逻辑
  - `translator.refreshSettings()` — 写入后立即刷新 translator 设置，与现有 `updateSettings` action 行为一致
  - 保留 `updateSettings` action — 向后兼容，仅做 refreshSettings

- [x] `content/modules/sidebar.js` — `saveLanguageSettings` 改为 sendMessage（当前 line 120-126）：
  ```javascript
  // 改前（line 120-126）
  const saveLanguageSettings = async (partialSettings) => {
      const result = await chrome.storage.local.get('settings');
      const settings = result.settings || {};
      await chrome.storage.local.set({
          settings: { ...settings, ...partialSettings },
      });
  };

  // 改后
  const saveLanguageSettings = (partialSettings) => {
      ST.sendMessage({ action: 'patchSettings', updates: partialSettings });
  };
  ```

  行为说明：
  - Fire-and-forget — 语言切换是频繁操作，不需要 await 结果
  - 不再直接读写 `chrome.storage.local` — 消除与其他上下文的竞态
  - Background queue 串行处理 — 快速切换 source+target 不再互相覆盖
  - `chrome.storage.onChanged` 仍由 background 的 `storage.updateSettings` → `chrome.storage.local.set` 触发 → `ST.syncLanguageSelects` 仍然生效

- [x] `content/modules/sidebar.js` — swap 中的 `saveLanguageSettings` 调用不需要改（当前 line 153）：
  ```javascript
  saveLanguageSettings({ sourceLang: t, targetLang: s });
  // 已经是 fire-and-forget 调用，新实现也是 fire-and-forget，无需修改调用方式
  ```

- [x] `content/modules/float-window.js` — `saveLanguageSettings` 改为 sendMessage（当前 line 85-91）：
  ```javascript
  // 改前（line 85-91）
  const saveLanguageSettings = async (partialSettings) => {
      const result = await chrome.storage.local.get('settings');
      const settings = result.settings || {};
      await chrome.storage.local.set({
          settings: { ...settings, ...partialSettings },
      });
  };

  // 改后
  const saveLanguageSettings = (partialSettings) => {
      ST.sendMessage({ action: 'patchSettings', updates: partialSettings });
  };
  ```

  行为说明：与 sidebar 完全一致。

- [x] `popup/popup.js` — `saveLanguageSettings` 改为 sendMessage（当前 line 91-96）：
  ```javascript
  // 改前（line 91-96）
  async function saveLanguageSettings() {
      await StorageManager.updateSettings({
          sourceLang: elements.sourceLang.value,
          targetLang: elements.targetLang.value,
      });
  }

  // 改后
  function saveLanguageSettings() {
      chrome.runtime.sendMessage({
          action: 'patchSettings',
          updates: {
              sourceLang: elements.sourceLang.value,
              targetLang: elements.targetLang.value,
          },
      });
  }
  ```

  行为说明：
  - Fire-and-forget — 与 sidebar/float-window 保持一致
  - 不再调用 `StorageManager.updateSettings` — 消除 popup 与其他上下文的竞态

- [x] `options/options.js` — `saveImmediateToggle` 改为 sendMessage（当前 line 507-516）：
  ```javascript
  // 改前（line 507-516）
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

  // 改后
  async function saveImmediateToggle(partialSettings) {
      try {
          await chrome.runtime.sendMessage({ action: 'patchSettings', updates: partialSettings });
          initialSettingsSnapshot = buildSettingsSnapshot({ ...initialSettingsSnapshot, ...partialSettings });
          refreshDirtyState();
      } catch (err) {
          console.error('[智译] 保存开关设置失败:', err);
      }
  }
  ```

  行为说明：
  - 原来两步操作（`StorageManager.updateSettings` + `sendMessage({action: 'updateSettings'})`）合并为一步
  - `patchSettings` 内部已调用 `translator.refreshSettings()`，不需要再单独发 `updateSettings`
  - `initialSettingsSnapshot` 更新和 `refreshDirtyState` 在 `await` 之后执行 — 保证 background 写入成功后才更新本地快照

- [x] `options/options.js` — `saveSettings` 改为 sendMessage（当前 line 488-505）：
  ```javascript
  // 改前（line 488-505）
  async function saveSettings() {
      const settings = collectCurrentSettings();

      try {
          await StorageManager.updateSettings(settings);
          const response = await chrome.runtime.sendMessage({ action: 'updateSettings', settings });
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
  ```

  行为说明：
  - 原来两步操作合并为一步 `patchSettings`
  - `patchSettings` 返回 `{ success: true }` — 不含 `error` 字段，正常路径不会 throw
  - 如果 background 写入失败 → sendMessage catch → `showToast('保存失败: ...')`

**不要做的事**：
- 不要删除 `updateSettings` action — 保留向后兼容
- 不要改 `StorageManager.updateSettings` 本身 — 它仍是 background 内部使用的正确实现
- 不要给 `patchSettings` 加超时 — settings 写入是快速本地操作
- 不要改 `StorageManager.getSettings` 或 `getHistory` — 只读操作不需要串行化
- 不要改 `addHistory` — 历史写入是独立 key，不受 settings 竞态影响
- 不要在 sidebar/float-window 的 `saveLanguageSettings` 中 await sendMessage — fire-and-forget 降低 UI 阻塞
- 不要移除 options.js 对 `StorageManager` 的 import — `loadSettings` 等其他读操作仍使用它

#### B. Popup 翻译/TTS 超时保护

058-A 只覆盖 content script 的 `ST.sendMessage`。Popup 使用本地 Translator 实例和独立的 `chrome.runtime.sendMessage`，全部无超时。

- [x] `popup/popup.js` — 在文件顶部（`import` 之后、`MAX_CHARS` 之前）新增 `withTimeout` helper：
  ```javascript
  // 在 line 37 (import 之后) 和 line 38 (MAX_CHARS) 之间新增
  function withTimeout(promise, ms, message = '请求超时') {
      let timeoutId;
      return Promise.race([
          promise,
          new Promise((_, reject) => {
              timeoutId = setTimeout(() => reject(new Error(message)), ms);
          }),
      ]).finally(() => clearTimeout(timeoutId));
  }
  ```

  行为说明：
  - 与 `options/options.js:15-23` 完全相同的模式
  - 放在 popup 本地 — Codex 明确要求不与 options 共享，等出现第三处再抽共享
  - `finally(clearTimeout)` — 正常 resolve/reject 后清理 timer

- [x] `popup/popup.js` — `handleTranslate` 中 `translator.translate` 调用加 30s 超时（当前 line 287）：
  ```javascript
  // 改前（line 287）
  const result = await translator.translate(text, sourceLang, targetLang);

  // 改后
  const result = await withTimeout(
      translator.translate(text, sourceLang, targetLang),
      30000,
      '翻译请求超时'
  );
  ```

  行为说明：
  - 30000ms — 与 058-A 的 content script 翻译超时保持一致
  - 超时后 reject → `catch` 显示 "翻译请求超时" → `finally` 执行 `setLoading(false)`

- [x] `popup/popup.js` — `speak` 函数中 `requestTtsAudio` 调用加 15s 超时（当前 line 436）：
  ```javascript
  // 改前（line 436）
  const audioData = await requestTtsAudio(provider, text, lang, settings, speed);

  // 改后
  const audioData = await withTimeout(
      requestTtsAudio(provider, text, lang, settings, speed),
      15000,
      'TTS 请求超时'
  );
  ```

  行为说明：
  - 15000ms — 与 `options/options.js:350` 的 TTS 测试超时保持一致
  - 超时后 → `catch` 在 speak 内部 → fallback 到 system TTS（line 445-447）

- [x] `popup/popup.js` — `speak` 函数中 offscreen play sendMessage 加 15s 超时（当前 line 437-440）：
  ```javascript
  // 改前（line 437-440）
  const response = await chrome.runtime.sendMessage({
      action: 'playAudioOffscreen',
      audioData,
  });

  // 改后
  const response = await withTimeout(
      chrome.runtime.sendMessage({
          action: 'playAudioOffscreen',
          audioData,
      }),
      15000,
      '播放超时'
  );
  ```

  行为说明：
  - 15000ms — 与 `options/options.js:357-363` 的播放超时保持一致
  - 超时后 → throw → speak catch → fallback 到 system TTS

**不要做的事**：
- 不要给 system TTS 加超时 — Codex 明确拒绝，与 056 保持一致，留后续单列
- 不要把 `withTimeout` 移到共享位置 — Codex 要求先在 popup 本地放一份
- 不要改 `requestTtsAudio` 内部的 sendMessage — 它们各自的超时由外层 `withTimeout(requestTtsAudio(...))` 覆盖
- 不要改 options.js 的 `withTimeout` — 不碰
- 不要改 content script 的 `ST.sendMessage` — 058-A 已修

## 不做的事

- **不做** system TTS `onend` 不触发问题 — 与 058-B 一起留后续单列
- **不做** 本地 mutex / 锁 — Codex 明确拒绝，跨上下文无效
- **不做** `StorageManager.updateSettings` 内部修改 — background 内部使用仍正确
- **不做** `addHistory` / `getHistory` 串行化 — 独立 key 不受影响
- **不删除** `updateSettings` action — 保留向后兼容
- **不碰** content.js、selection.js、immersive.js、floating-ball.js、ad-blocker.js、utils.js、service-worker.js、tts.js、offscreen.js、storage.js、translator.js、manifest.json、menus.js

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check background/modules/message-router.js` 通过
- [x] `node --check content/modules/sidebar.js` 通过
- [x] `node --check content/modules/float-window.js` 通过
- [x] `node --check popup/popup.js` 通过
- [x] `node --check options/options.js` 通过
- [x] `git diff --check` 无输出
