# 061 — stopAudioViaOffscreen 接线补漏（060 回归）报告

- 状态: done
- 对应任务: [tasks/061-stop-audio-wiring-floatball-toggle.md](../tasks/061-stop-audio-wiring-floatball-toggle.md)
- 来源讨论: [discussions/061-stop-audio-wiring-floatball-toggle.md](../discussions/061-stop-audio-wiring-floatball-toggle.md)
- 执行日期: 2026-03-14

## 结果概览

本轮只完成了 `A`：

- [service-worker.js](/Users/xa/Desktop/projiect/zhiyi/background/service-worker.js) 现在已经正确导入并透传 `stopAudioViaOffscreen`
- `060` 新增的 `stopAudio` 路由链在 production wiring 上不再断开
- discussion 中被驳回的 `B`（悬浮球 toggle）没有进入本轮实现

## 已完成改动

### 61.1 service-worker 导入补漏

[service-worker.js](/Users/xa/Desktop/projiect/zhiyi/background/service-worker.js) 的 `tts.js` 导入现在从：

```javascript
import { handleTTSGLM, handleTTSOpenAI, handleTTSGoogle, playAudioViaOffscreen } from './modules/tts.js';
```

变成：

```javascript
import { handleTTSGLM, handleTTSOpenAI, handleTTSGoogle, playAudioViaOffscreen, stopAudioViaOffscreen } from './modules/tts.js';
```

### 61.2 routeMessage deps.tts 接线补漏

[service-worker.js](/Users/xa/Desktop/projiect/zhiyi/background/service-worker.js) 传给 `routeMessage(...)` 的 `deps.tts` 现在补上了：

```javascript
tts: {
    handleTTSGLM,
    handleTTSOpenAI,
    handleTTSGoogle,
    playAudioViaOffscreen,
    stopAudioViaOffscreen,
},
```

这样 [message-router.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/message-router.js) 里的：

```javascript
case 'stopAudio':
    return tts.stopAudioViaOffscreen();
```

不再触发 `tts.stopAudioViaOffscreen is not a function`。

## TDD 记录

本轮先新增了 [061-stop-audio-wiring.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/061-stop-audio-wiring.test.mjs)。

首次运行时 3 条子测试里有 2 条失败，精确暴露出：

- `service-worker.js` 还没有导入 `stopAudioViaOffscreen`
- `deps.tts` 里也还没有把它传给 `routeMessage`

第 3 条 `routeMessage({ action: 'stopAudio' }, deps)` 路由测试当时已经是绿的，这也证明问题不在 router 本身，而是在 service worker wiring。

补上最小接线后，这条新增测试转绿。

## 验证

本轮实际跑过：

```bash
node --test tests/061-stop-audio-wiring.test.mjs
node --test tests/*.test.mjs
node --check background/service-worker.js
git diff --check
```

验证结果：

- [061-stop-audio-wiring.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/061-stop-audio-wiring.test.mjs)：3/3 通过
- `node --test tests/*.test.mjs`：203/203 通过
- [service-worker.js](/Users/xa/Desktop/projiect/zhiyi/background/service-worker.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- popup / sidebar / float-window 在远程 TTS fallback 到 system TTS 前，旧 offscreen 音频会被真正停止
- `060` 的 `stopAudio` fire-and-forget 调用不再收到 `{ error: 'tts.stopAudioViaOffscreen is not a function' }`
- 长音频播放中再次触发 fallback 时，不会再出现 offscreen 音频和 system TTS 叠播
