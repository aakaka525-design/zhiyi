---
status: done
priority: P3
created: 2026-03-13
---

# 050 — Popup 收藏按钮 toggle & 快捷入口受限 URL 守卫

- 来源讨论: [discussions/050-popup-favorite-toggle-restricted-url-guard.md](../discussions/050-popup-favorite-toggle-restricted-url-guard.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/050-popup-favorite-toggle-restricted-url-guard.md](../discussions/050-popup-favorite-toggle-restricted-url-guard.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `popup/popup.js` | A：收藏按钮 toggle + trim 一致性；B：共享 helper + 4 处调用点替换 |
| `tests/popup-favorite-toggle-url-guard.test.mjs` | A + B |

## 任务清单

### 必做

#### A. 收藏按钮改为 toggle（加/删切换）+ trim 一致性

收藏按钮 click handler 只调用 `addFavorite()`，无 `removeFavorite()` 路径；同时 `sourceText` 未 trim 导致与 `syncFavoriteState()` 键不一致。

- [x] `popup/popup.js` — 替换收藏按钮 click handler（当前 line 182-197）：
  ```javascript
  // 改前（line 182-197）
  elements.btnFavorite.addEventListener('click', async () => {
      if (currentResult && elements.sourceText.value) {
          const result = await StorageManager.addFavorite({
              source: elements.sourceText.value,
              target: currentResult,
              sourceLang: elements.sourceLang.value,
              targetLang: elements.targetLang.value,
          });
          if (result) {
              showToast('已添加到收藏');
          } else {
              showToast('已在收藏中');
          }
          syncFavoriteState();
      }
  });

  // 改后
  elements.btnFavorite.addEventListener('click', async () => {
      const sourceText = elements.sourceText.value.trim();
      if (!currentResult || !sourceText) return;
      try {
          const favorites = await StorageManager.getFavorites();
          const existing = favorites.find(f => f.source === sourceText);
          if (existing) {
              await StorageManager.removeFavorite(existing.id);
              showToast('已取消收藏');
          } else {
              await StorageManager.addFavorite({
                  source: sourceText,
                  target: currentResult,
                  sourceLang: elements.sourceLang.value,
                  targetLang: elements.targetLang.value,
              });
              showToast('已添加到收藏');
          }
          await syncFavoriteState();
      } catch (err) {
          console.error('[智译] 收藏操作失败:', err);
      }
  });
  ```

  行为说明：
  - `sourceText` 用 `.trim()` 后的值，与 `syncFavoriteState()` 的 `elements.sourceText.value.trim()` 一致
  - 先 `getFavorites()` 查找 `f.source === sourceText` 的现有条目
  - 已收藏 → `removeFavorite(existing.id)` → toast "已取消收藏" → 星标变空心
  - 未收藏 → `addFavorite()` 用 trimmed `sourceText` → toast "已添加到收藏" → 星标变黄
  - 整个操作在 try-catch 中，storage 错误 → console.error，不产生 unhandled rejection
  - `await syncFavoriteState()` 在 try 块末尾，确保星标视觉状态与存储一致

**不要做的事**：
- 不要改 `syncFavoriteState()` 函数签名或内部逻辑
- 不要改 `StorageManager.addFavorite` / `removeFavorite` / `isFavorite` / `getFavorites` 函数本身
- 不要改 `handleTranslate()` 中的收藏逻辑（048 已处理的 `syncFavoriteState` 在 try-catch 中）
- 不要改 `clearResult()` 中的星标清空逻辑
- 不要改 popup.html — 无需改 DOM 结构

### 必做

#### B. 共享 URL helper + 4 处调用点替换

三个快捷入口按钮只排除 `chrome://`，遗漏其他受限 scheme；`checkSelectedText()` 完全无 URL 守卫。

- [x] `popup/popup.js` — 在 `elements` 声明之后、`const MAX_CHARS = 5000;` 之前（当前 line 35-36 之间），新增共享 helper：
  ```javascript
  // 改前（line 35-36）

  const MAX_CHARS = 5000;

  // 改后
  const isSupportedPageUrl = (url) => /^https?:\/\//.test(url);

  const MAX_CHARS = 5000;
  ```

- [x] `popup/popup.js` — 替换沉浸式翻译按钮的 URL 判断（当前 line 213）：
  ```javascript
  // 改前
  if (tab?.id && !tab.url?.startsWith('chrome://')) {

  // 改后
  if (tab?.id && isSupportedPageUrl(tab.url)) {
  ```

- [x] `popup/popup.js` — 替换侧边栏按钮的 URL 判断（当前 line 229）：
  ```javascript
  // 改前
  if (tab?.id && !tab.url?.startsWith('chrome://')) {

  // 改后
  if (tab?.id && isSupportedPageUrl(tab.url)) {
  ```

- [x] `popup/popup.js` — 替换悬浮窗按钮的 URL 判断（当前 line 245）：
  ```javascript
  // 改前
  if (tab?.id && !tab.url?.startsWith('chrome://')) {

  // 改后
  if (tab?.id && isSupportedPageUrl(tab.url)) {
  ```

- [x] `popup/popup.js` — 在 `checkSelectedText()` 中（当前 line 306），给 `sendMessage` 加 URL 守卫：
  ```javascript
  // 改前（line 305-307）
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' });

  // 改后
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && isSupportedPageUrl(tab.url)) {
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' });
  ```

  行为说明：
  - `isSupportedPageUrl(url)` 用白名单 `/^https?:\/\//` 替代黑名单 `!startsWith('chrome://')`
  - 覆盖所有受限 scheme（`chrome-extension://`、`edge://`、`about:`、`devtools://`、`view-source:`、`data:`、`file://`）
  - `tab.url` 为 `undefined`（无权限读取时）→ `regex.test(undefined)` 返回 `false` → 正确拦截
  - 三个快捷入口走 `else { showToast('此页面不支持该功能') }` — 正确的用户提示
  - `checkSelectedText()` 走 `if` 失败 → 跳过 `sendMessage` → 不触发无意义 IPC → catch 块不触发

**不要做的事**：
- 不要改 catch 块的 toast 文案"请刷新页面后重试" — if 分支已正确拦截，catch 保持原样作为最终兜底
- 不要改 `checkSelectedText()` 的 catch 块（静默 catch 是正确的）
- 不要改三个快捷入口按钮的 `sendMessage` 调用或 `window.close()` 逻辑
- 不要给 `isSupportedPageUrl` 加额外的参数或逻辑

## 不做的事

- **不做** `syncFavoriteState` 改动 — 它的 trim 行为已经是正确的
- **不做** `StorageManager` 的 API 改动 — 它们都工作正常
- **不做** `handleTranslate` 内 `syncFavoriteState` 改动 — 048 已隔离
- **不做** `clearResult` 改动 — 星标清空逻辑正确
- **不碰** sidebar.js、float-window.js、selection.js、immersive.js、floating-ball.js、content.js、options.js、options.html、options.css、service-worker.js、message-router.js、tts.js、offscreen.js、storage.js、translator.js、ad-blocker.js、manifest.json

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check popup/popup.js` 通过
- [x] `git diff --check` 无输出
