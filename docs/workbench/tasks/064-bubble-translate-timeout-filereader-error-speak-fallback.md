---
status: done
priority: P2
created: 2026-03-14
---

# 064 — 划词气泡翻译无超时 & tts.js FileReader 错误丢失 & sidebar speakOpenAI 不回退

- 来源讨论: [discussions/064-bubble-translate-timeout-filereader-error-speak-fallback.md](../discussions/064-bubble-translate-timeout-filereader-error-speak-fallback.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/064-bubble-translate-timeout-filereader-error-speak-fallback.md](../discussions/064-bubble-translate-timeout-filereader-error-speak-fallback.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/selection.js` | A：`showBubble` 翻译调用加 30000ms timeout |
| `background/modules/tts.js` | B：两处 FileReader 改用 `onload` + `onerror` |
| `content/modules/sidebar.js` | C：`speakOpenAI` 失败时回退 `speakSystem` 而非 throw |
| `tests/064-bubble-translate-timeout-filereader-error-speak-fallback.test.mjs` | 回归测试 |

## 任务清单

### 必做

#### A. 划词气泡翻译调用加 30000ms 超时

- [x] `content/modules/selection.js:170-175` — 给 `showBubble` 内的 translate 调用加 timeout：
  ```javascript
  // 改前（line 170-175）
  const response = await ST.sendMessage({
      action: 'translate',
      text: text,
      from: sourceLang,
      to: targetLang
  });

  // 改后
  const response = await ST.sendMessage({
      action: 'translate',
      text: text,
      from: sourceLang,
      to: targetLang
  }, 30000, '翻译请求超时');
  ```

  行为说明：
  - **正常情况**：与之前完全相同（30s 内翻译完成 → 显示结果）
  - **超时后**：`catch` 捕获 → `renderBubbleMessage(resultDiv, '请求失败: 翻译请求超时', true)` → 用户看到错误文字代替永久加载动画
  - 与 sidebar（30000ms）和 float-window（30000ms）保持一致

#### B. tts.js FileReader 改用 `onload` + `onerror`

- [x] `background/modules/tts.js:91-95` — GLM 路径：
  ```javascript
  // 改前（line 91-95）
  const reader = new FileReader();
  const audioData = await new Promise((resolve) => {
      reader.onloadend = () => resolve(reader.result); // data:audio/wav;base64,...
      reader.readAsDataURL(audioBlob);
  });

  // 改后
  const reader = new FileReader();
  const audioData = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
      reader.readAsDataURL(audioBlob);
  });
  ```

- [x] `background/modules/tts.js:128-132` — OpenAI 路径：
  ```javascript
  // 改前（line 128-132）
  const reader = new FileReader();
  const audioData = await new Promise((resolve) => {
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(audioBlob);
  });

  // 改后
  const reader = new FileReader();
  const audioData = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
      reader.readAsDataURL(audioBlob);
  });
  ```

  行为说明：
  - **正常情况**（读取成功）：`onload` 触发 → `resolve(reader.result)` → 与之前完全相同
  - **读取失败**：`onerror` 触发 → `reject(reader.error)` → 外层 `catch` 捕获 → 返回 `{ error: err.message }` → 调用方收到 `response.error` 而非 null audioData
  - 不碰 `onabort` — 当前代码无处调用 `reader.abort()`，Codex 明确排除

#### C. sidebar `speakOpenAI` 失败时回退系统 TTS

- [x] `content/modules/sidebar.js:210-214` — 将 throw 改为回退：
  ```javascript
  // 改前（line 210-214）
  if (response?.audioData) {
      await playAudioFromDataUrl(response.audioData);
  } else {
      throw new Error(response?.error || 'OpenAI TTS failed');
  }

  // 改后
  if (response?.audioData) {
      await playAudioFromDataUrl(response.audioData);
  } else {
      if (response?.error) console.warn('[TTS] OpenAI 返回错误:', response.error);
      return speakSystem(text, lang, settings.ttsSpeed || 1.0);
  }
  ```

  行为说明：
  - **正常情况**（audioData 存在）：与之前完全相同
  - **失败情况**（audioData 为空或 error）：从抛异常改为回退系统 TTS，与同文件 `speakGoogle`（line 237）、`speakGLM`（line 260）保持一致
  - 可选 `console.warn` 保留诊断信息，不影响用户体验
  - 不碰 popup.js、float-window.js — 那两边已经会回退

#### D. 回归测试

- [x] 新建 `tests/064-bubble-translate-timeout-filereader-error-speak-fallback.test.mjs`，至少覆盖：
  1. **A — bubble translate 有 timeout**：selection.js 的 `showBubble` 中 `ST.sendMessage` 调用带 `30000` timeout 参数
  2. **B — FileReader 使用 onload + onerror**：tts.js 两处 FileReader Promise 使用 `reader.onload`（非 `onloadend`）且包含 `reader.onerror` reject 处理
  3. **C — speakOpenAI 回退**：sidebar.js 的 `speakOpenAI` 在 audioData 为空时调用 `speakSystem` 而非 `throw`

**不要做的事**：
- 不要给 bubble 加额外的 UI 恢复逻辑 — catch 已经能正确渲染错误消息
- 不要碰 `onabort` — Codex 明确排除
- 不要改 popup.js 或 float-window.js 的 TTS 路径 — 它们已经正确回退
- 不要改 Google TTS 路径（tts.js `handleTTSGoogle`）— 不使用 FileReader
- 不要碰 content.js、utils.js、immersive.js、options.js、service-worker.js、message-router.js、offscreen.js、ad-blocker.js、floating-ball.js、storage.js、translator.js、manifest.json、menus.js、options-ui-state.js、float-window.js、popup.js

## 不做的事

- **不做** bubble 更短的超时（15s）— Codex 指定 30000ms，与 sidebar/float-window 统一
- **不做** `onabort` 处理 — Codex 明确排除，当前代码无 `reader.abort()` 调用
- **不做** popup/float-window TTS 路径修改 — 它们已正确回退

## 验证要求

- [x] `node --test tests/064-bubble-translate-timeout-filereader-error-speak-fallback.test.mjs` 通过
- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check content/modules/selection.js` 通过
- [x] `node --check background/modules/tts.js` 通过
- [x] `node --check content/modules/sidebar.js` 通过
- [x] `git diff --check` 无输出
