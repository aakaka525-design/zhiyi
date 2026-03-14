---
status: done
priority: P1
created: 2026-03-13
---

# 056 — 深色模式硬编码背景迁移 & 系统 TTS 朗读按钮 Promise 化

- 来源讨论: [discussions/056-darkmode-hardcode-tts-speak-guard.md](../discussions/056-darkmode-hardcode-tts-speak-guard.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/056-darkmode-hardcode-tts-speak-guard.md](../discussions/056-darkmode-hardcode-tts-speak-guard.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/content.css` | A：新增 `--surface-ball` token + 迁移 5 个背景 + 3 个边框到 CSS 变量 |
| `content/modules/sidebar.js` | B：`speakSystem` 返回 Promise + 7 处调用加 `return` |
| `content/modules/float-window.js` | B：内联系统 TTS 路径用 `await new Promise(...)` 包装 |
| `popup/popup.js` | B：内联系统 TTS 路径用 `await new Promise(...)` 包装 |
| `tests/darkmode-hardcode-tts-speak-guard.test.mjs` | A + B |

## 任务清单

### 必做

#### A. 深色模式硬编码背景/边框迁移

055 建立了 CSS 变量系统（`:root[data-st-theme="dark"]` 覆盖），但主容器的 `background` 和 `border` 仍用硬编码浅色值，深色模式下不变色。

- [x] `content/content.css` — 在浅色变量块（line 17-29）中，`--error: #E57373;` 之前，新增 `--surface-ball`：
  ```css
  /* 改前（line 27-28）*/
  --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  --error: #E57373;

  /* 改后 */
  --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  --surface-ball: rgba(255, 255, 255, 0.6);
  --error: #E57373;
  ```

- [x] `content/content.css` — 在深色变量块（line 41-52）中，`--error: #EF9A9A;` 之前，新增 `--surface-ball`：
  ```css
  /* 改前（line 51-52）*/
  --border-color: rgba(255, 255, 255, 0.08);
  --error: #EF9A9A;

  /* 改后 */
  --border-color: rgba(255, 255, 255, 0.08);
  --surface-ball: rgba(30, 34, 43, 0.6);
  --error: #EF9A9A;
  ```

  行为说明：
  - `--surface-ball` 浅色 `rgba(255, 255, 255, 0.6)` — 与当前悬浮球硬编码值一致，无视觉变化
  - `--surface-ball` 深色 `rgba(30, 34, 43, 0.6)` — 取深色 `--surface` 的 RGB（`30, 34, 43`）+ 悬浮球的透明度（`0.6`）
  - 悬浮球保持半透明轻盈效果，不与 `--surface`（`0.95`）共用

- [x] `content/content.css` — 替换 `#smart-translator-bubble` 背景（当前 line 77）：
  ```css
  /* 改前（line 77-78）*/
  background: rgba(249, 249, 249, 0.95);
  /* 暖白背景 #F9F9F9 */

  /* 改后 */
  background: var(--surface);
  ```

  行为说明：
  - 删除旧注释 `/* 暖白背景 #F9F9F9 */` — 不再适用
  - 浅色差异：`rgba(249,249,249,0.95)` → `rgba(255,255,255,0.95)` — 2% 亮度差，不可感知

- [x] `content/content.css` — 替换 `#st-sidebar` 背景和边框（当前 line 263, 267）：
  ```css
  /* 改前（line 263-264）*/
  background: rgba(249, 249, 249, 0.98);
  /* 暖白 */

  /* 改后 */
  background: var(--surface);
  ```
  ```css
  /* 改前（line 267）*/
  border-left: 1px solid rgba(0, 0, 0, 0.05);

  /* 改后 */
  border-left: 1px solid var(--border-color);
  ```

  行为说明：
  - 删除旧注释 `/* 暖白 */`
  - `--border-color` 浅色值 `rgba(0, 0, 0, 0.05)` 与硬编码值完全一致 → 浅色无变化

- [x] `content/content.css` — 替换 `.st-sidebar-search` 边框（当前 line 314）：
  ```css
  /* 改前（line 314）*/
  border: 1px solid rgba(0, 0, 0, 0.03);

  /* 改后 */
  border: 1px solid var(--border-color);
  ```

  行为说明：
  - 浅色差异：`0.03` 透明度 → `0.05` — 搜索框边框略微深一点，极微小差异

- [x] `content/content.css` — 替换 `#st-float-window` 背景和边框（当前 line 361-362）：
  ```css
  /* 改前（line 361）*/
  background: rgba(255, 255, 255, 0.95);

  /* 改后 */
  background: var(--surface);
  ```
  ```css
  /* 改前（line 362）*/
  border: 1px solid rgba(0, 0, 0, 0.05);

  /* 改后 */
  border: 1px solid var(--border-color);
  ```

- [x] `content/content.css` — 替换 `.st-float-header` 背景（当前 line 374）：
  ```css
  /* 改前（line 374）*/
  background: #F9F9F9;

  /* 改后 */
  background: var(--bg-secondary);
  ```

- [x] `content/content.css` — 替换 `#st-sidebar-toggle-btn` 背景（当前 line 434）：
  ```css
  /* 改前（line 434）*/
  background: rgba(253, 252, 248, 0.95);

  /* 改后 */
  background: var(--surface);
  ```

- [x] `content/content.css` — 替换 `#st-floating-ball` 背景（当前 line 752）：
  ```css
  /* 改前（line 752-753）*/
  background: rgba(255, 255, 255, 0.6);
  /* 半透明静止态 */

  /* 改后 */
  background: var(--surface-ball);
  ```

  行为说明：
  - 删除旧注释 `/* 半透明静止态 */`
  - 使用 `--surface-ball` 而非 `--surface` — 保持 `0.6` 透明度

**不要做的事**：
- 不要改 `--surface` 的值 — 浅色 `rgba(255, 255, 255, 0.95)` 和深色 `rgba(30, 34, 43, 0.95)` 正确
- 不要改 `--bg-secondary`、`--border-color` 的值 — 浅色和深色值都正确
- 不要改深色/浅色变量块中已有的其他变量
- 不要改 `backdrop-filter`、`box-shadow` — 本轮只迁移 `background` 和 `border`
- 不要改已经使用 `var(--surface)` / `var(--bg-secondary)` 的元素（如 `.st-bubble-text`、`.st-sidebar-result-card` 等）
- 不要改 `content.js` — `applyContentTheme()` 和 `data-st-theme` 切换逻辑不受影响
- 不要改 `options/theme.css` — popup/options 深色模式不受影响

### 必做

#### B. 系统 TTS 朗读按钮 Promise 化

`speechSynthesis.speak()` 同步返回，`runSpeak` 的 `finally { btn.disabled = false }` 在语音播放中就已执行。需要把系统 TTS 路径包装为 Promise，在 `utterance.onend` / `utterance.onerror` 时 resolve/reject。

- [x] `content/modules/sidebar.js` — 将 `speakSystem` 改为返回 Promise（当前 line 172-180）：
  ```javascript
  // 改前（line 172-180）
  const speakSystem = (text, lang, speed) => {
      const langMap = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP', ko: 'ko-KR' };
      const resolvedLang = !lang || lang === 'auto' ? ST.detectLanguage(text) : lang;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = speed;
      utterance.lang = langMap[resolvedLang] || resolvedLang;
      window.speechSynthesis.speak(utterance);
  };

  // 改后
  const speakSystem = (text, lang, speed) => {
      return new Promise((resolve, reject) => {
          const langMap = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP', ko: 'ko-KR' };
          const resolvedLang = !lang || lang === 'auto' ? ST.detectLanguage(text) : lang;
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = speed;
          utterance.lang = langMap[resolvedLang] || resolvedLang;
          utterance.onend = () => resolve();
          utterance.onerror = (e) => reject(new Error(e.error || '朗读失败'));
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
      });
  };
  ```

  行为说明：
  - `utterance.onend` → 语音播放完成 → resolve → `runSpeak` 的 `finally` 恢复按钮
  - `utterance.onerror` → 语音出错 → reject → `runSpeak` 的 `catch` 记录错误 → `finally` 恢复按钮
  - `speechSynthesis.cancel()` 放在 `speak()` 之前 — 保持原有顺序（先取消旧朗读再开新的）
  - 不加超时 — 本轮最小修复，后续根据手测再决定

- [x] `content/modules/sidebar.js` — 全部 7 处 `speakSystem()` 调用加 `return`：

  **调用点 1 — `speak()` default 分支（当前 line 164）**：
  ```javascript
  // 改前
  default:
      speakSystem(text, lang, speed);

  // 改后
  default:
      return speakSystem(text, lang, speed);
  ```

  **调用点 2 — `speak()` catch 回退（当前 line 168）**：
  ```javascript
  // 改前
  } catch (err) {
      console.error('[TTS] 朗读失败:', err);
      speakSystem(text, lang, speed);
  }

  // 改后
  } catch (err) {
      console.error('[TTS] 朗读失败:', err);
      return speakSystem(text, lang, speed);
  }
  ```

  **调用点 3 — `speakOpenAI()` 缺 key（当前 line 194）**：
  ```javascript
  // 改前
  if (!apiKey) { speakSystem(text, lang, settings.ttsSpeed || 1.0); return; }

  // 改后
  if (!apiKey) { return speakSystem(text, lang, settings.ttsSpeed || 1.0); }
  ```

  **调用点 4 — `speakGoogle()` 缺 key（当前 line 215-216）**：
  ```javascript
  // 改前
  if (!apiKey) {
      speakSystem(text, lang, settings.ttsSpeed || 1.0);
      return;
  }

  // 改后
  if (!apiKey) {
      return speakSystem(text, lang, settings.ttsSpeed || 1.0);
  }
  ```

  **调用点 5 — `speakGoogle()` 无 audioData（当前 line 233）**：
  ```javascript
  // 改前
  } else {
      speakSystem(text, lang, settings.ttsSpeed || 1.0);
  }

  // 改后
  } else {
      return speakSystem(text, lang, settings.ttsSpeed || 1.0);
  }
  ```

  **调用点 6 — `speakGLM()` 缺 key（当前 line 240）**：
  ```javascript
  // 改前
  if (!apiKey) {
      speakSystem(text, lang, settings.ttsSpeed || 1.0);
      return;
  }

  // 改后
  if (!apiKey) {
      return speakSystem(text, lang, settings.ttsSpeed || 1.0);
  }
  ```

  **调用点 7 — `speakGLM()` 无 audioData（当前 line 257）**：
  ```javascript
  // 改前
  } else {
      speakSystem(text, lang, settings.ttsSpeed || 1.0);
  }

  // 改后
  } else {
      return speakSystem(text, lang, settings.ttsSpeed || 1.0);
  }
  ```

  行为说明：
  - 统一用 `return speakSystem(...)` 而非 `await speakSystem(...)` — 所有调用点都是函数的终端位置，`return` 把 Promise 传给调用方的 `await`
  - `speak()` 本身是 `async`，返回 `speakSystem()` 的 Promise → `runSpeak` 的 `await fn()` 等待该 Promise → `finally` 在播放结束后执行
  - 调用点 1（`default`）：`return` 退出 `speak()` 函数，`try-catch` 后的代码不执行（实际也没有代码）
  - 调用点 2（`catch`）：API TTS 失败 → 回退到系统 TTS → `return` Promise → 按钮在系统语音播完后恢复
  - 调用点 3-7：Provider 缺 key 或无 audioData → 直接回退系统 TTS → `return` Promise

- [x] `content/modules/float-window.js` — 系统 TTS 回退路径包装为 Promise（当前 line 145-151）：
  ```javascript
  // 改前（line 145-151）
  // 回退到系统语音
  const langMap = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP', ko: 'ko-KR' };
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = speed;
  utterance.lang = langMap[resolvedLang] || resolvedLang;
  window.speechSynthesis.speak(utterance);

  // 改后
  // 回退到系统语音
  await new Promise((resolve, reject) => {
      const langMap = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP', ko: 'ko-KR' };
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = speed;
      utterance.lang = langMap[resolvedLang] || resolvedLang;
      utterance.onend = () => resolve();
      utterance.onerror = (e) => reject(new Error(e.error || '朗读失败'));
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
  });
  ```

  行为说明：
  - `speak()` 是 `async`（line 95），`await` 在此合法
  - `langMap` 移入 Promise 内部 — 保持作用域干净
  - `speechSynthesis.cancel()` 在 `speak()` 之前 — 保持原有顺序
  - 这是 float-window 唯一的系统 TTS 路径 — 其他 provider 缺 key 时 if 条件不匹配，自然落到此处

- [x] `popup/popup.js` — 系统 TTS 路径包装为 Promise（当前 line 456-460）：
  ```javascript
  // 改前（line 456-460）
  const utterance = new SpeechSynthesisUtterance(text);
  speechSynthesis.cancel();
  utterance.rate = speed;
  utterance.lang = langMap[lang] || lang;
  speechSynthesis.speak(utterance);

  // 改后
  await new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = speed;
      utterance.lang = langMap[lang] || lang;
      utterance.onend = () => resolve();
      utterance.onerror = (e) => reject(new Error(e.error || '朗读失败'));
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
  });
  ```

  行为说明：
  - `speak()` 是 `async function`（line 429），`await` 在此合法
  - `langMap` 保留在外部（line 450-455）— 不需要移入 Promise
  - `speechSynthesis.cancel()` 在 `speak()` 之前 — 保持原有顺序
  - 这是 popup 唯一的系统 TTS 路径 — API 成功时 line 444 `return`，不到此处

**不要做的事**：
- 不要加超时兜底 — 本轮不做，后续手测决定
- 不要改 `runSpeak` — 它的 `try/await/finally` 模式正确
- 不要改 API TTS 路径 — `speakOpenAI`/`speakGoogle`/`speakGLM` 的 API 调用和 `playAudioFromDataUrl` 已正确 `await`
- 不要改 `playAudioFromDataUrl` / `playAudio` — offscreen 播放已是 Promise
- 不要改 `requestTtsAudio` — popup 的 API 音频请求逻辑正确
- 不要改 offscreen.js — 播放逻辑正确
- 不要改 background/modules/tts.js — API 生成阶段逻辑正确

## 不做的事

- **不做** `--surface` / `--bg-secondary` / `--border-color` 值的修改 — 055 定义的值正确
- **不做** `backdrop-filter` / `box-shadow` 迁移 — 深色模式下阴影优化留后续
- **不做** `applyContentTheme()` 或 `data-st-theme` 逻辑改动 — 055 已正确
- **不做** `speechSynthesis.onend` 超时兜底 — 无本地复现证据，后续手测再决定
- **不做** `runSpeak` 改动 — try/await/finally 模式正确
- **不做** API TTS 路径改动 — 已正确 await
- **不碰** options.js、options.html、popup.html、service-worker.js、message-router.js、tts.js、offscreen.js、storage.js、translator.js、manifest.json、content.js、selection.js、immersive.js、ad-blocker.js、floating-ball.js、utils.js、menus.js

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check content/modules/sidebar.js` 通过
- [x] `node --check content/modules/float-window.js` 通过
- [x] `node --check popup/popup.js` 通过
- [x] `git diff --check` 无输出
