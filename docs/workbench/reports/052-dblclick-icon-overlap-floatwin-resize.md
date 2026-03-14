# 052 — 双击 icon/bubble 重叠修复 & 翻译小窗 clamp + resize 监听报告

- 状态: done
- 对应任务: [tasks/052-dblclick-icon-overlap-floatwin-resize.md](../tasks/052-dblclick-icon-overlap-floatwin-resize.md)
- 来源讨论: [discussions/052-dblclick-icon-overlap-floatwin-resize.md](../discussions/052-dblclick-icon-overlap-floatwin-resize.md)
- 执行日期: 2026-03-13

## 结果概览

本轮完成了 `A/B`：

- `A` 双击短文本时不再同时出现 icon 和 bubble，双击长文本也不会再多发一次会被 `myBubble` 丢弃的冗余翻译请求
- `B` 翻译小窗现在有统一的 `clampFloatWindowPosition()` helper，拖动结束、窗口 resize 和重新显示时都会复用它，把拖出边界的小窗拉回可视区域

## 已完成改动

### 52.1 A 双击统一走 `handleDoubleClick`

[selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) 的 `handleMouseUp()` 现在增加了：

```javascript
if (e.detail >= 2) return;
```

这样双击序列里的第二次 `mouseup` 不会再继续进入短文本 `showIcon()` 或长文本 `showBubble()` 路径。

同一个文件里的 `handleDoubleClick()` 现在会在插件元素判断前先执行：

```javascript
ST.removeIcon();
```

这次修复后：

- 短文本双击时，不会先被 `mouseup(detail=2)` 生成 icon，再被 `dblclick` 生成 bubble
- 长文本双击时，不会再先发一次无效翻译请求，再由 `dblclick` 发第二次请求
- 即使双击目标后续被判定为插件元素，残留 icon 也会先被清掉

本轮没有改：

- [showBubble()](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js)
- [showIcon()](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js)
- bubble 定位逻辑

### 52.2 B 小窗位置 clamp helper + resize/reopen 复用

[float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) 在 `createFloatWindow()` 内新增了：

```javascript
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
```

关键点是这次没有走 discussion 初稿里那种“隐藏态直接读 `getBoundingClientRect()`”的方案，而是按收口后的 task 只基于：

- 已保存的 `style.left`
- 已保存的 `style.top`
- 当前可见时可靠的 `offsetWidth`
- `header.offsetHeight`

来做位置夹取。

这个 helper 现在被 3 处复用：

- 拖动结束 `handleDragEnd()`
- `window.resize`
- `toggleFloatWindow()` 重新显示时

因此现在三种场景都能被正确覆盖：

- 用户刚拖拽结束时，位置会被再夹一轮
- 小窗打开状态下缩放窗口时，会被自动拉回可视区域
- 小窗隐藏期间缩放窗口，再次打开时，也会在 reopen 时恢复到可抓回的位置

本轮没有修改：

- 拖动过程中的实时 clamp 公式
- 小窗 HTML 模板
- 悬浮球的 resize 逻辑

## TDD 记录

本轮按 test-first 执行，先新增了 [dblclick-icon-floatwin-resize.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/dblclick-icon-floatwin-resize.test.mjs)。

首次运行：

```bash
node --test tests/dblclick-icon-floatwin-resize.test.mjs
```

时 2 个子测试全部失败，分别暴露出：

- `selection.js` 还没有 `e.detail >= 2` 守卫，也没有在 `handleDoubleClick()` 前置 `ST.removeIcon()`
- `float-window.js` 还没有 `clampFloatWindowPosition()`，也没有在 dragEnd / resize / reopen 复用 clamp

补丁完成后，该新增测试转绿。

执行过程中，旧静态测试 [selection-toggle.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/selection-toggle.test.mjs) 仍固定匹配 `052` 之前的 `handleMouseUp` / `handleDoubleClick` 结构，因此本轮同步把它更新为接受新的双击守卫与 `removeIcon()` 逻辑。

## 验证

本轮实际跑过：

```bash
node --test tests/dblclick-icon-floatwin-resize.test.mjs
node --test tests/immersive-menu-drag.test.mjs tests/dark-mode-robustness.test.mjs
node --test tests/*.test.mjs
node --check content/modules/selection.js
node --check content/modules/float-window.js
git diff --check
```

验证结果：

- [dblclick-icon-floatwin-resize.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/dblclick-icon-floatwin-resize.test.mjs)：2/2 通过
- 相关旧测试 [immersive-menu-drag.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/immersive-menu-drag.test.mjs) 和 [dark-mode-robustness.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/dark-mode-robustness.test.mjs) 通过
- `node --test tests/*.test.mjs`：183/183 通过
- [selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) `node --check` 通过
- [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- 双击 2-4 字符文本时只出现 bubble，不再与 icon 重叠
- 双击较长文本时不会出现明显重复请求或闪烁
- 拖动翻译小窗到边缘后缩小浏览器窗口，小窗仍至少保留可拖回的可见区域
- 小窗隐藏期间缩放窗口，再次打开时位置会被重新 clamp
