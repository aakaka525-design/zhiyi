---
status: done
priority: P2
created: 2026-03-13
---

# 058 — ST.sendMessage 可选超时 & 翻译调用点 opt-in & 语言 Select 响应 Storage 变更

- 来源讨论: [discussions/058-translate-timeout-speak-cancel-reactive-select.md](../discussions/058-translate-timeout-speak-cancel-reactive-select.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/058-translate-timeout-speak-cancel-reactive-select.md](../discussions/058-translate-timeout-speak-cancel-reactive-select.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/utils.js` | A：`ST.sendMessage` 增加可选 timeout 参数 |
| `content/modules/sidebar.js` | A：translate 调用传 timeout |
| `content/modules/float-window.js` | A：translate 调用传 timeout |
| `content/content.js` | C：`onChanged` handler 新增 `ST.syncLanguageSelects?.()` 调用 |
| `tests/058-translate-timeout-reactive-select.test.mjs` | A + C |

## 任务清单

### 必做

#### A. `ST.sendMessage` 可选超时 + 翻译调用点 opt-in

内容脚本的翻译路径在任何层级都没有超时保护。如果 service worker 无响应或网络异常，`ST.sendMessage` 返回的 Promise 永不 settle → sidebar/float-window 的 `finally` 永远不执行 → 所有控件永久 disabled。

- [x] `content/modules/utils.js` — 给 `ST.sendMessage` 增加可选 `timeoutMs` 和 `timeoutMessage` 参数（当前 line 17-27）：
  ```javascript
  // 改前（line 17-27）
  ST.sendMessage = function (message) {
      return new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(message, (response) => {
              if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
              } else {
                  resolve(response);
              }
          });
      });
  };

  // 改后
  ST.sendMessage = function (message, timeoutMs = 0, timeoutMessage = '请求超时') {
      const request = new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(message, (response) => {
              if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
              } else {
                  resolve(response);
              }
          });
      });

      if (timeoutMs <= 0) return request;

      let timeoutId;
      return Promise.race([
          request,
          new Promise((_, reject) => {
              timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
          }),
      ]).finally(() => clearTimeout(timeoutId));
  };
  ```

  行为说明：
  - 默认 `timeoutMs = 0` → 无超时 → **完全向后兼容**，所有现有调用不受影响
  - `timeoutMs > 0` 时使用 `Promise.race` + `setTimeout` — 与 `options.js` 的 `withTimeout` 模式一致
  - `finally(() => clearTimeout(timeoutId))` — 正常 resolve/reject 后清理 timer 防止泄漏
  - `timeoutMessage` 可选自定义 — 方便不同调用点显示有意义的错误信息

- [x] `content/modules/sidebar.js` — translate 调用传 30000ms 超时（当前 line 316-321）：
  ```javascript
  // 改前（line 316-321）
  const response = await ST.sendMessage({
      action: 'translate',
      text: text,
      from: sourceLangSelect.value,
      to: targetLangSelect.value
  });

  // 改后
  const response = await ST.sendMessage({
      action: 'translate',
      text: text,
      from: sourceLangSelect.value,
      to: targetLangSelect.value
  }, 30000, '翻译请求超时');
  ```

  行为说明：
  - 30000ms（30 秒）— 翻译含 fallback 链（主 → google → offline），需要留足够时间
  - 超时后 reject → 进入 `catch` 块 → 显示 "错误: 翻译请求超时" → `finally` 恢复所有控件
  - 只改 translate 调用 — `addHistory` 等其他 `sendMessage` 调用不加超时（不锁 UI）

- [x] `content/modules/float-window.js` — translate 调用传 30000ms 超时（当前 line 217-221）：
  ```javascript
  // 改前（line 217-221）
  const response = await ST.sendMessage({
      action: 'translate',
      text: text,
      to: targetLangSelect.value
  });

  // 改后
  const response = await ST.sendMessage({
      action: 'translate',
      text: text,
      to: targetLangSelect.value
  }, 30000, '翻译请求超时');
  ```

  行为说明：
  - 与 sidebar 一致 — 30000ms + 相同错误消息
  - 超时后进入 `catch` → 显示错误 → `finally` 恢复控件

**不要做的事**：
- 不要改 `background/modules/message-router.js` — 本轮不做 AbortController
- 不要改 `src/core/translator.js` — 不碰 fetch 层
- 不要给 `addHistory`、`ttsOpenAI`、`ttsGoogle`、`ttsGLM`、`playAudioOffscreen` 等调用加超时 — 它们要么不锁 UI，要么属于 B（本轮不做）
- 不要在 `ST.sendMessage` 内部自动对所有调用加默认超时 — 只让需要的调用点显式 opt-in
- 不要修改 `options.js` 的 `withTimeout` — 它是 options 页独立的工具函数，不需要统一

#### C. Sidebar/Float-window 语言 Select 响应 Storage 变更

057 新增了 `saveLanguageSettings` 写入 storage，但 `content.js` 的 `chrome.storage.onChanged` handler 只更新 `ST.state.settings` 对象，不更新 sidebar/float-window 的 select DOM 元素。多 tab 场景下 select 显示旧值。

- [x] `content/content.js` — 在 `chrome.storage.onChanged` handler 中新增 `ST.syncLanguageSelects?.()` 调用（当前 line 138-147）：
  ```javascript
  // 改前（line 138-147）
  chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.settings) {
          ST.state.settings = mergeDefaults(changes.settings.newValue);
          applyContentTheme(ST.state.settings?.darkMode);
          if (ST.state.settings?.showFloatingBall === true && ST.floatingBall?.init) {
              ST.floatingBall.init();
          }
          console.log('[智译] 设置已自动更新');
      }
  });

  // 改后
  chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.settings) {
          ST.state.settings = mergeDefaults(changes.settings.newValue);
          applyContentTheme(ST.state.settings?.darkMode);
          if (ST.state.settings?.showFloatingBall === true && ST.floatingBall?.init) {
              ST.floatingBall.init();
          }
          ST.syncLanguageSelects?.();
          console.log('[智译] 设置已自动更新');
      }
  });
  ```

  行为说明：
  - `ST.syncLanguageSelects?.()` — 可选链调用，如果函数不存在（模块未加载）则跳过
  - 放在 `floatingBall.init()` 之后、`console.log` 之前 — 按 UI 组件依次同步
  - 同 tab 自己写入触发 onChanged 后也会同步一次 — 冗余但无害

- [x] `content/content.js` — 在 `chrome.storage.onChanged` handler 之后（当前 line 147 之后），定义 `ST.syncLanguageSelects`：
  ```javascript
  // 在 line 147 后新增
  ST.syncLanguageSelects = function () {
      const s = ST.state.settings;
      if (!s) return;
      const sidebar = document.getElementById('st-sidebar');
      if (sidebar) {
          const src = sidebar.querySelector('#st-sidebar-source-lang');
          const tgt = sidebar.querySelector('#st-sidebar-target-lang');
          if (src && s.sourceLang) src.value = s.sourceLang;
          if (tgt && s.targetLang) tgt.value = s.targetLang;
      }
      const fw = document.getElementById('st-float-window');
      if (fw) {
          const tgt = fw.querySelector('#st-float-target-lang');
          if (tgt && s.targetLang) tgt.value = s.targetLang;
      }
  };
  ```

  行为说明：
  - 放在 `content.js` 而非 `utils.js` — Codex 明确同意，只需要一处
  - 先检查 `document.getElementById` — sidebar/float-window 可能未创建（未打开过）则跳过
  - 用 `querySelector` 精确定位 select — 不用遍历
  - `s.sourceLang` / `s.targetLang` 可能为 undefined — 用 `if` guard 避免设置空值
  - 不区分来自同 tab 还是其他 tab — 冗余同步无副作用

**不要做的事**：
- 不要把 `syncLanguageSelects` 放到 `utils.js` — 只有 `content.js` 需要
- 不要检测"是否来自本 tab" — 增加复杂度无实际收益
- 不要检查"用户是否正在操作 select" — 无证据表明会形成冲突
- 不要修改 `sidebar.js` 或 `float-window.js` 的初始化代码 — 初始化从 `ST.state.settings` 读取仍然正确
- 不要修改 `saveLanguageSettings` — 057 已实现且正确
- 不要改 popup.js — popup 运行在独立页面，不受 content script 的 storage onChanged 影响

## 不做的事

- **不做** B（朗读超时/取消）— Codex 明确拒绝当前 30s `runSpeak` 超时方案，留后续轮次
- **不做** AbortController / fetch 超时 — 不碰 background 和 translator 层
- **不做** system TTS `onend` 不触发问题 — 与 B 一起留后续
- **不做** offscreen `stopAudio` — 范围过大
- **不碰** popup.js、popup.html、options.js、options.html、options-ui-state.js、service-worker.js、message-router.js、tts.js、offscreen.js、storage.js、translator.js、manifest.json、selection.js、immersive.js、ad-blocker.js、floating-ball.js、menus.js

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check content/modules/utils.js` 通过
- [x] `node --check content/modules/sidebar.js` 通过
- [x] `node --check content/modules/float-window.js` 通过
- [x] `node --check content/content.js` 通过
- [x] `git diff --check` 无输出
