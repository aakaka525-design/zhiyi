---
status: done
priority: P3
created: 2026-03-13
---

# 051 — Options 清空按钮跟随标签 & loadHistoryList 自动保留搜索过滤

- 来源讨论: [discussions/051-options-clear-btn-context-search-filter-persist.md](../discussions/051-options-clear-btn-context-search-filter-persist.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/051-options-clear-btn-context-search-filter-persist.md](../discussions/051-options-clear-btn-context-search-filter-persist.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `src/core/storage.js` | A：新增 `clearFavorites()` 静态方法 |
| `options/options.js` | A：清空按钮跟随标签 + `updateClearBtnContext` helper；B：`loadHistoryList` 末尾改调 `filterHistoryList` |
| `tests/options-clear-btn-search-filter.test.mjs` | A + B |

## 任务清单

### 必做

#### A. 清空按钮跟随当前子标签页

清空按钮固定调用 `clearHistory()` 且文案固定为"清空所有历史"，在收藏夹标签页会清空错误的数据。

- [x] `src/core/storage.js` — 在 `clearHistory()` 方法之后（当前 line 194 之后），新增 `clearFavorites()` 静态方法：
  ```javascript
  // 在 clearHistory() 之后新增
  static async clearFavorites() {
      try {
          await chrome.storage.local.set({ [STORAGE_KEYS.FAVORITES]: [] });
      } catch (error) {
          console.error('清空收藏失败:', error);
          throw error;
      }
  }
  ```

- [x] `options/options.js` — 在 `switchHistoryTab()` 函数之前（当前 line 461 之前），新增 `updateClearBtnContext` helper：
  ```javascript
  // 在 switchHistoryTab 之前新增
  function updateClearBtnContext(type) {
      elements.clearHistoryBtn.textContent = type === 'favorite' ? '清空所有收藏' : '清空所有历史';
  }
  ```

- [x] `options/options.js` — 在 `switchHistoryTab()` 中（当前 line 461-470），在 `loadHistoryList(type)` 之前调用 `updateClearBtnContext(type)`：
  ```javascript
  // 改前（line 461-470）
  function switchHistoryTab(type) {
      elements.historyTabs.forEach(b => b.classList.remove('active'));
      const targetBtn = document.querySelector(`.history-tab-btn[data-type="${type}"]`);
      if (targetBtn) targetBtn.classList.add('active');

      const searchInput = document.getElementById('history-search');
      if (searchInput) searchInput.value = '';

      loadHistoryList(type);
  }

  // 改后
  function switchHistoryTab(type) {
      elements.historyTabs.forEach(b => b.classList.remove('active'));
      const targetBtn = document.querySelector(`.history-tab-btn[data-type="${type}"]`);
      if (targetBtn) targetBtn.classList.add('active');

      const searchInput = document.getElementById('history-search');
      if (searchInput) searchInput.value = '';

      updateClearBtnContext(type);
      loadHistoryList(type);
  }
  ```

- [x] `options/options.js` — 替换清空按钮 click handler（当前 line 188-193）：
  ```javascript
  // 改前（line 188-193）
  elements.clearHistoryBtn.addEventListener('click', async () => {
      if (confirm('确定要清空所有翻译历史记录吗？')) {
          await StorageManager.clearHistory();
          switchHistoryTab('recent');
      }
  });

  // 改后
  elements.clearHistoryBtn.addEventListener('click', async () => {
      const isFavorite = currentHistoryType === 'favorite';
      const label = isFavorite ? '收藏' : '翻译历史';
      if (confirm(`确定要清空所有${label}记录吗？`)) {
          if (isFavorite) {
              await StorageManager.clearFavorites();
          } else {
              await StorageManager.clearHistory();
          }
          loadHistoryList(currentHistoryType);
      }
  });
  ```

  行为说明：
  - `updateClearBtnContext(type)` 统一管理清空按钮文案，在 tab 切换时调用
  - 清空按钮 click handler 根据 `currentHistoryType` 决定调用 `clearHistory()` 还是 `clearFavorites()`
  - 确认弹窗文案也跟随标签类型："清空所有翻译历史记录" vs "清空所有收藏记录"
  - 清空后 `loadHistoryList(currentHistoryType)` 停留在当前标签（不再强制切回 recent）

**不要做的事**：
- 不要改 `clearHistory()` 方法本身
- 不要改 `StorageManager` 其他方法
- 不要改 options.html 的按钮 DOM 结构 — 文案通过 JS 动态更新
- 不要在 `updateClearBtnContext` 中放按钮文案以外的逻辑（保持最小）
- 不要改 `loadTab()` 函数

### 必做

#### B. `loadHistoryList` 加载后自动保留搜索过滤状态

删除单条记录后 `loadHistoryList()` 渲染全量数据，但搜索框仍保留用户的查询文本，导致搜索状态与列表不一致。

- [x] `options/options.js` — 修改 `loadHistoryList()` 的末尾（当前 line 622-632），将 `renderHistoryList(data)` 替换为 `filterHistoryList(searchInput.value)`：
  ```javascript
  // 改前（line 622-632）
  async function loadHistoryList(type) {
      currentHistoryType = type;
      elements.historyList.innerHTML = '<div class="spinner-container"><div class="spinner"></div></div>';

      const data = type === 'favorite'
          ? await StorageManager.getFavorites()
          : await StorageManager.getHistory();

      currentHistoryData = data;
      renderHistoryList(data);
  }

  // 改后
  async function loadHistoryList(type) {
      currentHistoryType = type;
      elements.historyList.innerHTML = '<div class="spinner-container"><div class="spinner"></div></div>';

      const data = type === 'favorite'
          ? await StorageManager.getFavorites()
          : await StorageManager.getHistory();

      currentHistoryData = data;
      const query = document.getElementById('history-search')?.value || '';
      filterHistoryList(query);
  }
  ```

  行为说明：
  - `filterHistoryList('')`（空 query）→ 内部 `!lowerQuery` 为 true → `renderHistoryList(currentHistoryData)` → 等价于之前的全量渲染
  - `filterHistoryList('hello')`（有 query）→ 过滤后渲染匹配项 → 搜索状态与列表一致
  - `switchHistoryTab()` 在调 `loadHistoryList()` 之前已清空搜索框 → query 为空 → 渲染全量 ✓
  - 删除单项后直接调 `loadHistoryList(currentHistoryType)` → 搜索框保留原值 → 自动过滤 ✓
  - 清空后调 `loadHistoryList(currentHistoryType)` → 搜索框状态取决于调用路径 → 一律正确 ✓
  - 不需要改 `bindHistoryDeleteEvents()` — 它只调 `loadHistoryList()`，过滤由 `loadHistoryList` 内部完成

**不要做的事**：
- 不要改 `filterHistoryList()` 函数本身
- 不要改 `renderHistoryList()` 函数
- 不要改 `bindHistoryDeleteEvents()` — 删除逻辑不变
- 不要改 `createHistoryCard()` 函数
- 不要在 delete handler 中额外调用 `filterHistoryList()`

## 不做的事

- **不做** `filterHistoryList` 改动 — 过滤逻辑正确
- **不做** `renderHistoryList` 改动 — 渲染逻辑正确
- **不做** `createHistoryCard` 改动 — 卡片渲染正确
- **不做** `bindHistoryDeleteEvents` 改动 — 删除流程不变，过滤由 `loadHistoryList` 内部完成
- **不做** options.html DOM 结构改动 — 按钮文案通过 JS 动态更新
- **不碰** popup.js、sidebar.js、float-window.js、selection.js、immersive.js、floating-ball.js、content.js、service-worker.js、message-router.js、tts.js、offscreen.js、translator.js、ad-blocker.js、manifest.json

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check options/options.js` 通过
- [x] `node --check src/core/storage.js` 通过
- [x] `git diff --check` 无输出
