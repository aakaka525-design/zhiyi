---
status: done
priority: P2
created: 2026-03-13
---

# 044 — 沉浸式取消残留分隔符 & Observer 回调竞态 & 设置页测试无超时

- 来源讨论: [discussions/044-immersive-separator-leak-observer-race-test-timeout.md](../discussions/044-immersive-separator-leak-observer-race-test-timeout.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/044-immersive-separator-leak-observer-race-test-timeout.md](../discussions/044-immersive-separator-leak-observer-race-test-timeout.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | A：取消选择器加 `.st-translation-separator`；B：observer callback 加 `immersiveRunId` 守卫 |
| `options/options.js` | C：API 测试加 AbortController 超时，TTS 测试加 withTimeout |
| `tests/immersive-observer-test-timeout.test.mjs` | A + B + C |

## 任务清单

### 必做

#### A. 取消选择器补 `.st-translation-separator`

取消沉浸式翻译后，inline 路径创建的 `.st-translation-separator`（" → " 分隔符）残留在原始元素中。取消→重开会累积多个分隔符。

- [x] `content/modules/immersive.js` — 取消路径（当前 line 14），selector 加上 `.st-translation-separator`：
  ```javascript
  // 改前（line 14）
  document.querySelectorAll('.st-immersive-translation, .st-immersive-wrapper').forEach(el => el.remove());

  // 改后
  document.querySelectorAll('.st-immersive-translation, .st-immersive-wrapper, .st-translation-separator').forEach(el => el.remove());
  ```

**不要做的事**：
- 不要改 inline 注入路径（line 173-186）的逻辑 — 只改取消路径的选择器
- 不要改 block 注入路径（line 187-200）
- 不要改 `injectTranslation` 的重复注入守卫（line 162-164）

### 必做

#### B. Observer callback 加 `immersiveRunId` 守卫

MutationObserver 回调只在入口检查 `isImmersiveEnabled`，`await` 后无守卫。cancel→reopen 竞态下，旧回调可能注入错误语言的翻译结果。

**不能只检查 `isImmersiveEnabled`** — 与 043-A 同一竞态模式。必须复用 `immersiveRunId`。

- [x] `content/modules/immersive.js` — `startMutationObserver()` 函数入口（当前 line 206-207），capture `observerRunId`：
  ```javascript
  // 改前（line 206-207）
  ST.startMutationObserver = function () {
      if (ST.observers.mutation) return;

  // 改后
  ST.startMutationObserver = function () {
      if (ST.observers.mutation) return;
      const observerRunId = ST.state.immersiveRunId;
  ```

- [x] `content/modules/immersive.js` — observer callback 入口守卫（当前 line 213-216），加 `immersiveRunId` 校验：
  ```javascript
  // 改前（line 213-216）
  if (!ST.state.isImmersiveEnabled) {
      ST.stopMutationObserver();
      return;
  }

  // 改后
  if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== observerRunId) {
      ST.stopMutationObserver();
      return;
  }
  ```

- [x] `content/modules/immersive.js` — observer callback `await` 后（当前 line 267，在 `if (response && response.results)` 之前），加守卫：
  ```javascript
  // 改前（line 260-267）
  try {
      const response = await ST.sendMessage({
          action: 'translateBatch',
          texts: texts,
          to: targetLang
      });

      if (response && response.results) {

  // 改后
  try {
      const response = await ST.sendMessage({
          action: 'translateBatch',
          texts: texts,
          to: targetLang
      });

      if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== observerRunId) return;

      if (response && response.results) {
  ```

  覆盖矩阵（与 043 batch loop 对称）：

  | 场景 | 入口守卫 | await 后守卫 | 结果 |
  |------|----------|-------------|------|
  | 仅取消 | `!isImmersiveEnabled` → stop + return | `!isImmersiveEnabled` → return | 正确 |
  | 取消+重开，回调及时看到 false | `!isImmersiveEnabled` → stop + return | — | 正确 |
  | 取消+重开，回调在 await 中没看到 false | 入口已通过 | `runId !== observerRunId` → return | 正确 |

**不要做的事**：
- 不要只检查 `isImmersiveEnabled` — cancel→reopen 竞态下会通过
- 不要改 `stopMutationObserver()` 的实现
- 不要改 observer 的 `observe()` 配置
- 不要改 `pendingTranslations` 的 finally 清理（line 277-278）— 无论是否跳过注入，都应该清理 pending
- 不要在 `finally` 块之前 return — return 应该在 `try` 块内，让 `finally` 正常执行

### 推荐

#### C. 设置页 API/TTS 测试超时保护

`testApiConnection()` 和 `testTTS()` 无超时，服务器不响应时按钮永久 loading。

**C1. 添加 `withTimeout` helper**

- [x] `options/options.js` — 在文件顶部（`import` 之后，`const elements` 之前），添加 helper：
  ```javascript
  function withTimeout(promise, ms, message = '请求超时') {
      return Promise.race([
          promise,
          new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
      ]);
  }
  ```

**C2. API 连通性测试加 AbortController**

- [x] `options/options.js` — `testApiConnection()` 函数（当前 line 206-296），在 try 块开头创建 AbortController，每个 fetch 加 `signal`，finally 里 clearTimeout：
  ```javascript
  // 改后结构
  async function testApiConnection(provider) {
      const btn = document.getElementById(`test-${provider}`);
      const statusEl = document.getElementById(`test-${provider}-status`);
      if (!btn || !statusEl) return;

      btn.classList.add('loading');
      btn.disabled = true;
      statusEl.textContent = '';
      statusEl.className = 'test-status';

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
          let success = false;
          let message = '';

          switch (provider) {
              case 'openai': {
                  const apiKey = elements.openaiApiKey.value.trim();
                  const baseUrl = elements.openaiBaseUrl.value.trim() || 'https://api.openai.com/v1';
                  if (!apiKey) throw new Error('请先填写 API Key');

                  const response = await fetch(`${baseUrl}/models`, {
                      method: 'GET',
                      headers: { 'Authorization': `Bearer ${apiKey}` },
                      signal: controller.signal,
                  });
                  if (response.ok) { success = true; message = '✓'; }
                  else throw new Error(`${response.status}`);
                  break;
              }
              case 'gemini': {
                  const apiKey = elements.geminiApiKey.value.trim();
                  if (!apiKey) throw new Error('请先填写 API Key');

                  const response = await fetch(
                      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
                      { signal: controller.signal },
                  );
                  if (response.ok) { success = true; message = '✓'; }
                  else throw new Error(`${response.status}`);
                  break;
              }
              case 'deepseek': {
                  const apiKey = elements.deepseekApiKey.value.trim();
                  const baseUrl = elements.deepseekBaseUrl.value.trim() || 'https://api.ppinfra.com/openai';
                  if (!apiKey) throw new Error('请先填写 API Key');

                  const response = await fetch(`${baseUrl}/models`, {
                      method: 'GET',
                      headers: { 'Authorization': `Bearer ${apiKey}` },
                      signal: controller.signal,
                  });
                  if (response.ok) { success = true; message = '✓'; }
                  else throw new Error(`${response.status}`);
                  break;
              }
          }

          statusEl.textContent = message;
          statusEl.classList.add('success');
      } catch (error) {
          if (error.name === 'AbortError') {
              statusEl.textContent = '✗ 连接超时';
          } else {
              statusEl.textContent = `✗ ${error.message}`;
          }
          statusEl.classList.add('error');
      } finally {
          clearTimeout(timeoutId);
          btn.classList.remove('loading');
          btn.disabled = false;
      }
  }
  ```

**C3. TTS 测试加 withTimeout**

- [x] `options/options.js` — `testTTS()` 函数（当前 line 299-340），对 `requestTtsTestAudio` 和 `sendMessage` 两段都加超时：
  ```javascript
  // 改前（line 322-332）
  const audioData = await requestTtsTestAudio(provider, testText, speed);
  statusEl.textContent = '✓ 已开始播放';
  statusEl.classList.add('success');
  const playbackResponse = await chrome.runtime.sendMessage({
      action: 'playAudioOffscreen',
      audioData,
      speed,
  });

  // 改后
  const audioData = await withTimeout(
      requestTtsTestAudio(provider, testText, speed),
      15000,
      'TTS 请求超时',
  );
  statusEl.textContent = '✓ 已开始播放';
  statusEl.classList.add('success');
  const playbackResponse = await withTimeout(
      chrome.runtime.sendMessage({ action: 'playAudioOffscreen', audioData, speed }),
      15000,
      '播放超时',
  );
  ```

**不要做的事**：
- 不要只给 playback 加超时，漏掉 `requestTtsTestAudio`
- 不要改 `requestTtsTestAudio()` 内部逻辑 — 只在调用处包超时
- 不要改 `playSystemTtsTest()` — 系统 TTS 是本地调用，不会挂住
- 不要改 `testApiConnection` 的 `success`/`message` 变量结构 — 保持现有的 switch 模式
- 不要给 AbortController 加到 `requestTtsTestAudio` 里 — sendMessage 不支持 signal，用 withTimeout 即可
- 不要改 `saveSettings()`、`loadSettings()`、`bindEvents()` 或其他无关函数

## 不做的事

- **不做** inline 注入路径改为 sibling 模式 — 只修取消路径选择器
- **不做** observer 的 `isImmersiveEnabled` 单独守卫 — 必须同时校验 `immersiveRunId`
- **不做** TTS 测试"取消"按钮 — withTimeout 超时已足够
- **不做** fetch 的重试逻辑 — 超时即失败，用户可手动重试
- **不碰** manifest、selection.js、sidebar.js、popup.js、popup.html、popup.css、float-window.js、floating-ball.js、ad-blocker.js、content.js、content.css、message-router.js、service-worker.js、menus.js、storage.js、translator.js、tts.js、options.html、options-ui-state.js

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check content/modules/immersive.js` 通过
- [x] `node --check options/options.js` 通过
- [x] `git diff --check` 无输出
