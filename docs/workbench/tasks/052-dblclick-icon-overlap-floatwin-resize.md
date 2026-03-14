---
status: done
priority: P3
created: 2026-03-13
---

# 052 — 双击 icon/bubble 重叠修复 & 翻译小窗 clamp + resize 监听

- 来源讨论: [discussions/052-dblclick-icon-overlap-floatwin-resize.md](../discussions/052-dblclick-icon-overlap-floatwin-resize.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/052-dblclick-icon-overlap-floatwin-resize.md](../discussions/052-dblclick-icon-overlap-floatwin-resize.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/selection.js` | A：`handleMouseUp` 加 `e.detail >= 2` 守卫；`handleDoubleClick` 加 `ST.removeIcon()` |
| `content/modules/float-window.js` | B：新增 `clampFloatWindowPosition` helper + resize 监听 + reopen/dragEnd 调用 |
| `tests/dblclick-icon-floatwin-resize.test.mjs` | A + B |

## 任务清单

### 必做

#### A. 双击短文本时 icon 与 bubble 不再重叠

双击 2-4 字符文本时，`handleMouseUp` 先显示 icon，紧接着 `handleDoubleClick` 显示 bubble 但不移除 icon，导致两者同时可见。同时 ≥ 5 字符文本双击会发两次翻译请求（第一次被 `myBubble` 守卫丢弃）。

- [x] `content/modules/selection.js` — 在 `handleMouseUp` 中（当前 line 12），在 `ST.isPluginElement` 检查之前，新增 `e.detail >= 2` 守卫：
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

  行为说明：
  - `e.detail` 在双击序列的第二次 mouseup 时为 `2`，跳过后由 `handleDoubleClick` 统一处理
  - 正常拖选（`e.detail === 1`）不受影响
  - 消除了 ≥ 5 字符双击时的冗余翻译请求

- [x] `content/modules/selection.js` — 在 `handleDoubleClick` 中（当前 line 50），在 `ST.isPluginElement` 检查之前，新增 `ST.removeIcon()`：
  ```javascript
  // 改前（line 48-51）
  ST.handleDoubleClick = function (e) {
      if (!ST.state.settings?.enableSelection) return;
      if (e.target.matches('input, textarea, [contenteditable="true"]')) return;
      if (ST.isPluginElement(e.target)) return;

  // 改后
  ST.handleDoubleClick = function (e) {
      if (!ST.state.settings?.enableSelection) return;
      if (e.target.matches('input, textarea, [contenteditable="true"]')) return;
      ST.removeIcon();
      if (ST.isPluginElement(e.target)) return;
  ```

  行为说明：
  - `removeIcon()` 在 `isPluginElement` 检查之前，确保即使 dblclick 目标是插件元素，也能清理残留的 icon
  - 配合 `e.detail >= 2` 守卫，双击时 `handleMouseUp` 不再创建 icon/bubble，`handleDoubleClick` 独占处理

**不要做的事**：
- 不要改 `showBubble()` 函数 — `removeBubble()` 守卫和 `myBubble` 模式正确
- 不要改 `showIcon()` / `removeIcon()` 函数本身
- 不要改 `calculateBubblePosition()` / `resolveBubbleRect()`
- 不要改 `handleMouseDown` 函数

### 必做

#### B. 翻译小窗 clamp helper + resize 监听 + reopen clamp

翻译小窗拖动后保存绝对像素位置，视口缩小后无 re-clamp 机制。隐藏态（`display: none`）的元素 `getBoundingClientRect()` / `offsetWidth` 返回 0，不能作为位置数据源。

- [x] `content/modules/float-window.js` — 在 `createFloatWindow()` 内部，`header.onmousedown` handler 之后、函数末尾 `};` 之前（当前 line 271 之后），新增 clamp helper 和 resize 监听：
  ```javascript
  // 在 header.onmousedown handler 之后新增

  ST.ui.clampFloatWindowPosition = () => {
      const el = ST.ui.floatWindow;
      if (!el || el.style.right !== 'auto') return;
      const left = parseInt(el.style.left, 10);
      const top = parseInt(el.style.top, 10);
      if (isNaN(left) || isNaN(top)) return;
      const w = el.offsetWidth;
      const minVisible = 50;
      el.style.left = `${Math.max(minVisible - w, Math.min(window.innerWidth - minVisible, left))}px`;
      el.style.top = `${Math.max(0, Math.min(window.innerHeight - header.offsetHeight, top))}px`;
  };

  window.addEventListener('resize', () => {
      if (ST.ui.floatWindow?.classList.contains('active')) {
          ST.ui.clampFloatWindowPosition();
      }
  });
  ```

  行为说明：
  - `style.right !== 'auto'` 守卫：只有拖动过的小窗才需要 clamp（拖动时 line 253 设 `style.right = 'auto'`），未拖动时用 CSS 默认定位
  - `parseInt(el.style.left)` / `parseInt(el.style.top)` 读取保存的像素位置，不依赖 `getBoundingClientRect()`
  - `isNaN` 守卫：如果 `style.left/top` 不是有效数字（不应发生，但防御性检查）
  - `el.offsetWidth` / `header.offsetHeight` 在元素可见时可靠；resize 监听器用 `.active` 守卫确保只在可见时调用
  - 挂在 `ST.ui.clampFloatWindowPosition` 上供 `toggleFloatWindow()` 外部调用

- [x] `content/modules/float-window.js` — 修改 `handleDragEnd`（当前 line 255-259），在末尾调用 clamp：
  ```javascript
  // 改前（line 255-259）
  const handleDragEnd = () => {
      isDragging = false;
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
  };

  // 改后
  const handleDragEnd = () => {
      isDragging = false;
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      ST.ui.clampFloatWindowPosition?.();
  };
  ```

- [x] `content/modules/float-window.js` — 修改 `toggleFloatWindow()`（当前 line 278-288），在 reopen 时调用 clamp：
  ```javascript
  // 改前（line 278-288）
  ST.toggleFloatWindow = function () {
      if (!ST.ui.floatWindow) {
          ST.createFloatWindow();
      }
      const isActive = ST.ui.floatWindow.classList.toggle('active');
      if (isActive) {
          setTimeout(() => {
              ST.ui.floatWindow.querySelector('#st-float-input').focus();
          }, 100);
      }
  };

  // 改后
  ST.toggleFloatWindow = function () {
      if (!ST.ui.floatWindow) {
          ST.createFloatWindow();
      }
      const isActive = ST.ui.floatWindow.classList.toggle('active');
      if (isActive) {
          ST.ui.clampFloatWindowPosition?.();
          setTimeout(() => {
              ST.ui.floatWindow.querySelector('#st-float-input').focus();
          }, 100);
      }
  };
  ```

  行为说明：
  - reopen 时 `.active` 已添加（`classList.toggle` 返回 `true`），元素 `display: flex`，`offsetWidth` 可靠
  - 如果用户在小窗隐藏期间缩放了窗口，reopen 时 clamp 会把小窗拉回可视区域
  - `?.()` 防御性调用：如果 `createFloatWindow()` 尚未运行（不应发生，但安全起见）

**不要做的事**：
- 不要改 `handleDragMove` 中的内联 clamp 逻辑 — 拖动过程中的实时 clamp 保持不变
- 不要改 `header.onmousedown` handler
- 不要在 resize 监听器中使用 `getBoundingClientRect()` — 隐藏态下返回零值
- 不要改 float-window 的 HTML 模板
- 不要改 floating-ball 的 resize 监听器 — 047 已实现

## 不做的事

- **不做** `showBubble` / `removeBubble` 改动 — `myBubble` 守卫正确
- **不做** `showIcon` / `removeIcon` 改动 — 函数本身正确
- **不做** `handleDragMove` 内联 clamp 改动 — 拖动时实时 clamp 保持不变
- **不做** floating-ball resize 改动 — 047 已实现
- **不碰** popup.js、sidebar.js、immersive.js、ad-blocker.js、content.js、options.js、options.html、service-worker.js、message-router.js、tts.js、offscreen.js、storage.js、translator.js、manifest.json

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check content/modules/selection.js` 通过
- [x] `node --check content/modules/float-window.js` 通过
- [x] `git diff --check` 无输出
