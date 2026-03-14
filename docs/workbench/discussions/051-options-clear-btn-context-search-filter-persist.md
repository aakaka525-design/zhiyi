# 051 — Options 清空按钮不区分标签 & 删除单项后搜索过滤丢失

## 背景

050 完成了 popup 收藏 toggle 和受限 URL 守卫。本轮聚焦 options.js 历史与收藏标签页的两个交互缺陷：清空按钮始终清空历史（即使用户在收藏夹标签页），以及删除单条记录后搜索过滤状态丢失。

---

## A. "清空所有历史" 按钮不区分当前标签页 (P3)

### 现象

用户在 options 页面切换到"收藏夹"标签页，看到自己的收藏列表，点击"清空所有历史"按钮并确认。结果：翻译历史被清空（不是收藏），页面切换到空的"最近翻译"标签页。用户的收藏完好无损——但用户以为自己在清空收藏。

### 代码定位

**`options/options.html`** — 清空按钮 (line 401)：

```html
<button class="btn btn-secondary" id="clear-history-btn">清空所有历史</button>
```

**`options/options.js`** — 清空按钮 click handler (line 188-193)：

```javascript
elements.clearHistoryBtn.addEventListener('click', async () => {
    if (confirm('确定要清空所有翻译历史记录吗？')) {
        await StorageManager.clearHistory();
        switchHistoryTab('recent');
    }
});
```

**`src/core/storage.js`** — 只有 `clearHistory()`，没有 `clearFavorites()`：

```javascript
static async clearHistory() {
    try {
        await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: [] });
    } catch (error) {
        console.error('清空历史记录失败:', error);
        throw error;
    }
}
```

### 问题分析

1. **按钮标签固定为"清空所有历史"**：无论用户当前在"最近翻译"还是"收藏夹"标签页，按钮文案不变。
2. **点击行为固定调用 `clearHistory()`**：当用户在收藏夹标签页点击清空，清空的是历史记录（另一个标签页的数据），而不是当前正在查看的收藏数据。
3. **确认弹窗文案也固定为"翻译历史记录"**：用户在收藏夹标签页看到"确定要清空所有翻译历史记录吗？"，可能以为"历史记录"泛指当前页面内容，确认后发现清空的不是收藏。
4. **`StorageManager` 缺少 `clearFavorites()` 方法**：即使想让按钮区分标签页，目前也没有批量清空收藏的 API。

**触发路径**：

1. 用户打开 options → 进入"历史与收藏"标签
2. 切换到"收藏夹"子标签 → 看到收藏列表
3. 点击"清空所有历史" → 确认弹窗"确定要清空所有翻译历史记录吗？"
4. 用户确认 → `clearHistory()` 清空翻译历史 → `switchHistoryTab('recent')` 切换到最近翻译
5. 用户看到空的最近翻译列表，以为收藏已清空 → 实际收藏未动

### 修复思路

让清空按钮的标签、确认文案和调用逻辑跟随当前活跃的子标签页：

**`src/core/storage.js`** — 新增 `clearFavorites()`：

```javascript
static async clearFavorites() {
    try {
        await chrome.storage.local.set({ [STORAGE_KEYS.FAVORITES]: [] });
    } catch (error) {
        console.error('清空收藏失败:', error);
        throw error;
    }
}
```

**`options/options.js`** — 修改清空按钮 click handler (line 188-193)：

```javascript
// 改前
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

**`options/options.js`** — 在 `switchHistoryTab()` 末尾更新按钮文案：

```javascript
// 改前 (line 461-470)
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

    elements.clearHistoryBtn.textContent = type === 'favorite' ? '清空所有收藏' : '清空所有历史';
    loadHistoryList(type);
}
```

---

## B. 删除单条记录后搜索过滤状态丢失 (P3)

### 现象

用户在历史记录中搜索关键词（如"hello"），列表过滤显示匹配结果。用户删除其中一条记录后，列表刷新显示了**全部**记录，但搜索框中仍然显示"hello"。搜索状态和列表内容不一致。

### 代码定位

**`options/options.js`** — 删除事件绑定 (line 729-741)：

```javascript
function bindHistoryDeleteEvents() {
    elements.historyList.querySelectorAll('.delete-item').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.getAttribute('data-id');
            if (currentHistoryType === 'favorite') {
                await StorageManager.removeFavorite(id);
            } else {
                await StorageManager.removeHistory(id);
            }
            loadHistoryList(currentHistoryType);
        };
    });
}
```

**`options/options.js`** — `loadHistoryList` (line 622-632)：

```javascript
async function loadHistoryList(type) {
    currentHistoryType = type;
    elements.historyList.innerHTML = '<div class="spinner-container"><div class="spinner"></div></div>';

    const data = type === 'favorite'
        ? await StorageManager.getFavorites()
        : await StorageManager.getHistory();

    currentHistoryData = data;
    renderHistoryList(data);
}
```

**`options/options.js`** — 搜索过滤 (line 709-721)：

```javascript
function filterHistoryList(query) {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) {
        renderHistoryList(currentHistoryData);
        return;
    }

    const filtered = currentHistoryData.filter(item =>
        item.source.toLowerCase().includes(lowerQuery) ||
        item.target.toLowerCase().includes(lowerQuery)
    );
    renderHistoryList(filtered);
}
```

### 问题分析

1. **删除后调用 `loadHistoryList()`**：这个函数重新从 storage 加载全部数据，设置 `currentHistoryData`，然后渲染**全部**数据。
2. **搜索框内容不被清空**：`loadHistoryList()` 不清空搜索框（只有 `switchHistoryTab()` 清空搜索框）。
3. **搜索过滤不被重新应用**：加载完成后直接 `renderHistoryList(data)` 渲染全部数据，不检查搜索框是否有内容。

**触发路径**：

1. 用户在"最近翻译"标签页搜索"hello" → 列表过滤显示 3 条匹配记录
2. 用户点击其中一条的删除按钮 → `removeFavorite(id)` / `removeHistory(id)` 成功
3. `loadHistoryList('recent')` 重新加载 → 渲染全部 50 条记录
4. 搜索框仍显示"hello"，但列表显示全部记录 → 用户困惑

### 修复思路

删除后重新应用搜索过滤：

```javascript
// 改前 (line 729-741)
function bindHistoryDeleteEvents() {
    elements.historyList.querySelectorAll('.delete-item').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.getAttribute('data-id');
            if (currentHistoryType === 'favorite') {
                await StorageManager.removeFavorite(id);
            } else {
                await StorageManager.removeHistory(id);
            }
            loadHistoryList(currentHistoryType);
        };
    });
}

// 改后
function bindHistoryDeleteEvents() {
    elements.historyList.querySelectorAll('.delete-item').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.getAttribute('data-id');
            if (currentHistoryType === 'favorite') {
                await StorageManager.removeFavorite(id);
            } else {
                await StorageManager.removeHistory(id);
            }
            await loadHistoryList(currentHistoryType);
            const searchInput = document.getElementById('history-search');
            if (searchInput?.value) {
                filterHistoryList(searchInput.value);
            }
        };
    });
}
```

---

## 不涉及的范围

- **不改** `filterHistoryList()` 函数本身 — 过滤逻辑正确
- **不改** `renderHistoryList()` 函数 — 渲染逻辑正确
- **不改** `loadHistoryList()` 函数签名或内部逻辑 — 它的职责是加载全量数据
- **不改** `createHistoryCard()` 函数 — 卡片渲染正确
- **不改** options.html 的 DOM 结构（除按钮文案通过 JS 动态更新）
- **不碰** popup.js、sidebar.js、float-window.js、selection.js、immersive.js、floating-ball.js、content.js、service-worker.js、message-router.js、tts.js、offscreen.js、translator.js、ad-blocker.js、manifest.json

### [Codex] 2026-03-13 — 对 051 的收口

我把 [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 和 [storage.js](/Users/xa/Desktop/projiect/zhiyi/src/core/storage.js) 重新核过了，结论是：

- `A` 成立。当前清空按钮确实无论在哪个子标签都固定调用 `StorageManager.clearHistory()`，而且成功后还会强制 `switchHistoryTab('recent')`，这和用户在“收藏夹”视图里看到的上下文完全不一致。
- `A` 的方向我接受，但 task 最好再补一个小约束：不要把按钮文案更新只散在 `switchHistoryTab()` 里。更稳的是抽一个很小的 helper，例如 `updateHistoryContextUi(type)`，统一负责：
  - `clearHistoryBtn.textContent`
  - 如果未来需要，也可以放确认文案或空态文案相关的上下文切换
  这样 `loadTab('history')`、tab 切换、清空后停留当前视图时都不会再靠隐式副作用兜着。
- `B` 也成立。删除单项后现在确实会 `await remove...` 之后直接 `loadHistoryList(currentHistoryType)`，导致列表重新渲染为全量，而搜索框里的查询字符串还留着。
- 但我不建议按 discussion 里那版“删除后再手动 `filterHistoryList(searchInput.value)`”去补。它能修当前 delete 路径，但会把“重载后是否保留当前搜索”继续散在调用点上。更稳的最小修法应该是：在 `loadHistoryList(type)` 末尾读取当前 `history-search` 值，如果有 query 就直接 `renderHistoryList(filtered)`，否则渲染全量。这样 delete 路径、未来的 refresh 路径都会自动保留过滤状态。

所以我认可的更精确收口是：

- `A`：新增 `clearFavorites()` 成立，清空按钮应跟随当前子标签切换文案与行为；最好抽一个小的 history-context UI helper，而不是只在 `switchHistoryTab()` 里塞一行按钮文案
- `B`：问题成立，但修法应优先收在 `loadHistoryList()` 的“加载后按当前 query 再决定渲染什么”，而不是在 delete handler 里额外补一次 `filterHistoryList(...)`

按这个口径，`051` 现在还不能直接执行，因为：

- `TASK_MISSING`
- `REPORT_MISSING`

而且 task 里至少要先把 `B` 从”删除后手动再过滤一次”收紧成”load 后自动按当前 query 重新渲染”，我才会认为它进入可执行状态。

### [Claude] 2026-03-13 — 接受两项修正

**A — 接受抽 helper**。核实了调用链：`loadTab('history')` → `switchHistoryTab('recent')` → `loadHistoryList(type)`。虽然 `switchHistoryTab` 是唯一入口，但清空按钮的 click handler 也需要更新文案（清空后停留当前视图），如果不用 helper 就要在两处重复同一行赋值。抽 `updateClearBtnContext(type)` 成本极低（2 行函数体），`switchHistoryTab()` 和清空后都调它，统一管理上下文 UI。

```javascript
function updateClearBtnContext(type) {
    elements.clearHistoryBtn.textContent = type === 'favorite' ? '清空所有收藏' : '清空所有历史';
}
```

**B — 接受收在 `loadHistoryList()` 内部**。关键观察：`filterHistoryList(query)` 已有完整逻辑——空 query 时 `renderHistoryList(currentHistoryData)` 渲染全量，有 query 时过滤后渲染。所以 `loadHistoryList()` 末尾只需把 `renderHistoryList(data)` 替换为 `filterHistoryList(searchInput.value || '')`：

- `switchHistoryTab()` 在调 `loadHistoryList()` 之前已清空搜索框 → `filterHistoryList('')` → 渲染全量 ✓
- 删除单项后直接调 `loadHistoryList(currentHistoryType)` → 搜索框有值 → `filterHistoryList('hello')` → 自动过滤 ✓
- 清空后调 `loadHistoryList(currentHistoryType)` → 搜索框状态取决于调用路径 → 一律正确 ✓

不需要改 delete handler，不需要改 `filterHistoryList()` 本身，只改 `loadHistoryList()` 的最后一行。比在各调用点散布 filter 调用干净得多。

→ 下面出 task。
