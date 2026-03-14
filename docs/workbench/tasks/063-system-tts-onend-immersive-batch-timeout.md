---
status: done
priority: P2
created: 2026-03-14
---

# 063 — System TTS onend 不触发 → 按钮永久禁用 & 沉浸式 translateBatch 无超时

- 来源讨论: [discussions/063-system-tts-onend-immersive-batch-timeout.md](../discussions/063-system-tts-onend-immersive-batch-timeout.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/063-system-tts-onend-immersive-batch-timeout.md](../discussions/063-system-tts-onend-immersive-batch-timeout.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/utils.js` | A：新增 `ST.speakSystemWithGuard` helper |
| `content/modules/sidebar.js` | A：`speakSystem` 改用 `ST.speakSystemWithGuard` |
| `content/modules/float-window.js` | A：system TTS 路径改用 `ST.speakSystemWithGuard` |
| `popup/popup.js` | A：system TTS 路径加本地 `speakWithGuard` helper |
| `content/modules/immersive.js` | B：两处 `translateBatch` 加 60000ms timeout |
| `tests/063-system-tts-onend-immersive-batch-timeout.test.mjs` | 回归测试 |

## 任务清单

### 必做

#### A. System TTS `speakSystemWithGuard` — Chromium onend workaround

##### A1. utils.js 新增 `ST.speakSystemWithGuard`

- [x] `content/modules/utils.js` — 在文件末尾（`console.log` 之前）新增 helper：
  ```javascript
  /**
   * System TTS with Chromium onend bug workaround.
   * Uses speechSynthesis.speaking polling as fallback when onend doesn't fire.
   */
  ST.speakSystemWithGuard = function (text, lang, speed) {
      return new Promise((resolve, reject) => {
          const langMap = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP', ko: 'ko-KR' };
          const resolvedLang = !lang || lang === 'auto' ? ST.detectLanguage(text) : lang;
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = speed;
          utterance.lang = langMap[resolvedLang] || resolvedLang;

          let settled = false;
          let hasStarted = false;

          const settle = (fn) => {
              if (settled) return;
              settled = true;
              clearInterval(pollId);
              fn();
          };

          utterance.onstart = () => { hasStarted = true; };
          utterance.onend = () => settle(resolve);
          utterance.onerror = (event) => settle(() => reject(new Error(event.error || '朗读失败')));

          // Chromium workaround: poll speechSynthesis.speaking as fallback
          const pollId = setInterval(() => {
              if (hasStarted && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
                  settle(resolve);
              }
          }, 500);

          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
      });
  };
  ```

  行为说明：
  - **正常情况**（`onend` 触发）：`onend` → `settle(resolve)` → `clearInterval` → 与之前完全相同
  - **Chromium bug**（`onend` 不触发）：`onstart` 设 `hasStarted = true` → 播放结束后 `speaking` 变 false → 轮询检测到 `hasStarted && !speaking && !pending` → `settle(resolve)` → 按钮恢复
  - **错误**（`onerror` 触发）：`onerror` → `settle(reject)` → `clearInterval` → 与之前相同
  - **关键守卫**：`hasStarted` 防止 `cancel()` → `speak()` 之间的短暂窗口触发 premature resolve
  - `settled` 标志防止 `onend` 和轮询同时触发导致 double resolve
  - 轮询间隔 500ms，低开销

##### A2. sidebar.js 改用 `ST.speakSystemWithGuard`

- [x] `content/modules/sidebar.js` — 将 `speakSystem` 函数体替换：
  ```javascript
  // 改前（约 line 185-196）
  const speakSystem = (text, lang, speed) => {
      return new Promise((resolve, reject) => {
          const langMap = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP', ko: 'ko-KR' };
          const resolvedLang = !lang || lang === 'auto' ? ST.detectLanguage(text) : lang;
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = speed;
          utterance.lang = langMap[resolvedLang] || resolvedLang;
          utterance.onend = () => resolve();
          utterance.onerror = (event) => reject(new Error(event.error || '朗读失败'));
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
      });
  };

  // 改后
  const speakSystem = (text, lang, speed) => ST.speakSystemWithGuard(text, lang, speed);
  ```

##### A3. float-window.js 改用 `ST.speakSystemWithGuard`

- [x] `content/modules/float-window.js` — 将 system TTS 内联 Promise 替换：
  ```javascript
  // 改前（约 line 155-164）
  const langMap = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP', ko: 'ko-KR' };
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = speed;
  utterance.lang = langMap[resolvedLang] || resolvedLang;
  await new Promise((resolve, reject) => {
      utterance.onend = () => resolve();
      utterance.onerror = (event) => reject(new Error(event.error || '朗读失败'));
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
  });

  // 改后
  await ST.speakSystemWithGuard(text, resolvedLang, speed);
  ```

  注意：float-window 的 `resolvedLang` 已经在上方计算好了，直接传给 helper。`ST.speakSystemWithGuard` 内部会做 `langMap` 映射，所以传原始 lang code 即可。检查 `resolvedLang` 的值格式是否和 helper 兼容。

##### A4. popup.js 本地 `speakWithGuard` helper

- [x] `popup/popup.js` — 在 `speak` 函数之前新增本地 helper，然后修改 system TTS 路径：
  ```javascript
  // 新增 helper（popup.js 内部，speak 函数之前）
  function speakWithGuard(text, lang, speed) {
      return new Promise((resolve, reject) => {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = speed;
          utterance.lang = lang;

          let settled = false;
          let hasStarted = false;

          const settle = (fn) => {
              if (settled) return;
              settled = true;
              clearInterval(pollId);
              fn();
          };

          utterance.onstart = () => { hasStarted = true; };
          utterance.onend = () => settle(resolve);
          utterance.onerror = (event) => settle(() => reject(new Error(event.error || '朗读失败')));

          const pollId = setInterval(() => {
              if (hasStarted && !speechSynthesis.speaking && !speechSynthesis.pending) {
                  settle(resolve);
              }
          }, 500);

          speechSynthesis.cancel();
          speechSynthesis.speak(utterance);
      });
  }
  ```

  然后修改 `speak` 函数的 system TTS 路径：
  ```javascript
  // 改前（约 line 482-490）
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = speed;
  utterance.lang = langMap[lang] || lang;
  await new Promise((resolve, reject) => {
      utterance.onend = () => resolve();
      utterance.onerror = (event) => reject(new Error(event.error || '朗读失败'));
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
  });

  // 改后
  await speakWithGuard(text, langMap[lang] || lang, speed);
  ```

  popup 的 `speakWithGuard` 和 `ST.speakSystemWithGuard` 逻辑相同，但：
  - 不通过 `ST.*` 访问（popup 不在 content script 加载链中）
  - 不做 `langMap` 映射（popup 调用方已经映射了）
  - 不做 `detectLanguage`（popup 调用方已传具体 lang）

#### B. 沉浸式 `translateBatch` 加 60000ms 超时

- [x] `content/modules/immersive.js:109-113` — 初始 batch loop，加 timeout：
  ```javascript
  // 改前
  const response = await ST.sendMessage({
      action: 'translateBatch',
      texts: texts,
      to: targetLang
  });

  // 改后
  const response = await ST.sendMessage({
      action: 'translateBatch',
      texts: texts,
      to: targetLang
  }, 60000, '批量翻译超时');
  ```

- [x] `content/modules/immersive.js:268-272` — observer 回调，同样加 timeout：
  ```javascript
  // 改前
  const response = await ST.sendMessage({
      action: 'translateBatch',
      texts: texts,
      to: targetLang
  });

  // 改后
  const response = await ST.sendMessage({
      action: 'translateBatch',
      texts: texts,
      to: targetLang
  }, 60000, '批量翻译超时');
  ```

  行为说明：
  - 超时前：与之前完全相同
  - 超时后：`catch` 块捕获 → `errorCount += batch.length`（初始 loop）或 `console.error`（observer）→ 循环继续
  - 两条路径统一 60000ms，避免行为分叉
  - 60000ms 比 translate 的 30000ms 更宽，因为 translateBatch 可能走 `translateBatchIndividually` 逐条串行

#### C. 回归测试

- [x] 新建 `tests/063-system-tts-onend-immersive-batch-timeout.test.mjs`，至少覆盖：
  1. **A — `ST.speakSystemWithGuard` 存在性**：utils.js 源码导出了 `ST.speakSystemWithGuard` 函数
  2. **A — `hasStarted` 守卫**：helper 源码包含 `hasStarted` 守卫逻辑（`onstart` 设标志 + 轮询检查 `hasStarted`）
  3. **A — sidebar 改用 helper**：sidebar.js 的 `speakSystem` 调用了 `ST.speakSystemWithGuard`
  4. **A — float-window 改用 helper**：float-window.js system TTS 路径调用了 `ST.speakSystemWithGuard`
  5. **A — popup 本地 helper**：popup.js 包含 `speakWithGuard` 函数且有 `hasStarted` 守卫
  6. **B — translateBatch timeout**：immersive.js 两处 `translateBatch` 调用都带 60000ms timeout 参数

**不要做的事**：
- 不要给 `runSpeak` 或整个 `speak` 函数加固定超时 — Codex 在 058/060 明确驳回
- 不要改 `runSpeak` 函数本身
- 不要改 API TTS 路径（`speakOpenAI`/`speakGoogle`/`speakGLM`）— 060 已正确处理
- 不要改 `ST.sendMessage` 本身
- 不要碰 content.js、service-worker.js、message-router.js、tts.js、offscreen.js、selection.js、floating-ball.js、ad-blocker.js、storage.js、translator.js、manifest.json、menus.js、options.js、options-ui-state.js

## 不做的事

- **不做** `runSpeak` 级别固定超时 — Codex 在 058/060 明确驳回
- **不做** system TTS 硬超时（30s/300s）— 轮询方案不需要
- **不做** `translateBatch` 30000ms — Codex 指定 60000ms

## 验证要求

- [x] `node --test tests/063-system-tts-onend-immersive-batch-timeout.test.mjs` 通过
- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check content/modules/utils.js` 通过
- [x] `node --check content/modules/sidebar.js` 通过
- [x] `node --check content/modules/float-window.js` 通过
- [x] `node --check popup/popup.js` 通过
- [x] `node --check content/modules/immersive.js` 通过
- [x] `git diff --check` 无输出
