# 045 — 翻译中控件统一禁用与朗读按钮防重复报告

- 状态: done
- 对应任务: [tasks/045-translate-loading-aux-buttons-speak-no-guard.md](../tasks/045-translate-loading-aux-buttons-speak-no-guard.md)
- 来源讨论: [discussions/045-translate-loading-aux-buttons-speak-no-guard.md](../discussions/045-translate-loading-aux-buttons-speak-no-guard.md)
- 执行日期: 2026-03-13

## 结果概览

本轮完成了 `A/B`：

- `A` popup / sidebar / float-window 在翻译进行中都会统一禁用与当前请求语义相关的控件
- `B` 三个面板的朗读按钮现在都有防重复 guard，非系统 TTS 不会再因为连点而并发叠播

## 已完成改动

### 45.1 A Popup loading 补禁用 clear / paste / swap

[popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 的 `setLoading()` 现在在原有的：

- `btnTranslate`
- `sourceText`
- `sourceLang`
- `targetLang`

之外，补上了：

- `btnClear`
- `btnPaste`
- `btnSwap`

这样 popup 翻译进行中不会再出现：

- 清空输入后结果回来但输入框为空
- 粘贴新内容后结果仍对应旧请求
- 互换语言后 UI 语言对和本次请求不一致

### 45.2 A Sidebar / Float-window 改为整组控件统一禁用

[sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 的翻译流程现在不再只禁用 `translateBtn`，而是统一切换：

- `translateBtn`
- `input`
- `sourceLangSelect`
- `targetLangSelect`
- `clearBtn`
- `swapBtn`

[float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) 则统一切换：

- `translateBtn`
- `input`
- `targetLangSelect`
- `clearBtn`

这和 `045` discussion 里收敛出的范围一致：内容侧不只是“辅助按钮可点”，而是整组会影响请求语义或 UI 显示的控件都需要一起冻结。

本轮没有去禁用结果区的朗读/复制按钮，那是 discussion 里明确留后的另一条 UX 线。

### 45.3 B 三个面板的朗读入口都加了防重复 guard

[popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 的 `btnSpeak` 现在会：

- 先检查 `!currentResult || elements.btnSpeak.disabled`
- 进入时 `elements.btnSpeak.disabled = true`
- 在 `finally` 里恢复

[sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 和 [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) 则各自新增了局部 `runSpeak(btn, fn)` helper，并把原来的裸 `speak(...)` 入口改成 wrapper 模式。

这里遵守了 discussion 里的约束：

- 不去改 `speak()` 内部逻辑
- 不侵入 `speakOpenAI / speakGoogle / speakGLM / speakSystem`
- UI 状态控制只放在按钮外层

一个关键行为是：[`offscreen.js`](/Users/xa/Desktop/projiect/zhiyi/offscreen/offscreen.js) 的 `playAudio()` 会在 `audio.onended` 时才 resolve，所以非系统 TTS 的按钮禁用会持续到整段远程音频播放结束。这是本轮刻意保留的行为，用来防止多音频叠播。

## TDD 记录

本轮按 test-first 执行，先新增了 [loading-disable-speak-guard.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/loading-disable-speak-guard.test.mjs)。

首次运行：

```bash
node --test tests/loading-disable-speak-guard.test.mjs
```

时 5 个子测试全部失败，分别覆盖：

- popup `setLoading()` 没有禁用 `clear / paste / swap`
- popup `btnSpeak` 没有 disabled guard
- sidebar 翻译期间没有冻结整组控件
- sidebar 朗读按钮没有 `runSpeak` wrapper
- float-window 既没有整组控件冻结，也没有 `runSpeak` wrapper

补丁完成后目标测试转绿。

## 兼容性测试更新

这轮还顺手更新了两条旧静态测试：

- [content-tts-history.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/content-tts-history.test.mjs)
- [css-token-and-speak.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/css-token-and-speak.test.mjs)

原因不是行为变化，而是它们原来把 float-window source 朗读入口钉死成了：

```javascript
speakSourceBtn.onclick = () => speak(input.value, 'auto');
```

`045` 合法地把入口改成了 `runSpeak(..., () => speak(...))` wrapper。旧测试的真实意图是“source 朗读把 `'auto'` 传入 speak”，不是“必须裸绑 onclick”，所以本轮把断言同步到了新结构。

## 验证

本轮实际跑过：

```bash
node --test tests/loading-disable-speak-guard.test.mjs
node --test tests/*.test.mjs
node --check popup/popup.js
node --check content/modules/sidebar.js
node --check content/modules/float-window.js
git diff --check
```

验证结果：

- [loading-disable-speak-guard.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/loading-disable-speak-guard.test.mjs)：5/5 通过
- `node --test tests/*.test.mjs`：165/165 通过
- [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) `node --check` 通过
- [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) `node --check` 通过
- [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- popup / sidebar / float-window 在翻译进行中时，相关输入与辅助控件确实不可交互
- popup 的朗读按钮在远程 TTS 播放期间保持禁用，播放结束后恢复
- sidebar / float-window 的原文/译文朗读按钮在快速连点时不会再并发叠播
