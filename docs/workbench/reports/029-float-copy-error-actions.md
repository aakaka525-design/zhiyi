# 029 — Float-window 复制按钮 + 错误态隐藏操作按钮报告

- 状态: done
- 对应任务: [tasks/029-float-copy-error-actions.md](../tasks/029-float-copy-error-actions.md)
- 来源讨论: [discussions/029-float-copy-toast-theme-error-actions.md](../discussions/029-float-copy-toast-theme-error-actions.md)
- 执行日期: 2026-03-13

## 结果概览

本轮完成了 `A + C`：

- `A` float-window 的结果区现在补齐了与 sidebar 对齐的 `.st-result-actions` 容器，并新增复制按钮
- `C` sidebar 和 float-window 在错误态下都会打上 `error-state`，操作按钮改由 CSS 统一隐藏

## 已完成改动

### 29.1 A Float-window 结果区补齐复制按钮

[float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) 的结果头部现在从单个朗读按钮改成：

- `.st-result-actions`
- `#st-float-speak-result`
- `#st-float-copy-result`

这让 float-window 的结果区结构与 sidebar 对齐，但没有额外引入收藏、swap 等更重的交互。

同时新增了：

- `const copyResultBtn = ...`
- `const originalCopyIcon = copyResultBtn.innerHTML`
- `copyResultBtn.onclick = async () => { await navigator.clipboard.writeText(...) }`

复制成功后按钮会短暂显示“已复制”，再恢复原图标；失败路径只记录：

- `console.error('复制失败:', err)`

没有扩成 toast，也没有改动朗读按钮的 SVG 尺寸和 padding。

### 29.2 C Sidebar / Float-window 错误态统一用 error-state 隐藏操作按钮

[content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 新增了统一规则：

```css
.st-sidebar-result-card.error-state .st-result-actions,
.st-float-result.error-state .st-result-actions {
    display: none;
}
```

这保持了 popup 已经收敛过的“错误态靠 class + CSS 控制动作区显隐”的模式，没有在 JS 里继续写 `style.display`。

[sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 里这几条路径已同步：

- 翻译成功：`add('active')` 后 `remove('error-state')`
- 翻译失败：`add('active', 'error-state')`
- `catch`：`add('active', 'error-state')`
- 历史点击：恢复结果时 `remove('error-state')`

[float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) 里也同步了相同语义：

- 翻译成功：`remove('error-state')`
- 翻译失败：`add('active', 'error-state')`
- `catch`：`add('active', 'error-state')`

清空路径保持不动，仍然只移除 `active` 隐藏整个结果容器。

## TDD 记录

本轮按 test-first 执行，新增了 [float-copy-error-state.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/float-copy-error-state.test.mjs)。

首次运行：

```bash
node --test tests/float-copy-error-state.test.mjs
```

时 4 个子测试全部失败，覆盖了：

- float-window 结果头部还没有 `.st-result-actions` 和复制按钮
- `content.css` 还没有错误态隐藏 action 的规则
- sidebar 成功/失败/历史点击路径还没有 `error-state` 收口
- float-window 成功/失败路径还没有 `error-state` 收口

补丁完成后目标测试转绿。

本轮还同步更新了既有静态测试 [translate-error-feedback.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/translate-error-feedback.test.mjs)，使它接受 `029` 新增的 `error-state` class 切换。

## 验证

本轮实际跑过：

```bash
node --test tests/float-copy-error-state.test.mjs
node --test tests/*.test.mjs
node --check content/modules/float-window.js
node --check content/modules/sidebar.js
git diff --check
```

验证结果：

- [float-copy-error-state.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/float-copy-error-state.test.mjs)：4/4 通过
- `node --test tests/*.test.mjs`：117/117 通过
- [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) `node --check` 通过
- [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- float-window 在成功翻译后，复制按钮可以正常复制译文并恢复图标
- float-window 与 sidebar 在翻译失败时，朗读/复制按钮都会隐藏
- sidebar 从历史记录回放成功结果后，错误态按钮隐藏会被正确解除
