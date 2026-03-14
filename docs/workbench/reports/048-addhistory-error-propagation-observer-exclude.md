# 048 — addHistory 错误隔离与沉浸式观察器排除过滤报告

- 状态: done
- 对应任务: [tasks/048-addhistory-error-propagation-observer-exclude.md](../tasks/048-addhistory-error-propagation-observer-exclude.md)
- 来源讨论: [discussions/048-addhistory-error-propagation-observer-exclude.md](../discussions/048-addhistory-error-propagation-observer-exclude.md)
- 执行日期: 2026-03-13

## 结果概览

本轮完成了 `A/B`：

- `A` sidebar 和 popup 现在都会把 `addHistory` / `syncFavoriteState` 这类辅助失败隔离在内层 try-catch，不再覆盖已经显示的成功翻译结果
- `B` 沉浸式观察器现在和初始扫描共用同一份排除规则，新增节点也会跳过导航、按钮、扩展自有 UI 等不该被翻译的元素

## 已完成改动

### 48.1 A 辅助操作失败不再覆盖翻译成功态

[sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 的翻译成功路径现在改成：

```javascript
resultLang.innerText = `翻译结果 (${targetLangSelect.value})`;
try {
    await ST.sendMessage({
        action: 'addHistory',
        item: {
            source: text,
            target: response.text,
            sourceLang: sourceLangSelect.value,
            targetLang: targetLangSelect.value,
            provider: response.provider || '',
        }
    });
} catch (historyErr) {
    console.error('[智译] 保存历史失败:', historyErr);
}
await ST.refreshSidebarHistory();
```

这里按 discussion 收口保留了两点：

- 只隔离 `addHistory`，不去包 `ST.refreshSidebarHistory()`，因为它本身已经有内部 try-catch
- 翻译成功 UI 仍先写进 `resultContent`，即使历史保存失败也不会掉回外层错误态

[popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 的 `handleTranslate()` 成功路径也改成了同样的分层模型：

```javascript
currentResult = result.text;
showResult(result.text);

try {
    await StorageManager.addHistory({
        source: text,
        target: result.text,
        sourceLang,
        targetLang,
        provider: result.provider,
    });
    await syncFavoriteState();
} catch (auxErr) {
    console.error('[智译] 辅助操作失败:', auxErr);
}
```

这样现在：

- `translator.translate()` 自己失败时，仍由外层 catch 走错误展示
- `addHistory` / `syncFavoriteState` 失败时，只写 console，不会把已经显示的成功译文盖掉
- `currentResult` 和结果区状态仍保留，复制/朗读不受影响

本轮没有改：

- `StorageManager.addHistory()` 本身
- `syncFavoriteState()` 本身
- float-window / selection 的 fire-and-forget 写历史路径

### 48.2 B 观察器与初始扫描共用排除过滤

[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 顶部新增了模块级常量：

```javascript
const EXCLUDE_SELECTORS = [
    'nav', 'header', 'footer', 'aside',
    'button', 'a', 'input', 'select', 'label',
    '.Header', '.AppHeader', '.pagehead',
    '.btn', '.Button', '.Counter', '.Label',
    '.sidebar', '.menu', '.toolbar'
];
```

`toggleImmersive()` 的初始扫描不再使用局部 `excludeSelectors`，而是改成共用 `EXCLUDE_SELECTORS`。同时 `startMutationObserver()` 的 `newElements.filter(...)` 现在在通用分支里补了两层和初始扫描一致的过滤：

```javascript
if (!isTwitter) {
    for (const selector of EXCLUDE_SELECTORS) {
        if (el.closest(selector) || el.matches(selector)) return false;
    }
    if (ST.isPluginElement(el)) return false;
}
```

这次修复解决的是“初始扫描和 observer 行为不一致”的问题：

- 初始扫描本来就会跳过导航、页头、按钮和扩展自有 UI
- observer 之前只做长度、重复和语言过滤，新增节点仍可能把不该翻译的元素塞进队列
- 现在 observer 和初始扫描使用同一份 `EXCLUDE_SELECTORS`，并且同样复用 `ST.isPluginElement(el)`

本轮没有改：

- Twitter 专用路径
- `injectTranslation()` 注入逻辑
- `pendingTranslations` / `observerRunId` 的既有守卫

## TDD 记录

本轮按 test-first 执行，先新增了 [addhistory-error-observer-exclude.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/addhistory-error-observer-exclude.test.mjs)。

首次运行：

```bash
node --test tests/addhistory-error-observer-exclude.test.mjs
```

时 3 个子测试都失败，分别覆盖：

- sidebar 没有把 `addHistory` 从翻译主 try-catch 里隔离出来
- popup 没有把 `addHistory + syncFavoriteState` 的辅助失败从成功翻译态里隔离出来
- immersive observer 没有复用初始扫描的 `EXCLUDE_SELECTORS + ST.isPluginElement`

补丁完成后，该新增测试转绿。

执行过程中还发现一条旧静态测试 [status-dot-swap-history.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/status-dot-swap-history.test.mjs) 仍固定匹配旧的“直接 await addHistory 再刷新历史”结构。它不是新 bug，而是 048 合法改动后的过时断言，所以本轮同步更新为匹配新的内层 try-catch 结构。

## 验证

本轮实际跑过：

```bash
node --test tests/addhistory-error-observer-exclude.test.mjs
node --test tests/content-tts-history.test.mjs
node --test tests/popup-favorite-toast-tts.test.mjs
node --test tests/status-dot-swap-history.test.mjs
node --test tests/*.test.mjs
node --check content/modules/sidebar.js
node --check popup/popup.js
node --check content/modules/immersive.js
git diff --check
```

验证结果：

- [addhistory-error-observer-exclude.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/addhistory-error-observer-exclude.test.mjs)：3/3 通过
- [content-tts-history.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/content-tts-history.test.mjs)：4/4 通过
- [popup-favorite-toast-tts.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/popup-favorite-toast-tts.test.mjs)：3/3 通过
- [status-dot-swap-history.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/status-dot-swap-history.test.mjs)：4/4 通过
- `node --test tests/*.test.mjs`：172/172 通过
- [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) `node --check` 通过
- [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) `node --check` 通过
- [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- sidebar 翻译成功后，即使历史保存失败，结果区仍保持成功译文而不是切回错误态
- popup 翻译成功后，即使历史或收藏同步失败，结果区和 `currentResult` 仍保持可复制/可朗读
- 沉浸式翻译开启后，动态新增的导航、按钮、扩展自有 UI 不会被 observer 错误翻译
