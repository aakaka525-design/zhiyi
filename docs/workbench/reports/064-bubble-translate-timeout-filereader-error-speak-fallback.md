# 064 — 划词气泡翻译无超时 & tts.js FileReader 错误丢失 & sidebar speakOpenAI 不回退报告

- 状态: done
- 对应任务: [tasks/064-bubble-translate-timeout-filereader-error-speak-fallback.md](../tasks/064-bubble-translate-timeout-filereader-error-speak-fallback.md)
- 来源讨论: [discussions/064-bubble-translate-timeout-filereader-error-speak-fallback.md](../discussions/064-bubble-translate-timeout-filereader-error-speak-fallback.md)
- 执行日期: 2026-03-14

## 结果概览

本轮完成了 `A + B + C + D`：

- `A` [selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) 的气泡翻译调用现在显式带 `30000ms` timeout，后台消息悬挂时不再永久停在 loading。
- `B` [tts.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/tts.js) 的 OpenAI / GLM FileReader 转换改成 `onload + onerror`，读取失败时会正确 reject 到外层错误路径。
- `C` [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 的 `speakOpenAI` 在拿不到 `audioData` 时不再直接 throw，而是回退到 `speakSystem(...)`。
- `D` 新增了 [064-bubble-translate-timeout-filereader-error-speak-fallback.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/064-bubble-translate-timeout-filereader-error-speak-fallback.test.mjs)，并同步更新了 3 条旧静态断言以接受 `064` 的合法结构变化。

## 已完成改动

### 64.1 bubble translate 显式超时

[selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) 的 `showBubble()` 原先直接：

```javascript
const response = await ST.sendMessage({
    action: 'translate',
    text: text,
    from: sourceLang,
    to: targetLang
});
```

现在改成：

```javascript
const response = await ST.sendMessage({
    action: 'translate',
    text: text,
    from: sourceLang,
    to: targetLang
}, 30000, '翻译请求超时');
```

这样行为和 sidebar / float-window 保持一致：

- 正常翻译 30 秒内完成时，与之前完全一致
- 后台消息挂起时，`catch` 会落到现有错误渲染路径，用户看到错误文案而不是永久 loading

### 64.2 OpenAI / GLM FileReader 改成 `onload + onerror`

[tts.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/tts.js) 里两处把 `Blob` 转 data URL 的逻辑原先都只用了：

```javascript
reader.onloadend = () => resolve(reader.result);
```

现在统一改成：

```javascript
const audioData = await new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
    reader.readAsDataURL(audioBlob);
});
```

效果是：

- 读取成功时仍然返回原有 `data:*/*;base64,...` 结果
- 读取失败时不再静默 resolve 空值，而是把错误抛回外层 `catch`
- 调用方现在会收到明确的 `response.error`

这轮刻意没有把 `onabort` 并进来，和 discussion 里收窄后的范围一致。

### 64.3 sidebar OpenAI TTS 回退系统朗读

[sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 的 `speakOpenAI` 之前在没有 `audioData` 时会：

```javascript
throw new Error(response?.error || 'OpenAI TTS failed');
```

现在改成：

```javascript
if (response?.error) console.warn('[TTS] OpenAI 返回错误:', response.error);
return speakSystem(text, lang, settings.ttsSpeed || 1.0);
```

这样与同文件里的 Google / GLM 路径保持一致：

- 有远程音频就照常播放
- 拿不到远程音频就自动回退系统 TTS
- 诊断信息仍保留在 `console.warn`

## TDD 记录

本轮先新增了 [064-bubble-translate-timeout-filereader-error-speak-fallback.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/064-bubble-translate-timeout-filereader-error-speak-fallback.test.mjs)。

初次运行时，3 条子测试全部失败，分别暴露出：

- bubble translate 还没有显式 timeout
- tts.js 两处 FileReader 仍然是旧的 `onloadend`
- sidebar OpenAI fallback 仍然是 `throw`

补上最小实现后，新测试转绿。

全量验证阶段还同步更新了 3 条旧静态断言，它们原本锁定的是 pre-064 的代码结构：

- [bubble-copy-error-history.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/bubble-copy-error-history.test.mjs)
- [bubble-race-offscreen-audio.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/bubble-race-offscreen-audio.test.mjs)
- [darkmode-hardcode-tts-speak-guard.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/darkmode-hardcode-tts-speak-guard.test.mjs)

这些调整只是在让旧静态断言接受 `064` 的合法结构变化，不是额外扩 scope。

## 验证

本轮 fresh 跑过：

```bash
node --test tests/064-bubble-translate-timeout-filereader-error-speak-fallback.test.mjs
node --test tests/*.test.mjs
node --check content/modules/selection.js
node --check background/modules/tts.js
node --check content/modules/sidebar.js
git diff --check
```

验证结果：

- [064-bubble-translate-timeout-filereader-error-speak-fallback.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/064-bubble-translate-timeout-filereader-error-speak-fallback.test.mjs)：3/3 通过
- `node --test tests/*.test.mjs`：213/213 通过
- [selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) `node --check` 通过
- [tts.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/tts.js) `node --check` 通过
- [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- 划词气泡翻译在后台消息悬挂时，会在超时后显示错误文字而不是永久 loading
- sidebar 的 OpenAI TTS 在远程返回空 `audioData` 时，会自动回退到系统朗读
- OpenAI / GLM 远程 TTS 在浏览器环境里如果出现 FileReader 失败，用户侧会收到明确失败链路，而不是静默卡死
