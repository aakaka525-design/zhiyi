# 060 — Content Script TTS 消息层超时 & Offscreen stopAudio 防双重播放报告

- 状态: done
- 对应任务: [tasks/060-content-tts-timeout-offscreen-stop.md](../tasks/060-content-tts-timeout-offscreen-stop.md)
- 来源讨论: [discussions/060-content-tts-timeout-offscreen-stop.md](../discussions/060-content-tts-timeout-offscreen-stop.md)
- 执行日期: 2026-03-14

## 结果概览

本轮完成了 `A + B`：

- `A` sidebar 和 float-window 的远程 TTS 请求、offscreen 播放请求都显式 opt-in `15000ms` 消息层超时，内容脚本 UI 不再因为后台消息悬挂而长期锁死。
- `B` offscreen 新增了 `stopAudio` 停播链路，background 通过 `stopAudioViaOffscreen()` 中继，popup / sidebar / float-window 在远程 TTS fallback 到 system TTS 前都会 fire-and-forget 发送停播消息，避免旧音频和系统语音叠播。

## 已完成改动

### 60.1 A Content TTS / Offscreen 消息层超时

[sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 的 4 个调用点现在都显式传入了超时参数：

- `ttsOpenAI` → `15000ms / 'TTS 请求超时'`
- `ttsGoogle` → `15000ms / 'TTS 请求超时'`
- `ttsGLM` → `15000ms / 'TTS 请求超时'`
- `playAudioOffscreen` → `15000ms / '播放超时'`

[float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) 同样补齐了对应 4 处：

- `ttsOpenAI`
- `ttsGoogle`
- `ttsGLM`
- `playAudioOffscreen`

这轮没有改 [utils.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/utils.js) 的 `ST.sendMessage()` 实现本身，只复用了 `058` 已有的可选 timeout 参数。

### 60.2 B Offscreen stopAudio 中继链

[offscreen.js](/Users/xa/Desktop/projiect/zhiyi/offscreen/offscreen.js) 现在新增了同步 `stopAudio` handler：

```javascript
if (request.action === 'stopAudio') {
    if (cancelCurrent) cancelCurrent();
    sendResponse({ success: true });
    return;
}
```

它直接复用现有 `cancelCurrent()` 语义：

- 暂停当前 audio
- 清空 `currentAudio / cancelCurrent`
- 显式结束旧的 `playAudio()` Promise

[tts.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/tts.js) 新增了 `stopAudioViaOffscreen()`，实现约束保持在讨论收口范围内：

- 先用 `chrome.runtime.getContexts(...)` 检查 offscreen document 是否存在
- 不存在时直接返回 `{ success: true }`
- 存在时才发 `chrome.runtime.sendMessage({ action: 'stopAudio' })`
- 不会调用 `ensureOffscreenDocument()`

[message-router.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/message-router.js) 也新增了：

```javascript
case 'stopAudio':
    return tts.stopAudioViaOffscreen();
```

### 60.3 Fallback 前静默停音

[popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 的 remote TTS catch 现在会在 fallback 到 system TTS 前执行：

```javascript
chrome.runtime.sendMessage({ action: 'stopAudio' }).catch(() => {});
```

[sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 和 [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) 也同步补了：

```javascript
ST.sendMessage({ action: 'stopAudio' }).catch(() => {});
```

这里保持 fire-and-forget，不等待 stop 返回，也没有给 system TTS 加硬超时，和讨论约束一致。

## TDD 记录

本轮先新增了 [060-content-tts-timeout-offscreen-stop.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/060-content-tts-timeout-offscreen-stop.test.mjs)。

首次运行时 3 条子测试全部失败，分别暴露出：

- content 侧远程 TTS / offscreen 播放还没有 `15000ms` timeout opt-in
- offscreen / background 还没有 `stopAudio` 中继链
- popup / sidebar / float-window fallback 到 system TTS 前还没有停播旧音频

实现补丁后，这条新增测试转绿。

全量回归阶段还同步更新了 1 条旧静态断言：

- [darkmode-hardcode-tts-speak-guard.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/darkmode-hardcode-tts-speak-guard.test.mjs)

它原本锁定的是 `056` 时期 sidebar catch 里“直接 fallback 到 system speech”的旧结构；`060` 合法新增了 `stopAudio`，所以需要把断言更新到新模型。

## 验证

本轮实际跑过：

```bash
node --test tests/060-content-tts-timeout-offscreen-stop.test.mjs
node --test tests/*.test.mjs
node --check offscreen/offscreen.js
node --check background/modules/tts.js
node --check background/modules/message-router.js
node --check content/modules/sidebar.js
node --check content/modules/float-window.js
node --check popup/popup.js
git diff --check
```

验证结果：

- [060-content-tts-timeout-offscreen-stop.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/060-content-tts-timeout-offscreen-stop.test.mjs)：3/3 通过
- `node --test tests/*.test.mjs`：200/200 通过
- [offscreen.js](/Users/xa/Desktop/projiect/zhiyi/offscreen/offscreen.js) `node --check` 通过
- [tts.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/tts.js) `node --check` 通过
- [message-router.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/message-router.js) `node --check` 通过
- [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) `node --check` 通过
- [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) `node --check` 通过
- [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- sidebar / float-window 远程 TTS 请求超时后，会恢复按钮并回退到 system TTS
- popup 远程 TTS 请求或 offscreen 播放失败后，不会和旧音频叠播
- popup / sidebar / float-window 在当前没有 offscreen document 时，`stopAudio` 仍能安静返回成功
- 多次快速触发远程朗读 fallback 时，旧 offscreen 音频会被静默停止，不会把 `045/056` 的按钮 guard 卡死
