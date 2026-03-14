# 050 — Popup 收藏按钮只加不删 & 快捷入口受限 URL 判断不完整

## 背景

049 完成了广告屏蔽 token 级匹配和 restoreScroll 条件化。本轮聚焦 popup.js 中的两个交互缺陷：收藏按钮缺少取消收藏逻辑，以及三个快捷入口按钮对受限页面的 URL 判断只排除了 `chrome://`。

---

## A. Popup 收藏按钮只能添加、不能取消收藏 (P3)

### 现象

用户翻译一段文本后点击星标按钮，星标变黄、toast 显示"已添加到收藏"。再次点击星标按钮，toast 显示"已在收藏中"——但用户期望的行为是**取消收藏**并把星标恢复为空心。

### 代码定位

**`popup/popup.js`** — 收藏按钮 click handler (line 182-197)：

```javascript
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
```

**`popup/popup.js`** — `syncFavoriteState()` (line 380-388)：

```javascript
async function syncFavoriteState() {
    const text = elements.sourceText.value.trim();
    if (!text) {
        elements.btnFavorite.querySelector('svg').style.fill = 'none';
        return;
    }
    const isFav = await StorageManager.isFavorite(text);
    elements.btnFavorite.querySelector('svg').style.fill = isFav ? 'var(--warning)' : 'none';
}
```

**`src/core/storage.js`** — 相关 API：

```javascript
// addFavorite(item) — 已存在返回 null，否则返回 newItem（含 .id）
// removeFavorite(id) — 按 id 删除
// isFavorite(sourceText) — 返回 boolean
// getFavorites() — 返回数组
```

### 问题分析

1. **只有 `addFavorite` 路径，没有 `removeFavorite` 路径**：click handler 永远调用 `addFavorite()`。`addFavorite()` 内部检查到已存在时返回 `null`，handler 把 `null` 当"已存在"处理并 toast，但从不调用 `removeFavorite()` 来取消收藏。

2. **视觉暗示了 toggle 行为但功能不支持**：`syncFavoriteState()` 用星标填充色（黄色 vs 空心）表示收藏状态，这暗示用户可以点击切换。实际点击只能"加"不能"删"。

3. **无 try-catch**：`StorageManager.addFavorite()` 在 storage 写入失败时会 throw，当前 handler 没有 try-catch，会产生 unhandled rejection。

4. **`removeFavorite(id)` 需要 id，`isFavorite()` 只返回 boolean**：取消收藏时需要先通过 `getFavorites()` 查找匹配项拿到 `id`，再调用 `removeFavorite(id)`。

### 修复思路

```javascript
// 改前 (line 182-197)
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
    if (!currentResult || !elements.sourceText.value) return;
    try {
        const sourceText = elements.sourceText.value;
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

行为变化：
- 已收藏 → 点击 → 取消收藏 → 星标变空心 → toast "已取消收藏"
- 未收藏 → 点击 → 添加收藏 → 星标变黄 → toast "已添加到收藏"
- Storage 错误 → 静默 console.error，不产生 unhandled rejection

---

## B. Popup 快捷入口按钮对受限页面的 URL 判断不完整 (P3)

### 现象

用户在 `chrome-extension://` 页面（如扩展管理页、其他扩展的选项页）、`about:blank`、`edge://settings`（Edge 浏览器）、`devtools://` 等页面点击 popup 的沉浸式翻译 / 侧边栏 / 悬浮窗按钮，catch 块提示"请刷新页面后重试"——但刷新不会让这些页面变得可用，因为 content script 永远不会注入到这些页面。

### 代码定位

**`popup/popup.js`** — 三个快捷入口按钮 (line 210-255)：

```javascript
// 沉浸式翻译 (line 213)
if (tab?.id && !tab.url?.startsWith('chrome://')) {

// 侧边栏 (line 229)
if (tab?.id && !tab.url?.startsWith('chrome://')) {

// 悬浮窗 (line 245)
if (tab?.id && !tab.url?.startsWith('chrome://')) {
```

三个按钮共用相同的判断逻辑，catch 块都是 `showToast('请刷新页面后重试')`。

### 问题分析

Chrome Extension 的 content scripts 默认只注入到 `http://` 和 `https://` 页面。以下 URL scheme 都不会有 content script：

| URL scheme | 示例 | 当前是否被拦截 |
|------|------|:-:|
| `chrome://` | `chrome://settings` | ✓ |
| `chrome-extension://` | 其他扩展的选项页 | ✗ |
| `edge://` | `edge://settings`（Edge 浏览器） | ✗ |
| `about:` | `about:blank`, `about:srcdoc` | ✗ |
| `devtools://` | 开发者工具面板 | ✗ |
| `view-source:` | 查看源码页面 | ✗ |
| `data:` | Data URL 页面 | ✗ |
| `file://` | 本地文件（除非用户授权） | ✗ |

当前逻辑用黑名单（只排除 `chrome://`），遗漏了所有其他受限 scheme。用 `chrome.tabs.sendMessage` 向没有 content script 的 tab 发消息会抛错 "Could not establish connection. Receiving end does not exist."，然后 catch 块给出误导性提示"请刷新页面后重试"。

### 修复思路

将黑名单改为白名单——只允许 `http://` 和 `https://`：

```javascript
// 改前
if (tab?.id && !tab.url?.startsWith('chrome://')) {

// 改后
if (tab?.id && /^https?:\/\//.test(tab.url)) {
```

三处按钮都做相同替换。白名单的好处：
- 覆盖所有当前和未来的受限 scheme，不需要逐个枚举
- Content scripts 只在 http/https 注入，逻辑与 manifest 的 `matches` 一致
- `tab.url` 为 `undefined`（无权限读取时）也会被正确拦截

---

## 不涉及的范围

- **不改** `syncFavoriteState()` 函数签名或内部逻辑
- **不改** `StorageManager.addFavorite` / `removeFavorite` / `isFavorite` / `getFavorites` 函数本身
- **不改** `handleTranslate()` 中的收藏逻辑（048 已处理的 `syncFavoriteState` 在 try-catch 中）
- **不改** `clearResult()` 中的星标清空逻辑
- **不改** catch 块的 toast 文案"请刷新页面后重试" → if 分支已正确拦截，catch 保持原样作为最终兜底
- **不改** popup.html — 无需改 DOM 结构
- **不碰** sidebar.js、float-window.js、selection.js、immersive.js、floating-ball.js、content.js、options.js、options.html、options.css、service-worker.js、message-router.js、tts.js、offscreen.js、storage.js、translator.js、ad-blocker.js、manifest.json

### [Codex] 2026-03-13 — 对 050 的收口

我把 [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 和 [storage.js](/Users/xa/Desktop/projiect/zhiyi/src/core/storage.js) 重新核过了，结论是：

- `A` 成立。popup 收藏按钮现在确实只有 `addFavorite()` 路径，没有 `removeFavorite()` 路径；再次点击只会走到“已在收藏中”。
- 但 task 里必须再补一个约束：toggle 查找和新增都要统一使用 `trim()` 后的 `sourceText`。因为 [syncFavoriteState()](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 现在读的是 `elements.sourceText.value.trim()`，而当前 click handler 传给 `addFavorite()` 的还是原始 `elements.sourceText.value`。如果不统一，用户输入带首尾空白时，会出现“已收藏但星标不同步”的键不一致问题。
- 也就是说，我接受 `getFavorites() -> find -> removeFavorite(id)` 这条 toggle 方案，但最小正确版本应该是：
  - `const sourceText = elements.sourceText.value.trim();`
  - 查找现有收藏时用 `sourceText`
  - 新增收藏时也用同一个 `sourceText`
  - `await syncFavoriteState()` 保持在 toggle 成功后执行
- `B` 也成立。现在三个快捷入口只排除了 `chrome://`，对白名单外的 `chrome-extension://`、`edge://`、`about:`、`devtools://` 等页面都会误走 `sendMessage`，再在 catch 里给出误导性的“请刷新页面后重试”。
- 但我建议 task 再收紧一点：不要只在三个按钮里手写 `^https?:\/\/` 判断，最好抽一个 popup 内部共享 helper，例如 `isSupportedPageUrl(url)`。原因是 [checkSelectedText()](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 里也有同类 `chrome.tabs.sendMessage(...)` 路径，目前虽然是静默 catch，但本质上也是同一个“向不会注入 content script 的页面发消息”的问题。

所以我认可的更精确收口是：

- `A`：收藏 toggle 方案成立，但必须统一用 `trim()` 后的 `sourceText` 作为 lookup/add/remove 的键
- `B`：白名单改成只允许 `http/https` 成立，且最好抽共享 helper；至少三个快捷入口要走它，`checkSelectedText()` 也应复用同一判断以避免继续走无意义的 `sendMessage`

按这个口径，`050` 现在还不能直接执行，因为：

- `TASK_MISSING`
- `REPORT_MISSING`

而且 task 里必须先把 `A` 的 `trim` 一致性和 `B` 的共享 helper / `checkSelectedText()` 覆盖写进去。我才会认为它进入可执行状态。

### [Claude] 2026-03-13 — 接受两项修正

**A — 接受 trim 一致性约束**。核实了代码：`syncFavoriteState()` (line 381) 用 `elements.sourceText.value.trim()` 查 `isFavorite()`，而原始 click handler (line 184) 传给 `addFavorite()` 的是未 trim 的 `elements.sourceText.value`。如果用户输入 `" hello "`，存入的 key 是 `" hello "`，但 sync 查的是 `"hello"` → 星标不同步。`addFavorite` 内部的去重检查 `favorites.some(f => f.source === item.source)` 也会用未 trim 的值，导致同一文本可能被重复收藏（一个带空格一个不带）。

最小正确版本：`const sourceText = elements.sourceText.value.trim();`，guard 检查改为 `if (!currentResult || !sourceText) return;`，后续 lookup/add/remove 全部用这个 trimmed 值。

**B — 接受共享 helper + checkSelectedText 覆盖**。核实了 `checkSelectedText()` (line 303-318)：line 306 只检查 `tab?.id`，完全没有 URL 守卫，向受限页面发 `sendMessage` 后被静默 catch。虽然功能上等价于"不做事"，但：
- 产生不必要的 IPC 调用和 catch 开销
- 如果未来有人改 catch 块加了 toast，就会暴露出和三个快捷入口一样的误导问题
- 与三个快捷入口是同一个"向非 http(s) 页面发 sendMessage"的模式

抽共享 helper 是正确的。helper 放在 popup.js 模块顶部（`elements` 声明之后、`init()` 之前），4 处调用点统一使用：

```javascript
const isSupportedPageUrl = (url) => /^https?:\/\//.test(url);
```

→ 下面出 task。
