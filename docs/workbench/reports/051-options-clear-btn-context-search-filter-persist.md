# 051 — Options 清空按钮跟随标签 & loadHistoryList 自动保留搜索过滤报告

- 状态: done
- 对应任务: [tasks/051-options-clear-btn-context-search-filter-persist.md](../tasks/051-options-clear-btn-context-search-filter-persist.md)
- 来源讨论: [discussions/051-options-clear-btn-context-search-filter-persist.md](../discussions/051-options-clear-btn-context-search-filter-persist.md)
- 执行日期: 2026-03-13

## 结果概览

本轮完成了 `A/B`：

- `A` Options 历史页的清空按钮现在会跟随当前子标签，在收藏页清空收藏，在历史页清空历史，且确认文案和按钮文案都会同步切换
- `B` `loadHistoryList()` 现在会在刷新后自动复用当前搜索框 query，删除单项或清空当前列表后不再丢失过滤上下文

## 已完成改动

### 51.1 A 清空按钮跟随当前子标签上下文

[storage.js](/Users/xa/Desktop/projiect/zhiyi/src/core/storage.js) 新增了 `clearFavorites()`：

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

[options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 新增了：

```javascript
function updateClearBtnContext(type) {
    elements.clearHistoryBtn.textContent = type === 'favorite' ? '清空所有收藏' : '清空所有历史';
}
```

并且 `switchHistoryTab(type)` 现在会在切换时先更新按钮文案，再加载列表：

```javascript
updateClearBtnContext(type);
loadHistoryList(type);
```

清空按钮 click handler 也已改成按 `currentHistoryType` 分支：

```javascript
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

这次修复带来的行为变化是：

- 收藏页不会再误清空翻译历史
- 清空后不会再强制跳回 `recent`
- 用户看到的按钮文案和确认弹窗文案与当前子标签保持一致

### 51.2 B `loadHistoryList()` 自动复用当前搜索过滤

[options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 的 `loadHistoryList()` 末尾已经从直接渲染：

```javascript
currentHistoryData = data;
renderHistoryList(data);
```

改成：

```javascript
currentHistoryData = data;
const query = document.getElementById('history-search')?.value || '';
filterHistoryList(query);
```

这样现在有两条关键路径都能保持一致：

- `switchHistoryTab()` 会先清空搜索框，再加载列表，所以切 tab 仍然显示全量
- 删除单项 / 清空当前页时会直接 `loadHistoryList(currentHistoryType)`，搜索框原值会被保留，列表也会按原 query 重新过滤

本轮没有修改：

- `filterHistoryList()` 本身的过滤逻辑
- `renderHistoryList()` 渲染结构
- `bindHistoryDeleteEvents()` 删除流程

## TDD 记录

本轮按 test-first 执行，先新增了 [options-clear-btn-search-filter.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/options-clear-btn-search-filter.test.mjs)。

首次运行：

```bash
node --test tests/options-clear-btn-search-filter.test.mjs
```

时测试先红，暴露出 3 个真实缺口：

- `StorageManager.clearFavorites` 不存在
- `options.js` 还没有 `updateClearBtnContext(type)` 和分支化清空逻辑
- `loadHistoryList()` 仍然是直接 `renderHistoryList(data)`

补丁完成后，该新增测试转绿。

执行过程中，旧静态测试 [tts-voice-sidebar-history.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/tts-voice-sidebar-history.test.mjs) 仍固定匹配 `051` 之前的清空按钮行为，因此本轮同步把它更新为匹配新的 helper + 分支化清空逻辑，避免旧断言把合法修复误报成回归。

## 验证

本轮实际跑过：

```bash
node --test tests/options-clear-btn-search-filter.test.mjs
node --test tests/*.test.mjs
node --check options/options.js
node --check src/core/storage.js
git diff --check
```

验证结果：

- [options-clear-btn-search-filter.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/options-clear-btn-search-filter.test.mjs)：3/3 通过
- `node --test tests/*.test.mjs`：181/181 通过
- [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) `node --check` 通过
- [storage.js](/Users/xa/Desktop/projiect/zhiyi/src/core/storage.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- 历史页切到“收藏”子标签时，清空按钮文案会变成“清空所有收藏”，且点击后只清空收藏
- 在收藏页/历史页清空后，当前子标签不会被强制切回 `recent`
- 搜索框输入 query 后删除单条记录，列表仍保持过滤后的视图，不会突然切回全量
