---
status: done
priority: P2
created: 2026-03-13
---

# 045 — 翻译中控件统一禁用 & 朗读按钮防重复播放

- 来源讨论: [discussions/045-translate-loading-aux-buttons-speak-no-guard.md](../discussions/045-translate-loading-aux-buttons-speak-no-guard.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/045-translate-loading-aux-buttons-speak-no-guard.md](../discussions/045-translate-loading-aux-buttons-speak-no-guard.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `popup/popup.js` | A1：`setLoading()` 补禁用 clear/paste/swap；B1：speak 按钮防重复 |
| `content/modules/sidebar.js` | A2：translateBtn.onclick 统一禁用整组控件；B2：两个 speak 按钮防重复 |
| `content/modules/float-window.js` | A3：translateBtn.onclick 统一禁用整组控件；B3：两个 speak 按钮防重复 |
| `tests/loading-disable-speak-guard.test.mjs` | A + B |

## 任务清单

### 必做

#### A. 翻译中控件统一禁用

翻译进行中，三个面板的辅助控件（清空/粘贴/互换/输入框/语言选择器）未禁用，用户可以修改输入状态导致翻译完成后 UI 不一致。

**A1. Popup — `setLoading()` 补三个按钮**

Popup 的 `setLoading()` 已正确禁用 `btnTranslate / sourceText / sourceLang / targetLang`，只需补 `btnClear / btnPaste / btnSwap`。

- [x] `popup/popup.js` — `setLoading()` 函数的 `if (loading)` 分支（当前 line 324-335），在现有 `elements.targetLang.disabled = true;` 之后加三行：
  ```javascript
  // 改前（line 329 之后直接是 btnTranslate.innerHTML）
  elements.targetLang.disabled = true;
  elements.btnTranslate.innerHTML = `...`;

  // 改后
  elements.targetLang.disabled = true;
  elements.btnClear.disabled = true;
  elements.btnPaste.disabled = true;
  elements.btnSwap.disabled = true;
  elements.btnTranslate.innerHTML = `...`;
  ```

- [x] `popup/popup.js` — `setLoading()` 函数的 `else` 分支（当前 line 337-348），在现有 `elements.targetLang.disabled = false;` 之后加三行：
  ```javascript
  // 改前（line 341 之后直接是 btnTranslate.innerHTML）
  elements.targetLang.disabled = false;
  elements.btnTranslate.innerHTML = `...`;

  // 改后
  elements.targetLang.disabled = false;
  elements.btnClear.disabled = false;
  elements.btnPaste.disabled = false;
  elements.btnSwap.disabled = false;
  elements.btnTranslate.innerHTML = `...`;
  ```

**A2. Sidebar — translateBtn.onclick 统一禁用整组控件**

Sidebar 翻译期间只禁用了 `translateBtn`。需要同时禁用 `input / sourceLangSelect / targetLangSelect / clearBtn / swapBtn`。

- [x] `content/modules/sidebar.js` — `translateBtn.onclick` 的 loading 开始段（当前 line 277-278），扩展禁用范围：
  ```javascript
  // 改前（line 277-278）
  translateBtn.innerText = '翻译中...';
  translateBtn.disabled = true;

  // 改后
  translateBtn.innerText = '翻译中...';
  translateBtn.disabled = true;
  input.disabled = true;
  sourceLangSelect.disabled = true;
  targetLangSelect.disabled = true;
  clearBtn.disabled = true;
  swapBtn.disabled = true;
  ```

- [x] `content/modules/sidebar.js` — `translateBtn.onclick` 的 finally 块（当前 line 314-317），扩展恢复范围：
  ```javascript
  // 改前（line 314-317）
  } finally {
      translateBtn.innerText = '翻译';
      translateBtn.disabled = false;
  }

  // 改后
  } finally {
      translateBtn.innerText = '翻译';
      translateBtn.disabled = false;
      input.disabled = false;
      sourceLangSelect.disabled = false;
      targetLangSelect.disabled = false;
      clearBtn.disabled = false;
      swapBtn.disabled = false;
  }
  ```

**A3. Float-window — translateBtn.onclick 统一禁用整组控件**

Float-window 翻译期间只禁用了 `translateBtn`。需要同时禁用 `input / targetLangSelect / clearBtn`。

- [x] `content/modules/float-window.js` — `translateBtn.onclick` 的 loading 开始段（当前 line 182-183），扩展禁用范围：
  ```javascript
  // 改前（line 182-183）
  translateBtn.innerText = '...';
  translateBtn.disabled = true;

  // 改后
  translateBtn.innerText = '...';
  translateBtn.disabled = true;
  input.disabled = true;
  targetLangSelect.disabled = true;
  clearBtn.disabled = true;
  ```

- [x] `content/modules/float-window.js` — `translateBtn.onclick` 的 finally 块（当前 line 216-219），扩展恢复范围：
  ```javascript
  // 改前（line 216-219）
  } finally {
      translateBtn.innerText = '快译';
      translateBtn.disabled = false;
  }

  // 改后
  } finally {
      translateBtn.innerText = '快译';
      translateBtn.disabled = false;
      input.disabled = false;
      targetLangSelect.disabled = false;
      clearBtn.disabled = false;
  }
  ```

**不要做的事**：
- 不要改 popup 的 `handleTranslate()` 函数体 — loading 状态由 `setLoading()` 统一管理
- 不要改 sidebar/float-window 的翻译逻辑（try 块内的 sendMessage、结果渲染等）
- 不要禁用结果区的朗读/复制按钮 — 那是另一个 UX 问题，不纳入本轮
- 不要禁用 popup 的 `btnSpeak / btnCopy / btnFavorite / btnHistory / btnSettings / btnImmersive / btnSidebar / btnFloat` — 这些不影响翻译请求语义
- 不要改 sidebar/float-window 的 speakSourceBtn / speakResultBtn / copyBtn — 那属于 B 部分
- 不要改 CSS — `disabled` 属性即可阻止点击，浏览器默认降低透明度

### 推荐

#### B. 朗读按钮防重复 — 外层 wrapper 模式

朗读按钮无 disabled 状态，快速多次点击非系统 TTS 时，多个 `playAudioOffscreen` 请求并行完成后多段音频同时播放。

**关键行为说明**：`offscreen.js` 的 `playAudio()` Promise 在 `audio.onended` 时才 resolve。所以 `await speak(...)` 会一直等到整段音频播放结束。按钮禁用持续到播放结束，不仅是网络请求阶段。这正是期望行为 — 防止多段音频叠播。

**实现方式**：在各自 `onclick` 外层包 wrapper，不改 `speak()` 内部。

**B1. Popup — speak 按钮防重复**

- [x] `popup/popup.js` — `btnSpeak` 的 click handler（当前 line 156-164），加 disabled 守卫：
  ```javascript
  // 改前（line 156-164）
  elements.btnSpeak.addEventListener('click', async () => {
      if (currentResult) {
          try {
              await speak(currentResult, elements.targetLang.value);
          } catch (err) {
              console.error('朗读失败:', err);
              showToast(err.message || '朗读失败');
          }
      }
  });

  // 改后
  elements.btnSpeak.addEventListener('click', async () => {
      if (!currentResult || elements.btnSpeak.disabled) return;
      elements.btnSpeak.disabled = true;
      try {
          await speak(currentResult, elements.targetLang.value);
      } catch (err) {
          console.error('朗读失败:', err);
          showToast(err.message || '朗读失败');
      } finally {
          elements.btnSpeak.disabled = false;
      }
  });
  ```

**B2. Sidebar — 两个 speak 按钮防重复**

- [x] `content/modules/sidebar.js` — 在 `speakSourceBtn.onclick` 赋值之前（当前 line 261 之前），添加 `runSpeak` helper：
  ```javascript
  // 在 line 261 之前新增
  const runSpeak = async (btn, fn) => {
      if (btn.disabled) return;
      btn.disabled = true;
      try {
          await fn();
      } catch (err) {
          console.error('[TTS] 朗读失败:', err);
      } finally {
          btn.disabled = false;
      }
  };
  ```

- [x] `content/modules/sidebar.js` — `speakSourceBtn` 和 `speakResultBtn` 的 onclick（当前 line 261-262），改用 `runSpeak`：
  ```javascript
  // 改前（line 261-262）
  speakSourceBtn.onclick = () => speak(input.value, sourceLangSelect.value);
  speakResultBtn.onclick = () => speak(resultContent.innerText, targetLangSelect.value);

  // 改后
  speakSourceBtn.onclick = () => runSpeak(speakSourceBtn, () => speak(input.value, sourceLangSelect.value));
  speakResultBtn.onclick = () => runSpeak(speakResultBtn, () => speak(resultContent.innerText, targetLangSelect.value));
  ```

**B3. Float-window — 两个 speak 按钮防重复**

- [x] `content/modules/float-window.js` — 在 `speakSourceBtn.onclick` 赋值之前（当前 line 154 之前），添加 `runSpeak` helper：
  ```javascript
  // 在 line 154 之前新增
  const runSpeak = async (btn, fn) => {
      if (btn.disabled) return;
      btn.disabled = true;
      try {
          await fn();
      } catch (err) {
          console.error('[TTS] 朗读失败:', err);
      } finally {
          btn.disabled = false;
      }
  };
  ```

- [x] `content/modules/float-window.js` — `speakSourceBtn` 和 `speakResultBtn` 的 onclick（当前 line 154-155），改用 `runSpeak`：
  ```javascript
  // 改前（line 154-155）
  speakSourceBtn.onclick = () => speak(input.value, 'auto');
  speakResultBtn.onclick = () => speak(resultText.innerText, targetLangSelect.value);

  // 改后
  speakSourceBtn.onclick = () => runSpeak(speakSourceBtn, () => speak(input.value, 'auto'));
  speakResultBtn.onclick = () => runSpeak(speakResultBtn, () => speak(resultText.innerText, targetLangSelect.value));
  ```

**不要做的事**：
- 不要改 `speak()` 函数内部 — UI 状态控制在 onclick 外层，不侵入 TTS provider 逻辑
- 不要改系统 TTS 的 `speechSynthesis.cancel()` 行为
- 不要给 speak 按钮加 loading 动画/spinner — 仅 `disabled` 即可
- 不要改 popup 的 `speak()` 函数签名或内部逻辑
- 不要改 sidebar/float-window 的 `speak()` / `speakOpenAI()` / `speakGoogle()` / `speakGLM()` / `speakSystem()` 内部逻辑
- 不要改 `playAudioFromDataUrl()` / `playAudio()` 函数
- 不要把 sidebar 的 `runSpeak` 提取为全局/共享模块 — 各面板各自定义即可

## 不做的事

- **不做** 翻译中结果区按钮（朗读/复制旧结果）的禁用 — 另一个 UX 问题，留后续轮次
- **不做** speak 超时保护 — 可作为后续轮次
- **不做** speak loading 动画 — disabled 已提供足够反馈
- **不碰** immersive.js、menus.js、content.js、service-worker.js、manifest.json、ad-blocker.js、floating-ball.js、storage.js、translator.js、tts.js、offscreen.js、options.js、options.html、popup.html、popup.css、content.css

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check popup/popup.js` 通过
- [x] `node --check content/modules/sidebar.js` 通过
- [x] `node --check content/modules/float-window.js` 通过
- [x] `git diff --check` 无输出
