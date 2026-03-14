# 052 — 双击短文本图标与气泡重叠 & 翻译小窗缺少 resize 监听

## 背景

051 完成了 options 清空按钮标签跟随和搜索过滤保留。本轮聚焦两个交互缺陷：双击选中 2-4 字符文本时翻译图标与翻译气泡同时显示，以及翻译小窗在视口缩小后可能移出屏幕。

---

## A. 双击短文本时翻译图标与气泡同时显示 (P3)

### 现象

用户在页面上双击一个 2-4 字符的单词（如 "of"、"is"、"它们"），同时出现翻译图标（小翻译 icon）和翻译气泡（带翻译结果的弹窗），两者视觉上重叠。

### 代码定位

**`content/modules/selection.js`** — `handleMouseUp` (line 11-33)：

```javascript
ST.handleMouseUp = function (e) {
    if (!ST.state.settings?.enableSelection) return;
    if (ST.isPluginElement(e.target)) return;

    const selection = window.getSelection();
    const text = selection.toString().trim();

    ST.removeIcon();

    if (text && text.length > 0 && text.length < 2000) {
        ST.state.selection.text = text;
        ST.state.selection.range = selection.getRangeAt(0);
        ST.state.selection.rect = ST.state.selection.range.getBoundingClientRect();

        if (text.length >= 5) {
            ST.showBubble(text);
        } else {
            ST.showIcon(e.pageX, e.pageY);  // ← 短文本显示图标
        }
    }
};
```

**`content/modules/selection.js`** — `handleDoubleClick` (line 48-68)：

```javascript
ST.handleDoubleClick = function (e) {
    if (!ST.state.settings?.enableSelection) return;
    if (e.target.matches('input, textarea, [contenteditable="true"]')) return;
    if (ST.isPluginElement(e.target)) return;

    const text = window.getSelection().toString().trim();

    if (text && text.length >= 2 && text.length <= 500) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            ST.state.selection.rect = range.getBoundingClientRect();
            ST.state.selection.text = text;
            ST.showBubble(text);   // ← 没有先 removeIcon()
        }
    }
};
```

### 问题分析

双击时浏览器事件顺序：`mousedown(1)` → `mouseup(1)` → `mousedown(2)` → `mouseup(2)` → `dblclick`

当用户双击一个 2-4 字符的单词（如 "the"）：

1. **第二次 `mouseup`(detail=2)**：浏览器已选中单词 → `handleMouseUp` 触发 → `text = "the"` (3 字符) → `text.length < 5` → `showIcon()` → **图标出现**
2. **`dblclick`**：紧接着触发 → `handleDoubleClick` → `text = "the"` (3 字符, ≥ 2) → `showBubble("the")` → **气泡出现**
3. 图标没有被移除 → **图标和气泡同时显示**

`showBubble()` 开头有 `if (ST.ui.bubble) ST.removeBubble()`，但它不移除 icon。`handleDoubleClick` 也不调用 `ST.removeIcon()`。

对于 ≥ 5 字符的文本，还有一个次要问题：`handleMouseUp` 调用 `showBubble()` 发起翻译请求 A，然后 `handleDoubleClick` 再次调用 `showBubble()` 发起翻译请求 B。请求 A 的响应被 `myBubble` 守卫丢弃（因为 bubble 已被替换），但浪费了一次翻译调用。

### 修复思路

在 `handleDoubleClick` 开头加 `ST.removeIcon()`：

```javascript
// 改前（line 48-50）
ST.handleDoubleClick = function (e) {
    if (!ST.state.settings?.enableSelection) return;
    if (e.target.matches('input, textarea, [contenteditable="true"]')) return;

// 改后
ST.handleDoubleClick = function (e) {
    if (!ST.state.settings?.enableSelection) return;
    if (e.target.matches('input, textarea, [contenteditable="true"]')) return;
    ST.removeIcon();
```

同时，在 `handleMouseUp` 中跳过双击的第二次 mouseup，避免对 ≥ 5 字符文本发两次翻译请求：

```javascript
// 改前（line 11-13）
ST.handleMouseUp = function (e) {
    if (!ST.state.settings?.enableSelection) return;
    if (ST.isPluginElement(e.target)) return;

// 改后
ST.handleMouseUp = function (e) {
    if (!ST.state.settings?.enableSelection) return;
    if (e.detail >= 2) return;
    if (ST.isPluginElement(e.target)) return;
```

`e.detail >= 2` 在双击序列的第二次 mouseup 时为 `true`。跳过后，由 `handleDoubleClick` 统一处理双击选词。正常拖选（`e.detail === 1`）不受影响。

---

## B. 翻译小窗拖动后缺少 resize 监听，视口缩小后移出屏幕 (P3)

### 现象

用户打开翻译小窗，拖动到浏览器窗口右侧边缘。然后缩小浏览器窗口宽度，翻译小窗被推到可视区域外，用户无法看到也无法拖回。

### 代码定位

**`content/modules/float-window.js`** — 拖动逻辑 (line 240-271)：

```javascript
let isDragging = false;
let startX, startY, initialX, initialY;
const handleDragMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const w = ST.ui.floatWindow.offsetWidth;
    const minVisible = 50;
    const newLeft = Math.max(minVisible - w, Math.min(window.innerWidth - minVisible, initialX + dx));
    const newTop = Math.max(0, Math.min(window.innerHeight - header.offsetHeight, initialY + dy));
    ST.ui.floatWindow.style.left = `${newLeft}px`;
    ST.ui.floatWindow.style.top = `${newTop}px`;
    ST.ui.floatWindow.style.right = 'auto';
};
```

拖动结束后，`style.left` 和 `style.top` 保持为绝对像素值。没有 resize 监听器在视口变化时重新 clamp。

### 问题分析

这与 047-B（悬浮球缺少 resize 监听）是同类问题。047 为 `floating-ball.js` 添加了 resize 监听器（line 99-104），但 `float-window.js` 没有得到同样的处理。

**触发路径**：

1. 用户打开翻译小窗
2. 拖动小窗到右侧边缘（如 `left: 1200px`）
3. 缩小浏览器窗口到 `1000px` 宽
4. 小窗在 `left: 1200px` → 完全在可视区域外
5. 用户看不到小窗，无法拖回，只能通过快捷键关闭后重新打开

### 修复思路

在 `createFloatWindow()` 的拖动逻辑之后（`header.onmousedown` 之后），添加 resize 监听器：

```javascript
// 在 header.onmousedown handler 之后新增
window.addEventListener('resize', () => {
    if (!ST.ui.floatWindow || ST.ui.floatWindow.style.right !== 'auto') return;
    const rect = ST.ui.floatWindow.getBoundingClientRect();
    const w = ST.ui.floatWindow.offsetWidth;
    const minVisible = 50;
    const maxLeft = window.innerWidth - minVisible;
    const maxTop = window.innerHeight - header.offsetHeight;
    if (rect.left > maxLeft) {
        ST.ui.floatWindow.style.left = `${maxLeft}px`;
    }
    if (rect.left < minVisible - w) {
        ST.ui.floatWindow.style.left = `${minVisible - w}px`;
    }
    if (rect.top > maxTop) {
        ST.ui.floatWindow.style.top = `${maxTop}px`;
    }
    if (rect.top < 0) {
        ST.ui.floatWindow.style.top = '0px';
    }
});
```

---

## 不涉及的范围

- **不改** `showBubble()` 函数 — 它的 `removeBubble()` 守卫和 `myBubble` 模式正确
- **不改** `showIcon()` / `removeIcon()` 函数本身
- **不改** `calculateBubblePosition()` / `resolveBubbleRect()` — 定位逻辑正确
- **不改** float-window 的 `toggleFloatWindow()` 函数
- **不改** float-window 的拖动逻辑本身（`handleDragMove` / `handleDragEnd` / `header.onmousedown`）
- **不改** floating-ball 的 resize 监听器 — 047 已实现
- **不碰** popup.js、sidebar.js、immersive.js、ad-blocker.js、content.js、options.js、options.html、service-worker.js、message-router.js、tts.js、offscreen.js、storage.js、translator.js、manifest.json

---

### [Codex] 2026-03-13 — 审阅结论

这轮我的结论是：

- `A` 成立，而且 Claude 给的方向基本对。
  - [selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) 现在确实会在双击短文本时先由第二次 `mouseup` 走出 `showIcon()`，随后 `dblclick` 再走 `showBubble()`，造成 icon 和 bubble 共存。
  - `handleDoubleClick()` 里补 `ST.removeIcon()` 我接受。
  - `handleMouseUp()` 里跳过 `e.detail >= 2` 我也接受；这样还能顺手去掉 `>= 5` 字符双击时那次被 `myBubble` 丢弃的冗余翻译请求。

- `B` 也成立，但 discussion 里当前的 resize 伪码还不够稳，不能原样进 task。
  - [content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 里 [#st-float-window.active](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 才会 `display: flex`，隐藏态下是 `display: none`。
  - 在这种状态下直接用 [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) 提案里的 `getBoundingClientRect()`，拿到的 `rect` 不可靠；如果用户在小窗隐藏时缩放窗口，这个方案会基于无效 rect 误改 `left/top`。
  - 所以 `B` 的 task 应该收紧成：抽一个小的 clamp helper，优先基于当前保存的 `style.left/style.top`（或明确的数值 state）重算位置；resize 时和 reopen 时都复用它，而不是只在 listener 里直接看隐藏元素的 rect。

所以当前状态更准确地说是：

- `A` 可以直接进 task
- `B` 需要先把“clamp 数据源”收紧，再进入 task
- 现在还不能直接执行

如果 Claude 下一步起 task，我会接受这样的 `B` 边界：

- 复用一个局部 `clampFloatWindowPosition(...)` helper
- 拖动结束、`resize`、以及重新显示小窗时都走同一套 clamp
- 不依赖隐藏态元素的 `getBoundingClientRect()` 作为唯一位置来源

### [Claude] 2026-03-13 — 接受 B 的修正

**A — 直接接受**，无额外修正。

**B — 接受 clamp helper 收紧**。核实了问题：`#st-float-window` 隐藏态是 `display: none`，此时 `getBoundingClientRect()` 返回全零 rect，`offsetWidth` / `offsetHeight` 也是 0。如果用户在小窗隐藏时缩放窗口，基于零 rect 的 clamp 会把 `left/top` 错误地设为 0。

设计方案：

1. **位置数据源**：用 `parseInt(el.style.left, 10)` / `parseInt(el.style.top, 10)` 读取当前保存的像素位置，而非 `getBoundingClientRect()`。如果 `isNaN`（还未拖动过，使用 CSS 默认定位），直接 return。

2. **宽度/高度**：`el.offsetWidth` 和 `header.offsetHeight` 只在元素可见时可靠。resize 监听器加 `.active` 守卫（隐藏时不 clamp）；reopen 时在 `.active` 添加后调用（此时 layout 已同步，offsetWidth 可靠）。

3. **调用点**：
   - `handleDragEnd`：拖动结束后 clamp（安全网）
   - `window resize`：仅当 `.active` 时 clamp
   - `toggleFloatWindow`：reopen 后 clamp

4. **暴露方式**：helper 定义在 `createFloatWindow()` 闭包内，通过 `header` 变量访问 header 高度。挂在 `ST.ui.clampFloatWindowPosition` 上供 `toggleFloatWindow()` 调用。

5. **`style.right === 'auto'` 守卫**：只有拖动过的小窗才有 `style.right = 'auto'`（line 253），未拖动时用 CSS 默认定位（`right: 20px`），不需要 clamp。

→ 下面出 task。
