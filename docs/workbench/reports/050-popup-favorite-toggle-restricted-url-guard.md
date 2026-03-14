# 050 — Popup 收藏 toggle 与受限 URL 守卫报告

- 状态: done
- 对应任务: [tasks/050-popup-favorite-toggle-restricted-url-guard.md](../tasks/050-popup-favorite-toggle-restricted-url-guard.md)
- 来源讨论: [discussions/050-popup-favorite-toggle-restricted-url-guard.md](../discussions/050-popup-favorite-toggle-restricted-url-guard.md)
- 执行日期: 2026-03-13

## 结果概览

本轮完成了 `A/B`：

- `A` popup 收藏按钮现在支持真正的 toggle，且 lookup / add / remove 全部统一使用 `trim()` 后的 `sourceText`
- `B` popup 现在通过共享 `isSupportedPageUrl(url)` helper 只向 `http/https` 页面发 content message，三个快捷入口和 `checkSelectedText()` 都已对齐

## 已完成改动

### 50.1 A 收藏按钮改为 toggle，并统一 trim 后的 key

[popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 的收藏按钮 click handler 已从“永远 `addFavorite()`”改成真正的 toggle：

```javascript
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

这次修复解决了两个实际问题：

- 再次点击星标时，不再只得到“已在收藏中”，而是会真正执行 `removeFavorite(existing.id)` 并恢复空心星标
- 现在 `sourceText` 会先 `trim()`，与 [syncFavoriteState()](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 内部的 `elements.sourceText.value.trim()` 保持一致，不会再出现“收藏键和星标状态判断用的不是同一个字符串”这种错位

本轮没有改：

- [syncFavoriteState()](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 本身
- [StorageManager](/Users/xa/Desktop/projiect/zhiyi/src/core/storage.js) 的 favorites API
- [handleTranslate()](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 内部已有的 `syncFavoriteState()` 逻辑

### 50.2 B 抽共享 URL helper，并覆盖 4 处 `sendMessage` 路径

[popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 顶部新增了：

```javascript
const isSupportedPageUrl = (url) => /^https?:\/\//.test(url);
```

然后 4 处与当前活动 tab 通信的路径都切到了这个 helper：

- `btnImmersive`
- `btnSidebar`
- `btnFloat`
- `checkSelectedText()`

现在这几处都是：

```javascript
if (tab?.id && isSupportedPageUrl(tab.url)) {
    await chrome.tabs.sendMessage(...);
}
```

这次修复带来的变化是：

- `chrome-extension://`、`edge://`、`about:`、`devtools://`、`view-source:`、`data:` 等受限页面不会再误走 `sendMessage`
- 三个快捷入口会直接落到 “此页面不支持该功能” 分支，而不是进 catch 再给出误导性的“请刷新页面后重试”
- `checkSelectedText()` 现在也不会再对不支持的页面发无意义 IPC

本轮没有改：

- 三个按钮原有的 `sendMessage` action
- `window.close()` 时机
- `checkSelectedText()` 的静默 catch 结构

## TDD 记录

本轮按 test-first 执行，先新增了 [popup-favorite-toggle-url-guard.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/popup-favorite-toggle-url-guard.test.mjs)。

首次运行：

```bash
node --test tests/popup-favorite-toggle-url-guard.test.mjs
```

时 3 个子测试全部失败，分别覆盖：

- 收藏按钮还没有 toggle，也没有统一使用 trimmed `sourceText`
- popup 还没有共享 `isSupportedPageUrl(url)` helper
- 三个快捷入口仍在硬编码 `!tab.url?.startsWith('chrome://')`

补丁完成后，该新增测试转绿。

执行过程中，旧静态测试 [popup-favorite-toast-tts.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/popup-favorite-toast-tts.test.mjs) 仍固定匹配旧的“只 add、不 remove”的收藏结构，所以本轮同步更新为匹配新的 toggle 逻辑，同时保留它原本锁住的“翻译结果展示与收藏状态同步解耦”约束。

## 验证

本轮实际跑过：

```bash
node --test tests/popup-favorite-toggle-url-guard.test.mjs
node --test tests/popup-favorite-toast-tts.test.mjs
node --test tests/*.test.mjs
node --check popup/popup.js
git diff --check
```

验证结果：

- [popup-favorite-toggle-url-guard.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/popup-favorite-toggle-url-guard.test.mjs)：3/3 通过
- [popup-favorite-toast-tts.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/popup-favorite-toast-tts.test.mjs)：3/3 通过
- `node --test tests/*.test.mjs`：178/178 通过
- [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- popup 中已收藏的文本再次点击星标后，会真正取消收藏并恢复空心星标
- 输入带首尾空白的文本时，星标状态与收藏状态仍保持一致
- 在 `chrome://`、`chrome-extension://`、`about:` 等受限页面打开 popup，沉浸式翻译 / 侧边栏 / 悬浮窗按钮会直接提示“不支持”，而不是误导用户去刷新页面
