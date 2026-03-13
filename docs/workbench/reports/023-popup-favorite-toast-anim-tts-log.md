# 023 — Popup 收藏按钮返回值检查 + Toast 动画居中修复 + TTS GLM debug log 清理报告

- 状态: done
- 对应任务: [tasks/023-popup-favorite-toast-anim-tts-log.md](../tasks/023-popup-favorite-toast-anim-tts-log.md)
- 来源讨论: [discussions/023-popup-favorite-toast-anim-tts-log.md](../discussions/023-popup-favorite-toast-anim-tts-log.md)
- 执行日期: 2026-03-13

## 结果概览

本轮一次性完成了 `A/B/C`：

- `A` popup 收藏按钮现在区分“新收藏”和“重复收藏”，并在翻译成功后同步星标状态
- `B` content toast 改用专用 `st-toast-fade-in`，入场动画不再覆盖居中位移
- `C` GLM TTS handler 的 2 条 success-path debug log 已删除

## 已完成改动

### 23.1 A Popup 收藏反馈与星标状态同步

[popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 的收藏按钮现在会检查 [`StorageManager.addFavorite()`](/Users/xa/Desktop/projiect/zhiyi/src/core/storage.js) 的返回值：

- 返回新收藏对象时显示 `已添加到收藏`
- 返回 `null` 时显示 `已在收藏中`

原先那条无条件把星标填成 `var(--warning)` 的直接 DOM 写入已经删除，星标状态统一交给新增的 `syncFavoriteState()` helper 管理。

这个 helper 会：

- 读取当前 `sourceText`
- 为空时把星标恢复为空心
- 非空时调用 `StorageManager.isFavorite(text)`，再把星标 fill 同步为 `var(--warning)` 或 `none`

同时，[handleTranslate()](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 在成功写入历史记录后会 `await syncFavoriteState()`，所以当用户翻译一段已经收藏过的文本时，结果区出现后星标也会立即回到已收藏状态，而不会像以前那样被 `clearResult()` 永远重置成空心。

这轮没有把 `showResult()` 改成 async，仍保持它是纯同步 UI 渲染函数。

### 23.2 B Toast 入场动画不再覆盖 X 轴居中

[content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 里的 `#st-toast` 仍然保留原有的：

- `left: 50%`
- `transform: translateX(-50%)`

没有改成新的布局模型。

本轮只新增了 toast 专用的：

- `@keyframes st-toast-fade-in`

它从：

- `transform: translate(-50%, 8px)`

过渡到：

- `transform: translate(-50%, 0)`

并把 `#st-toast` 的动画引用从 `st-fade-in` 改为 `st-toast-fade-in`。这样：

- X 轴的 `-50%` 位移在整个动画期间都被保留
- Y 轴仍然有向上滑入效果
- 其他仍在使用 `st-fade-in` 的 bubble / immersive / float-window / sidebar 都不受影响

### 23.3 C GLM TTS success-path debug log 清理

[tts.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/tts.js) 已删除这两条 debug `console.log`：

- `GLM 后台请求`
- `GLM 成功, 数据长度`

保留了原有的错误日志：

- `console.error('[TTS] GLM 响应错误:', errText)`
- `console.error('[TTS] GLM TTS 失败:', err)`

这样 GLM handler 的日志行为现在与 OpenAI / Google 保持一致：正常请求不刷日志，只在错误路径输出。

## TDD 记录

本轮按 test-first 执行，新增了 [popup-favorite-toast-tts.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/popup-favorite-toast-tts.test.mjs)。

首次运行：

```bash
node --test tests/popup-favorite-toast-tts.test.mjs
```

时，3 个子测试全部失败，分别覆盖：

- popup 仍然无条件提示“已添加到收藏”，且没有 `syncFavoriteState()`
- content toast 仍然引用共享的 `st-fade-in`
- GLM handler 仍然残留两条 success-path `console.log`

补丁完成后，目标测试转绿。

## 验证

本批实际跑过：

```bash
node --test tests/popup-favorite-toast-tts.test.mjs
node --test tests/*.test.mjs
node --check popup/popup.js
node --check background/modules/tts.js
git diff --check
```

验证结果：

- [popup-favorite-toast-tts.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/popup-favorite-toast-tts.test.mjs)：3/3 通过
- `node --test tests/*.test.mjs`：98/98 通过
- [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) `node --check` 通过
- [tts.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/tts.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- popup 中对同一源文本重复点击收藏时，toast 会稳定区分“已添加到收藏”和“已在收藏中”
- popup 翻译一个已收藏文本时，结果出现后星标会自动同步为已收藏状态
- content 页面 toast 的实际入场动画不再先偏移再跳回居中
- GLM TTS 正常请求时，Service Worker console 不再输出 success-path debug log
