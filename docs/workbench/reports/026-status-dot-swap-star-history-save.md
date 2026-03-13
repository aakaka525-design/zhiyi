# 026 — Popup 状态指示灯 + Swap 星标同步 + Sidebar/Float-window 历史保存报告

- 状态: done
- 对应任务: [tasks/026-status-dot-swap-star-history-save.md](../tasks/026-status-dot-swap-star-history-save.md)
- 来源讨论: [discussions/026-status-dot-swap-star-history-save.md](../discussions/026-status-dot-swap-star-history-save.md)
- 执行日期: 2026-03-13

## 结果概览

本轮一次性完成了 `A/B/C`：

- `A` popup 底部状态点现在会根据当前翻译 provider 和 key 配置状态切换 `.active`
- `B` popup swap 后会重新同步收藏星标，不再沿用旧文本的收藏状态
- `C` sidebar 和 float-window 的成功翻译现在会显式写入历史；sidebar 改成等待写入完成后再刷新历史列表

## 已完成改动

### 26.1 A Popup 状态指示灯激活

[popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 的 `elements` 现在新增了 `statusDot` 引用，`updateServiceDisplay()` 在更新 provider 文本后，会同步切换状态点的 `.active` class。

判断规则保持为静态可用性判断，不做真实 API 探测：

- `google` 和 `offline` 直接视为可用
- `openai` 依赖 `openaiApiKey`
- `gemini` 依赖 `geminiApiKey`
- `deepseek` 依赖 `deepseekApiKey`

这让 [popup.css](/Users/xa/Desktop/projiect/zhiyi/popup/popup.css) 里原本闲置的 `.status-dot.active` 样式重新变成有效状态，而没有改动任何 HTML / CSS 结构。

### 26.2 B Swap 后收藏星标同步

[popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 的 swap handler 现在在把 `currentResult` 回填到 `sourceText` 并更新字符计数后，会额外调用一次 `syncFavoriteState()`。

这样当用户：

- 先翻译一段文本
- 收藏原文
- 再点击 swap 把译文换回输入框

星标会立刻按新 `sourceText` 重新计算，而不会继续保留上一段源文本的收藏状态。

### 26.3 C Sidebar / Float-window 翻译成功后写历史

[message-router.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/message-router.js) 新增了 `addHistory` action，直接转发到 [`StorageManager.addHistory()`](/Users/xa/Desktop/projiect/zhiyi/src/core/storage.js)。

[sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 的翻译成功分支现在会：

- `await ST.sendMessage({ action: 'addHistory', item })`
- 然后 `await ST.refreshSidebarHistory()`

原来的 `setTimeout(() => ST.refreshSidebarHistory(), 500)` 已删除，不再依赖时序碰运气。

[float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) 的翻译成功分支也新增了 `addHistory` 写入；因为它没有历史列表 UI，所以保持 fire-and-forget 即可。这里 `sourceLang` 固定写 `'auto'`，和 popup 自动检测语义保持一致。

本轮没有把“保存历史”塞进通用 `translate` action 默认路径，因此：

- popup 继续自己控制保存时机
- selection / immersive 仍然不会批量污染历史

## TDD 记录

本轮按 test-first 执行，新增了 [status-dot-swap-history.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/status-dot-swap-history.test.mjs)。

首次运行：

```bash
node --test tests/status-dot-swap-history.test.mjs
```

时先因为测试文件语法错误失败；修正测试语法后再次运行，4 个子测试全部红灯，分别覆盖：

- popup 尚未接入 `statusDot`
- swap 后没有重新 `syncFavoriteState()`
- router 尚无 `addHistory`
- sidebar / float-window 尚未写历史，且 sidebar 仍依赖 `setTimeout(..., 500)`

随后补最小实现，目标测试转绿。

## 验证

本轮实际跑过：

```bash
node --test tests/status-dot-swap-history.test.mjs
node --test tests/*.test.mjs
node --check popup/popup.js
node --check background/modules/message-router.js
node --check content/modules/sidebar.js
node --check content/modules/float-window.js
git diff --check
```

验证结果：

- [status-dot-swap-history.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/status-dot-swap-history.test.mjs)：4/4 通过
- `node --test tests/*.test.mjs`：107/107 通过
- [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) `node --check` 通过
- [message-router.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/message-router.js) `node --check` 通过
- [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) `node --check` 通过
- [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- popup 切换不同 provider 且配置 / 清空 key 后，底部状态点会按预期灰 / 绿切换
- popup 在已有翻译结果时执行 swap，收藏星标会按新输入文本即时同步
- sidebar 翻译成功后，“最近记录”区会立即出现新条目
- float-window 翻译成功后，新条目会写进 options 历史页和 sidebar 最近记录
