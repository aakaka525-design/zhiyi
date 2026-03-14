---
status: done
priority: P2
created: 2026-03-14
---

# 060 — Content Script TTS 消息层超时 & Offscreen stopAudio 防双重播放

- 来源讨论: [discussions/060-content-tts-timeout-offscreen-stop.md](../discussions/060-content-tts-timeout-offscreen-stop.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/060-content-tts-timeout-offscreen-stop.md](../discussions/060-content-tts-timeout-offscreen-stop.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `offscreen/offscreen.js` | B：新增 `stopAudio` handler |
| `background/modules/tts.js` | B：新增 `stopAudioViaOffscreen` export |
| `background/modules/message-router.js` | B：新增 `stopAudio` case |
| `content/modules/sidebar.js` | A：4 处 sendMessage 加 15s timeout；B：fallback 前 stopAudio |
| `content/modules/float-window.js` | A：4 处 sendMessage 加 15s timeout；B：fallback 前 stopAudio |
| `popup/popup.js` | B：fallback 前 stopAudio |
| `tests/060-content-tts-timeout-offscreen-stop.test.mjs` | A + B |

## 任务清单

### 必做

#### A. Sidebar / Float-window TTS + Offscreen 消息层 15s 超时

利用 058-A 已有的 `ST.sendMessage(message, timeoutMs, timeoutMessage)` 参数，给 8 个调用点 opt-in 15000ms 超时。

- [x] `content/modules/sidebar.js` — `speakOpenAI` 中 ttsOpenAI 请求加超时（当前 line 212-219）：
  ```javascript
  // 改前（line 212-219）
  const response = await ST.sendMessage({
      action: 'ttsOpenAI',
      apiKey,
      baseUrl: settings.openaiBaseUrl,
      text,
      voice: settings.ttsVoiceOpenai || 'nova',
      speed: settings.ttsSpeed || 1.0
  });

  // 改后
  const response = await ST.sendMessage({
      action: 'ttsOpenAI',
      apiKey,
      baseUrl: settings.openaiBaseUrl,
      text,
      voice: settings.ttsVoiceOpenai || 'nova',
      speed: settings.ttsSpeed || 1.0
  }, 15000, 'TTS 请求超时');
  ```

- [x] `content/modules/sidebar.js` — `speakGoogle` 中 ttsGoogle 请求加超时（当前 line 237-243）：
  ```javascript
  // 改前（line 237-243）
  const response = await ST.sendMessage({
      action: 'ttsGoogle',
      apiKey,
      text,
      voice,
      speed: settings.ttsSpeed || 1.0
  });

  // 改后
  const response = await ST.sendMessage({
      action: 'ttsGoogle',
      apiKey,
      text,
      voice,
      speed: settings.ttsSpeed || 1.0
  }, 15000, 'TTS 请求超时');
  ```

- [x] `content/modules/sidebar.js` — `speakGLM` 中 ttsGLM 请求加超时（当前 line 260-265）：
  ```javascript
  // 改前（line 260-265）
  const response = await ST.sendMessage({
      action: 'ttsGLM',
      apiKey,
      text,
      voice,
      speed: settings.ttsSpeed || 1.0
  });

  // 改后
  const response = await ST.sendMessage({
      action: 'ttsGLM',
      apiKey,
      text,
      voice,
      speed: settings.ttsSpeed || 1.0
  }, 15000, 'TTS 请求超时');
  ```

- [x] `content/modules/sidebar.js` — `playAudioFromDataUrl` 中 playAudioOffscreen 请求加超时（当前 line 200-204）：
  ```javascript
  // 改前（line 200-204）
  const result = await ST.sendMessage({
      action: 'playAudioOffscreen',
      audioData: dataUrl,
      speed
  });

  // 改后
  const result = await ST.sendMessage({
      action: 'playAudioOffscreen',
      audioData: dataUrl,
      speed
  }, 15000, '播放超时');
  ```

- [x] `content/modules/float-window.js` — `speak` 中 ttsOpenAI 请求加超时（当前 line 122-129）：
  ```javascript
  // 改前（line 122-129）
  const response = await ST.sendMessage({
      action: 'ttsOpenAI',
      apiKey: settings.openaiApiKey,
      baseUrl: settings.openaiBaseUrl,
      text,
      voice: settings.ttsVoiceOpenai || 'nova',
      speed
  });

  // 改后
  const response = await ST.sendMessage({
      action: 'ttsOpenAI',
      apiKey: settings.openaiApiKey,
      baseUrl: settings.openaiBaseUrl,
      text,
      voice: settings.ttsVoiceOpenai || 'nova',
      speed
  }, 15000, 'TTS 请求超时');
  ```

- [x] `content/modules/float-window.js` — ttsGoogle 请求加超时（当前 line 132-138）：
  ```javascript
  // 改前（line 132-138）
  const response = await ST.sendMessage({
      action: 'ttsGoogle',
      apiKey: settings.geminiApiKey,
      text,
      voice: settings.ttsVoiceGoogle || ST.getDefaultGoogleTtsVoice(resolvedLang),
      speed
  });

  // 改后
  const response = await ST.sendMessage({
      action: 'ttsGoogle',
      apiKey: settings.geminiApiKey,
      text,
      voice: settings.ttsVoiceGoogle || ST.getDefaultGoogleTtsVoice(resolvedLang),
      speed
  }, 15000, 'TTS 请求超时');
  ```

- [x] `content/modules/float-window.js` — ttsGLM 请求加超时（当前 line 141-147）：
  ```javascript
  // 改前（line 141-147）
  const response = await ST.sendMessage({
      action: 'ttsGLM',
      apiKey: settings.deepseekApiKey,
      text,
      voice: settings.ttsVoiceGlm || 'tongtong',
      speed
  });

  // 改后
  const response = await ST.sendMessage({
      action: 'ttsGLM',
      apiKey: settings.deepseekApiKey,
      text,
      voice: settings.ttsVoiceGlm || 'tongtong',
      speed
  }, 15000, 'TTS 请求超时');
  ```

- [x] `content/modules/float-window.js` — `playAudio` 中 playAudioOffscreen 请求加超时（当前 line 112-116）：
  ```javascript
  // 改前（line 112-116）
  const result = await ST.sendMessage({
      action: 'playAudioOffscreen',
      audioData: dataUrl,
      speed: playbackSpeed
  });

  // 改后
  const result = await ST.sendMessage({
      action: 'playAudioOffscreen',
      audioData: dataUrl,
      speed: playbackSpeed
  }, 15000, '播放超时');
  ```

  行为说明：
  - 15000ms — 与 popup/options 的 TTS/播放超时一致
  - 超时后 reject → `speak` 的 catch 块捕获 → fallback 到 system TTS → `runSpeak` 的 finally 恢复按钮
  - 不碰 system TTS 路径 — 与 056/058/059 保持一致
  - 不碰 `runSpeak` 函数 — 不加全局超时

**不要做的事**：
- 不要给 `runSpeak` 加固定超时 — Codex 在 045/046/058 反复驳回
- 不要给 system TTS（`speakSystem` / `speechSynthesis.speak`）加超时 — 056 明确不碰
- 不要新增 helper — 直接用 `ST.sendMessage` 的第二三参数
- 不要改 `ST.sendMessage` 本身 — 058-A 已实现
- 不要改 popup.js 的 TTS 超时 — 059-B 已实现
- 不要改 options.js — 044 已实现

#### B. Offscreen stopAudio + Background 中继 + Caller 侧 fallback 前停止

##### B1. Offscreen 新增 `stopAudio` handler

- [x] `offscreen/offscreen.js` — 在现有 `playAudio` handler 之后新增 `stopAudio`（当前 line 6-13）：
  ```javascript
  // 改前（line 6-13 整体）
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'playAudio' && request.audioData) {
          playAudio(request.audioData, request.speed || 1.0)
              .then(() => sendResponse({ success: true }))
              .catch(err => sendResponse({ error: err.message }));
          return true; // 保持消息通道打开
      }
  });

  // 改后
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'playAudio' && request.audioData) {
          playAudio(request.audioData, request.speed || 1.0)
              .then(() => sendResponse({ success: true }))
              .catch(err => sendResponse({ error: err.message }));
          return true; // 保持消息通道打开
      }
      if (request.action === 'stopAudio') {
          if (cancelCurrent) cancelCurrent();
          sendResponse({ success: true });
          return;
      }
  });
  ```

  行为说明：
  - 复用 `cancelCurrent()` 语义 — 调用 `audio.pause()` + resolve 正在 pending 的 `playAudio()` Promise
  - 如果 `cancelCurrent` 为 null（没有音频在播放）→ 无害 no-op → 返回 `{ success: true }`
  - 同步返回 — 不需要 `return true` 保持通道
  - `playAudio()` 的 Promise resolve 后 → `playAudioViaOffscreen` 的 `chrome.runtime.sendMessage` 也 resolve → 上层不再悬挂

##### B2. Background tts.js 新增 `stopAudioViaOffscreen`

- [x] `background/modules/tts.js` — 在 `playAudioViaOffscreen` 之后新增 `stopAudioViaOffscreen`（当前 line 40-43 之后）：
  ```javascript
  // 在 line 43 后新增
  export async function stopAudioViaOffscreen() {
      const offscreenUrl = chrome.runtime.getURL('offscreen/offscreen.html');
      const existingContexts = await chrome.runtime.getContexts({
          contextTypes: ['OFFSCREEN_DOCUMENT'],
          documentUrls: [offscreenUrl]
      });
      if (existingContexts.length === 0) {
          return { success: true };
      }
      return chrome.runtime.sendMessage({ action: 'stopAudio' });
  }
  ```

  行为说明：
  - **不调用 `ensureOffscreenDocument()`** — Codex 明确要求 stop 不创建 offscreen
  - 先用 `chrome.runtime.getContexts` 检查 offscreen 是否存在
  - 如果不存在 → no-op `{ success: true }`（没有音频在播放，什么都不做）
  - 如果存在 → 转发 `{ action: 'stopAudio' }` 到 offscreen → 触发 B1 的 handler
  - `getContexts` 的检查逻辑与 `ensureOffscreenDocument` 的前 5 行完全一致（复用相同 URL 格式），但不包含创建逻辑

##### B3. Message-router 新增 `stopAudio` case

- [x] `background/modules/message-router.js` — 在 `playAudioOffscreen` case 之后新增 `stopAudio`（当前 line 24-25 之后）：
  ```javascript
  // 改前（line 24-25 之间插入）
  case 'playAudioOffscreen':
      return tts.playAudioViaOffscreen(request.audioData, request.speed);

  // 改后
  case 'playAudioOffscreen':
      return tts.playAudioViaOffscreen(request.audioData, request.speed);

  case 'stopAudio':
      return tts.stopAudioViaOffscreen();
  ```

  行为说明：
  - 路由到 `tts.stopAudioViaOffscreen()` — 完整的 background 中继链路
  - popup 的 `chrome.runtime.sendMessage({action: 'stopAudio'})` 和 content script 的 `ST.sendMessage({action: 'stopAudio'})` 都经过 message-router 到达 background
  - background 再决定是否转发到 offscreen

##### B4. Sidebar — fallback 前停止 offscreen 音频

- [x] `content/modules/sidebar.js` — `speak` 函数 catch 块中 fallback 前发 stopAudio（当前 line 178-181）：
  ```javascript
  // 改前（line 178-181）
  } catch (err) {
      console.error('[TTS] 朗读失败:', err);
      return speakSystem(text, lang, speed);
  }

  // 改后
  } catch (err) {
      console.error('[TTS] 朗读失败:', err);
      ST.sendMessage({ action: 'stopAudio' }).catch(() => {});
      return speakSystem(text, lang, speed);
  }
  ```

  行为说明：
  - Fire-and-forget — `catch(() => {})` 防止 service worker 不可用时报错
  - 不 await — 不阻塞 system TTS fallback
  - 如果远程 TTS 还没走到 offscreen 播放就失败了（例如 ttsOpenAI 超时），offscreen 没有在播放 → `cancelCurrent` 为 null → no-op
  - 如果 playAudioOffscreen 超时（音频正在播放），stopAudio 会调用 `cancelCurrent()` → 停止旧音频 → 然后 system TTS 开始 → 不会双重播放

##### B5. Float-window — fallback 前停止 offscreen 音频

- [x] `content/modules/float-window.js` — `speak` 函数 catch 块中 fallback 前发 stopAudio（当前 line 150-152）：
  ```javascript
  // 改前（line 150-152）
  } catch (err) {
      console.error('[TTS] 朗读失败:', err);
  }
  // 回退到系统语音

  // 改后
  } catch (err) {
      console.error('[TTS] 朗读失败:', err);
      ST.sendMessage({ action: 'stopAudio' }).catch(() => {});
  }
  // 回退到系统语音
  ```

  行为说明：与 sidebar 完全一致。

##### B6. Popup — fallback 前停止 offscreen 音频

- [x] `popup/popup.js` — `speak` 函数 catch 块中 fallback 前发 stopAudio（当前 line 470-472）：
  ```javascript
  // 改前（line 470-472）
  } catch (error) {
      console.warn(`Popup TTS provider "${provider}" failed, falling back to system speech.`, error);
  }

  // 改后
  } catch (error) {
      console.warn(`Popup TTS provider "${provider}" failed, falling back to system speech.`, error);
      chrome.runtime.sendMessage({ action: 'stopAudio' }).catch(() => {});
  }
  ```

  行为说明：
  - Popup 使用 `chrome.runtime.sendMessage` 而非 `ST.sendMessage`（popup 不在 content script 中）
  - Fire-and-forget — 与 sidebar/float-window 一致
  - 这修复了 059-B 引入的双重播放问题：超时后先停 offscreen，再开 system TTS

**不要做的事**：
- 不要在 `stopAudioViaOffscreen` 中调用 `ensureOffscreenDocument()` — Codex 明确禁止
- 不要让 popup/content script 直接发 `stopAudio` 到 offscreen — 必须经 background 中继
- 不要在 `speak` 函数入口调用 `stopAudio` — 只在 fallback 前调用
- 不要 await `stopAudio` 的结果 — fire-and-forget
- 不要给 `stopAudio` 加超时 — 它本身是快速本地操作
- 不要改 offscreen.js 的 `playAudio` 函数 — `cancelCurrent` 语义已正确
- 不要改 `ensureOffscreenDocument` — 它仍是 `playAudioViaOffscreen` 使用的正确实现
- 不要碰 system TTS 的 `speechSynthesis.cancel()` — 已存在于 system TTS 路径中
- 不要碰 options.js — 044 已处理
- 不要碰 content.js、selection.js、immersive.js、floating-ball.js、ad-blocker.js、utils.js、storage.js、translator.js、service-worker.js、manifest.json、menus.js

## 不做的事

- **不做** system TTS `onend` 不触发超时 — 与 056/058/059 一致，留后续单列
- **不做** `runSpeak` 级别固定超时 — 045/046/058 反复驳回
- **不做** AbortController / fetch 层超时 — 058 明确不碰 background 和 translator 层
- **不做** TTS 多次点击去重 / 用户取消按钮 — 046-B2 留后续
- **不碰** popup.js 的现有 `withTimeout` — 059-B 已实现
- **不碰** options.js 的 `withTimeout` — 044 已实现

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check offscreen/offscreen.js` 通过
- [x] `node --check background/modules/tts.js` 通过
- [x] `node --check background/modules/message-router.js` 通过
- [x] `node --check content/modules/sidebar.js` 通过
- [x] `node --check content/modules/float-window.js` 通过
- [x] `node --check popup/popup.js` 通过
- [x] `git diff --check` 无输出
