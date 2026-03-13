# 022 — UI 健壮性 & 性能修复报告

- 状态: done
- 对应任务: [tasks/022-ui-robustness-and-performance.md](../tasks/022-ui-robustness-and-performance.md)
- 来源讨论: [discussions/022-ui-robustness-and-performance.md](../discussions/022-ui-robustness-and-performance.md)
- 执行日期: 2026-03-13

## 结果概览

本轮完成了 `022` 收敛后的主体范围：

- **必做**：`A2 + A3 + C2`
- **推荐**：`B1 + C1 + C3`

本轮没有实现可选项：

- `A1` SVG null hardening
- `A4` popup 功能按钮执行确认链路
- `B2` 沉浸模式 `getComputedStyle` 缓存
- `B3` `transition: all` 逐步替换

按讨论结论，这 4 项统一并入 `023` 的可选范围，不在 `022` 内继续展开。

## 已完成改动

### 22.1 A2 Popup 字符计数状态集中

[popup/popup.js](/Users/xa/Desktop/projiect/zhiyi/.worktrees/feature-ui-update/popup/popup.js) 的字符计数逻辑现在统一收口到 `updateCharCount()`：

- 负责更新 `textContent`
- 负责 `classList.toggle('over-limit', len > MAX_CHARS)`

[popup/popup.css](/Users/xa/Desktop/projiect/zhiyi/.worktrees/feature-ui-update/popup/popup.css) 新增了：

- `.char-count.over-limit { color: var(--error); }`

这样修掉了讨论里确认的真实问题：程序化写值路径以前只更新数字，不同步超限颜色。

### 22.2 A3 Popup loading 锁定输入

[popup/popup.js](/Users/xa/Desktop/projiect/zhiyi/.worktrees/feature-ui-update/popup/popup.js) 的 `setLoading(true/false)` 现在除了切换翻译按钮外，也会同步切换：

- `sourceText.disabled`
- `sourceLang.disabled`
- `targetLang.disabled`

这次只做最小锁定，没有引入取消请求、去抖或额外状态机。

### 22.3 C2 disabled 样式反馈补齐

以下 3 份样式表现在都补了 `:disabled` 反馈：

- [popup/popup.css](/Users/xa/Desktop/projiect/zhiyi/.worktrees/feature-ui-update/popup/popup.css)
- [content/content.css](/Users/xa/Desktop/projiect/zhiyi/.worktrees/feature-ui-update/content/content.css)
- [options/theme.css](/Users/xa/Desktop/projiect/zhiyi/.worktrees/feature-ui-update/options/theme.css)

统一反馈为：

- `opacity: 0.6`
- `cursor: not-allowed`

覆盖范围包括 popup、sidebar、float-window、options 中已有 disabled 路径的控件。

### 22.4 B1 ad-blocker 全量扫描收敛

[content/modules/ad-blocker.js](/Users/xa/Desktop/projiect/zhiyi/.worktrees/feature-ui-update/content/modules/ad-blocker.js) 新增：

- `const AD_SELECTOR_QUERY = AD_SELECTORS.join(',\n')`

`injectStyles()` 和 `removeAds()` 现在都共用这一个复合 selector。

其中 `removeAds()` 已从“126 次独立 `querySelectorAll`”收敛为“一次 `querySelectorAll(AD_SELECTOR_QUERY)`”，在不改变现有 guard 逻辑的前提下降低全量扫描开销。

### 22.5 C1 键盘焦点态补 `:focus-visible`

以下样式表补上了键盘焦点可见性：

- [popup/popup.css](/Users/xa/Desktop/projiect/zhiyi/.worktrees/feature-ui-update/popup/popup.css)
- [content/content.css](/Users/xa/Desktop/projiect/zhiyi/.worktrees/feature-ui-update/content/content.css)
- [options/theme.css](/Users/xa/Desktop/projiect/zhiyi/.worktrees/feature-ui-update/options/theme.css)

本轮新增的 `:focus-visible` 规则覆盖了讨论中收敛的 7 处关键控件，包括：

- popup 的 `.textarea`、`.btn-icon`
- content 的 `.st-sidebar-input`、`.st-lang-select`、`.st-float-input`
- theme 的 `.btn`、`.input`

统一样式为：

- `outline: 2px solid var(--accent)`
- `outline-offset: 2px`

原有 `outline: none` 保留，因此鼠标交互视觉风格不变，键盘用户则获得了可见焦点反馈。

### 22.6 C3 float-window 拖拽事件生命周期

[content/modules/float-window.js](/Users/xa/Desktop/projiect/zhiyi/.worktrees/feature-ui-update/content/modules/float-window.js) 的拖拽逻辑不再使用：

- `document.onmousemove = ...`
- `document.onmouseup = ...`

现在改为：

- `document.addEventListener('mousemove', handleDragMove)`
- `document.addEventListener('mouseup', handleDragEnd)`
- `handleDragEnd()` 内显式 `removeEventListener(...)`

这样避免了覆盖宿主页面或其他扩展挂在同一属性上的处理器。

## TDD 记录

本轮按 test-first 执行，新增并持续扩展了 [ui-robustness-performance.test.mjs](/Users/xa/Desktop/projiect/zhiyi/.worktrees/feature-ui-update/tests/ui-robustness-performance.test.mjs)。

### 第一批

先为 `A2 + A3 + C2` 写断言。

首次运行：

```bash
node --test tests/ui-robustness-performance.test.mjs
```

结果 5 个断言全部失败，分别覆盖：

- `updateCharCount()` 还未集中管理超限状态
- `setLoading()` 还未锁定 textarea / language selects
- popup / content / theme 三处样式表均无 disabled 反馈

### 第二批

随后在同一测试文件中补入 `B1 + C1 + C3` 断言。

再次首次运行：

```bash
node --test tests/ui-robustness-performance.test.mjs
```

新增的 3 个断言失败，分别覆盖：

- `ad-blocker.js` 还没有 `AD_SELECTOR_QUERY`
- 三份 CSS 还没有 `:focus-visible`
- `float-window.js` 仍然使用 `document.onmousemove` / `document.onmouseup`

两批补丁完成后，该测试文件最终达到 `8/8` 通过。

## 验证

本轮实际跑过：

```bash
node --test tests/ui-robustness-performance.test.mjs
node --test tests/*.test.mjs
node --check popup/popup.js
node --check content/modules/ad-blocker.js
node --check content/modules/float-window.js
git diff --check
```

验证结果：

- `tests/ui-robustness-performance.test.mjs`：8/8 通过
- `node --test tests/*.test.mjs`：98/98 通过
- [popup/popup.js](/Users/xa/Desktop/projiect/zhiyi/.worktrees/feature-ui-update/popup/popup.js) `node --check` 通过
- [content/modules/ad-blocker.js](/Users/xa/Desktop/projiect/zhiyi/.worktrees/feature-ui-update/content/modules/ad-blocker.js) `node --check` 通过
- [content/modules/float-window.js](/Users/xa/Desktop/projiect/zhiyi/.worktrees/feature-ui-update/content/modules/float-window.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未在真实 Chrome 扩展环境中手工点验。仍待人工确认的页面级行为包括：

- popup 在翻译进行中，输入框和语言选择器会正确锁定，并在结束后恢复可交互
- popup / sidebar / float-window / options 的 disabled 样式在真实 UI 中不会造成过低可读性
- 键盘导航时，新补的 `:focus-visible` 焦点态在三类界面中都清晰可见
- float-window 拖拽在真实页面中仍然流畅，且不会与宿主页面拖拽/事件处理冲突
- ad-blocker 在广告密集页面上的行为保持原样，没有因复合 selector 引入误删
