# 027 — Float-window Enter IME 保护 + Sidebar swap 文本互换 + Popup paste 清旧结果报告

- 状态: done
- 对应任务: [tasks/027-float-ime-sidebar-swap-paste-stale.md](../tasks/027-float-ime-sidebar-swap-paste-stale.md)
- 来源讨论: [discussions/027-float-ime-sidebar-swap-paste-stale.md](../discussions/027-float-ime-sidebar-swap-paste-stale.md)
- 执行日期: 2026-03-13

## 结果概览

本轮一次性完成了 `A/B/C`：

- `A` float-window 的 Enter 快捷键现在会忽略 IME 组合态，不再误触翻译
- `B` sidebar 的 swap 在有成功结果显示时会把译文回填到输入框，反向翻译工作流与 popup 对齐
- `C` popup 的 paste 现在会清掉旧结果、`currentResult` 和旧星标状态，不再残留上一条翻译

## 已完成改动

### 27.1 A Float-window Enter handler 增加 IME 守卫

[float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) 的 Enter handler 现在从：

- `e.key === 'Enter' && !e.shiftKey`

改成：

- `e.key === 'Enter' && !e.shiftKey && !e.isComposing`

这与 sidebar 在 `024` 已采用的策略一致，能避免中文 / 日文 / 韩文输入法在候选确认阶段误触发翻译。

### 27.2 B Sidebar swap 在成功结果态下回填输入框

[sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 的 swap 仍然保持原有“source=auto 时静默跳过”的行为，但在可互换场景下新增了结果回填逻辑：

- 只有当 `resultCard` 处于 `active`
- 且 `resultContent.style.color` 为空，也就是当前不是错误态

才把 `resultContent.innerText` 回填到 `input`。

这次按 discussion 收口，直接以当前成功显示的 DOM 结果作为 sidebar 的真相源，没有引入新的局部 `currentResult` 状态，因此天然覆盖：

- 成功翻译后的结果显示
- 历史回放后的结果显示

同时不会误用：

- 清空后的空状态
- 错误 / catch 分支的错误文案

### 27.3 C Popup paste 后清理旧结果状态

[popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 的 paste handler 现在在：

- `elements.sourceText.value = text`
- `updateCharCount()`

之后，会立即调用：

- `clearResult()`

所以粘贴新文本时会同步清掉：

- `currentResult`
- 结果区域的 `active/error-state`
- 旧结果内容
- 收藏星标 fill

本轮没有扩成“手动输入时也清结果”，仍保持 task 里限定的 paste-only 修复范围。

## TDD 记录

本轮按 test-first 执行，新增了 [float-ime-swap-paste.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/float-ime-swap-paste.test.mjs)。

首次运行：

```bash
node --test tests/float-ime-swap-paste.test.mjs
```

时，3 个子测试全部红灯，分别覆盖：

- float-window Enter handler 还没有 `!e.isComposing`
- sidebar swap 仍然只换语言不换文本
- popup paste 后还没有 `clearResult()`

随后补最小实现，目标测试转绿。

## 验证

本轮实际跑过：

```bash
node --test tests/float-ime-swap-paste.test.mjs
node --test tests/*.test.mjs
node --check content/modules/float-window.js
node --check content/modules/sidebar.js
node --check popup/popup.js
git diff --check
```

验证结果：

- [float-ime-swap-paste.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/float-ime-swap-paste.test.mjs)：3/3 通过
- `node --test tests/*.test.mjs`：110/110 通过
- [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) `node --check` 通过
- [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) `node --check` 通过
- [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- float-window 在中文 / 日文 / 韩文输入法组合态下按 Enter 只确认候选，不会触发翻译
- sidebar 在已有成功译文时点击 swap，会把当前译文回填到输入框，便于直接反向翻译
- popup 在已有翻译结果时点击 paste，新文本写入后旧结果区和旧星标状态会立即消失
