# 055 — 内容脚本深色模式 & 悬浮球拖拽偏移量修复报告

- 状态: done
- 对应任务: [tasks/055-content-darkmode-floatball-drag.md](../tasks/055-content-darkmode-floatball-drag.md)
- 来源讨论: [discussions/055-content-darkmode-floatball-drag.md](../discussions/055-content-darkmode-floatball-drag.md)
- 执行日期: 2026-03-13

## 结果概览

本轮完成了 `A/B`：

- `A` 内容脚本 UI 现在会跟随 `darkMode` 设置切换到 scoped 深色变量，不污染宿主页面。
- `B` 悬浮球拖拽时现在保持用户原始抓取点，不再跳到光标中心。

## 已完成改动

### 55.1 A 内容脚本深色模式

[content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) 新增了：

```javascript
function applyContentTheme(enabled) {
    if (enabled) {
        document.documentElement.setAttribute('data-st-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-st-theme');
    }
}
```

然后把这个 helper 接到了两条真实设置生效链路上：

- `init()` 里 `await loadSettings()` 之后立即调用
- `chrome.storage.onChanged` 里更新 `ST.state.settings` 后再次调用

这样现在：

- 初次注入内容脚本时，会按当前 `darkMode` 直接设置主题
- 用户在 options 页切换深色模式时，内容脚本会实时跟随

[content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 在原有浅色变量块后补了一组：

```css
:root[data-st-theme="dark"] ...
```

覆盖对象与原有浅色 token scope 完全一致，包括：

- `#smart-translator-bubble`
- `#st-sidebar`
- `#st-float-window`
- `#st-floating-ball-container`
- `.st-immersive-wrapper`
- `.st-immersive-translation`
- `.st-translation-separator`
- `#st-toast`

这次修复保持了 discussion 收口后的边界：

- 不用 `body.dark-mode`
- 不逐个给内容 UI 加 `.st-dark`
- 不改 popup / options 的现有主题系统

### 55.2 B 悬浮球拖拽偏移量

[floating-ball.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/floating-ball.js) 的 `onMouseMove()` 现在从：

```javascript
let newLeft = clientX - 20;
let newTop = clientY - 20;
```

改成：

```javascript
let newLeft = clientX - dragOffset.x;
let newTop = clientY - dragOffset.y;
```

`dragOffset` 本来就在 `onMouseDown()` 里按球体实际矩形计算好了，所以这次修复后：

- 抓住球边缘拖动时，球体会保持抓取点
- 不再先跳向光标中心再跟随
- `dockToEdge()`、吸附逻辑和 resize 修复保持不变

## TDD 记录

本轮按 test-first 执行，先新增了 [content-darkmode-floatball-drag.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/content-darkmode-floatball-drag.test.mjs)。

首次运行：

```bash
node --test tests/content-darkmode-floatball-drag.test.mjs
```

时 2 个子测试全部失败，分别暴露出：

- `content.js` 还没有 `applyContentTheme()`，也没有在 `init()` / `storage.onChanged` 接入
- `content.css` 还没有 `:root[data-st-theme="dark"]` 作用域块
- `floating-ball.js` 仍然在 `onMouseMove()` 里硬编码 `clientX - 20` / `clientY - 20`

补丁完成后，该新增测试转绿。

## 验证

本轮实际跑过：

```bash
node --test tests/content-darkmode-floatball-drag.test.mjs
node --test tests/*.test.mjs
node --check content/content.js
node --check content/modules/floating-ball.js
git diff --check
```

验证结果：

- [content-darkmode-floatball-drag.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/content-darkmode-floatball-drag.test.mjs)：2/2 通过
- `node --test tests/*.test.mjs`：189/189 通过
- [content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) `node --check` 通过
- [floating-ball.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/floating-ball.js) `node --check` 通过
- `git diff --check` 无输出

说明：

- 本轮没有单独跑 CSS lint；内容侧 CSS 主要通过新增静态断言和全量测试覆盖结构验证

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- 在深色网页上开启扩展深色模式后，划词气泡、侧边栏、小窗、悬浮球、沉浸式译文和 toast 都切到深色
- 关闭深色模式后，内容脚本 UI 恢复浅色
- 悬浮球抓住边缘拖动时不再出现明显跳心
- 拖拽结束后的边缘吸附行为仍与 047 保持一致
