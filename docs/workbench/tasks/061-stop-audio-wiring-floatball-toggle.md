---
status: done
priority: P1
created: 2026-03-14
---

# 061 — stopAudioViaOffscreen 接线补漏（060 回归）

- 来源讨论: [discussions/061-stop-audio-wiring-floatball-toggle.md](../discussions/061-stop-audio-wiring-floatball-toggle.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/061-stop-audio-wiring-floatball-toggle.md](../discussions/061-stop-audio-wiring-floatball-toggle.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `background/service-worker.js` | 补 `stopAudioViaOffscreen` 导入 + deps |
| `tests/061-stop-audio-wiring.test.mjs` | 回归测试 |

## 任务清单

### 必做

#### A. service-worker.js 补接线

- [x] `background/service-worker.js:12` — 导入 `stopAudioViaOffscreen`：
  ```javascript
  // 改前（line 12）
  import { handleTTSGLM, handleTTSOpenAI, handleTTSGoogle, playAudioViaOffscreen } from './modules/tts.js';

  // 改后
  import { handleTTSGLM, handleTTSOpenAI, handleTTSGoogle, playAudioViaOffscreen, stopAudioViaOffscreen } from './modules/tts.js';
  ```

- [x] `background/service-worker.js:136-141` — 添加到 `tts` deps 对象：
  ```javascript
  // 改前（line 136-141）
  tts: {
      handleTTSGLM,
      handleTTSOpenAI,
      handleTTSGoogle,
      playAudioViaOffscreen,
  },

  // 改后
  tts: {
      handleTTSGLM,
      handleTTSOpenAI,
      handleTTSGoogle,
      playAudioViaOffscreen,
      stopAudioViaOffscreen,
  },
  ```

  行为说明：
  - 修复后 `message-router.js:28` 的 `tts.stopAudioViaOffscreen()` 能正确路由到 `tts.js:45-57` 的实现
  - 整个 060-B 的 stopAudio 链路恢复功能：popup/sidebar/float-window 的 fallback 前 stop 调用生效
  - 双重播放问题（offscreen audio + system TTS 同时发声）被修复

#### B. 回归测试

- [x] 新建 `tests/061-stop-audio-wiring.test.mjs`，至少覆盖：
  1. **导入完整性**：`service-worker.js` 从 `tts.js` 导入的符号必须包含 `stopAudioViaOffscreen`
  2. **deps 接线完整性**：`handleMessage` 传给 `routeMessage` 的 `deps.tts` 对象必须包含 `stopAudioViaOffscreen`
  3. **端到端路由**：`routeMessage({action: 'stopAudio'}, deps)` 能正确调用 `deps.tts.stopAudioViaOffscreen()` 并返回结果

  Codex 要求：不能只测 router，必须锁住 `service-worker.js` 的导入和 `deps.tts` 接线。

**不要做的事**：
- 不要改 `message-router.js` — 060 已正确实现 `case 'stopAudio'`
- 不要改 `tts.js` — 060 已正确实现 `stopAudioViaOffscreen`
- 不要改 `offscreen.js` — 060 已正确实现 `stopAudio` handler
- 不要改 `popup.js`、`sidebar.js`、`float-window.js` — 060 已正确实现 fallback 前 stopAudio
- 不要改 `content.js` — Codex 确认 B 不成立，floating-ball 有自己的 onChanged listener
- 不要改 `floating-ball.js` — 没有 bug
- 不要碰 options.js、manifest.json、menus.js、storage.js、translator.js

## 不做的事

- **不做** 061-B（悬浮球 toggle）— Codex 驳回：floating-ball.js 内部已有 `storage.onChanged` 监听
- **不做** 任何 060 已完成的文件改动

## 验证要求

- [x] `node --test tests/061-stop-audio-wiring.test.mjs` 通过
- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check background/service-worker.js` 通过
- [x] `git diff --check` 无输出
