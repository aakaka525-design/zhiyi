---
status: done
priority: P1
created: 2026-03-13
---

# 016 — 错误态交互空转 & TTS 语言参数修复

- 来源讨论: [discussions/016-error-state-ux-and-tts-lang.md](../discussions/016-error-state-ux-and-tts-lang.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/016-error-state-ux-and-tts-lang.md](../discussions/016-error-state-ux-and-tts-lang.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `popup/popup.js` | A: showError/showResult/clearResult 状态类控制 |
| `popup/popup.css` | A: error-state 下隐藏 result-actions |
| `content/modules/sidebar.js` | B: 错误颜色 token 化；C: speakSystem 语言修复 |
| `content/modules/float-window.js` | B: 错误颜色 + 成功重置；C: speakSystem 语言修复 |
| `content/modules/selection.js` | B: 错误颜色 token 化 |
| `content/modules/utils.js` | D: isPluginElement 加浮球 |
| `content/content.css` | E: 删重复注释 |
| `tests/error-state-tts-lang.test.mjs` | A + B + C + D + E |

## 任务清单

### 必做

#### A. Popup 错误态操作按钮隐藏

通过 CSS 状态类控制，不用内联 style。

**A1. JS 状态类管理**

- [x] `popup/popup.js` — `showError()` 函数改为：
  ```javascript
  function showError(message) {
      elements.resultSection.classList.add('active', 'error-state');
      elements.resultContent.innerHTML = `<div class="result-error" style="color: var(--error)">${escapeHtml(message)}</div>`;
  }
  ```
- [x] `popup/popup.js` — `showResult()` 函数中补入移除 `error-state`：
  ```javascript
  function showResult(text) {
      elements.resultSection.classList.add('active');
      elements.resultSection.classList.remove('error-state');
      elements.resultContent.innerHTML = `<div class="result-text">${escapeHtml(text)}</div>`;
  }
  ```
- [x] `popup/popup.js` — `clearResult()` 函数中补入移除 `error-state`：
  ```javascript
  function clearResult() {
      currentResult = '';
      elements.resultSection.classList.remove('active', 'error-state');
      elements.resultContent.innerHTML = '';
      elements.btnFavorite.querySelector('svg').style.fill = 'none';
  }
  ```

**A2. CSS 规则**

- [x] `popup/popup.css` — 在 `.result-actions` 样式之后补入：
  ```css
  .result-section.error-state .result-actions {
      display: none;
  }
  ```

**不要做的事**：不要用内联 `style.display` 控制按钮显隐。

### 必做

#### B. Sidebar / Bubble / Float-window 错误颜色 token 化

**B1. Sidebar 错误颜色**

- [x] `content/modules/sidebar.js` — catch 路径（当前 line 285）：
  ```javascript
  // 改前
  resultContent.style.color = '#ff5252';
  // 改后
  resultContent.style.color = 'var(--error)';
  ```

**B2. Bubble 错误颜色**

- [x] `content/modules/selection.js` — `renderBubbleMessage()` 函数（当前 line 214）：
  ```javascript
  // 改前
  container.style.color = isError ? '#ff5252' : '';
  // 改后
  container.style.color = isError ? 'var(--error)' : '';
  ```

**B3. Float-window 错误颜色 + 成功重置**

- [x] `content/modules/float-window.js` — catch 路径（当前 line 175-178）：
  在 `resultText.innerText = '错误: ' + err.message` 之后补入：
  ```javascript
  resultText.style.color = 'var(--error)';
  ```
- [x] `content/modules/float-window.js` — 成功路径（当前 line 171-174）：
  在 `resultText.innerText = response.text` 之后补入：
  ```javascript
  resultText.style.color = '';
  ```

### 推荐

#### C. TTS speakSystem 语言参数修复 + 映射对齐

在 sidebar 和 float-window 的 `speakSystem()` 函数中统一处理 `'auto'` 和 `undefined`，同时对齐语言映射到和 popup 一致的完整版本。

**C1. Sidebar speakSystem**

- [x] `content/modules/sidebar.js` — `speakSystem()` 函数（当前 line 169-175）改为：
  ```javascript
  const speakSystem = (text, lang, speed) => {
      const langMap = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP', ko: 'ko-KR' };
      const resolvedLang = !lang || lang === 'auto' ? ST.detectLanguage(text) : lang;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = speed;
      utterance.lang = langMap[resolvedLang] || resolvedLang;
      window.speechSynthesis.speak(utterance);
  };
  ```
- [x] 调用点（`speakSourceBtn.onclick`、`speakResultBtn.onclick`、各 TTS provider 的 fallback）不需要改

**C2. Float-window speakSystem**

- [x] `content/modules/float-window.js` — 系统 TTS 回退代码（当前 line 138-143）改为：
  ```javascript
  // 回退到系统语音
  const langMap = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP', ko: 'ko-KR' };
  const resolvedLang = !lang || lang === 'auto' ? ST.detectLanguage(text) : lang;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = speed;
  utterance.lang = langMap[resolvedLang] || resolvedLang;
  window.speechSynthesis.speak(utterance);
  ```
- [x] 调用点不需要改

### 推荐

#### D. isPluginElement 补浮球容器

- [x] `content/modules/utils.js` — `isPluginElement()` 函数中，在 `el.closest('#st-float-window')` 之后加入：
  ```javascript
  el.closest('#st-floating-ball-container') ||
  ```
- [x] 不要重构为数组驱动，只加这一项

### 顺手

#### E. Content CSS 重复注释块

- [x] `content/content.css` — 删除 line 200-202 的重复注释块（保留 line 196-198 的第一个）：
  ```css
  /* 删除以下重复块 */
  /* ========================================
     侧边栏 (Sidebar) 样式
     ======================================== */
  ```

## 不做的事

- **不做** TTS speak 公共模块提取 — 单独任务
- **不做** translateBatch fallback chain — 架构任务
- **不做** float-window 源语言选择器 — 功能增强
- **不做** isPluginElement 数组驱动重构 — 复杂度不够
- **不碰** service worker、manifest、options、translator.js、content.js

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check popup/popup.js` 通过
- [x] `node --check content/modules/sidebar.js` 通过
- [x] `node --check content/modules/float-window.js` 通过
- [x] `node --check content/modules/selection.js` 通过
- [x] `node --check content/modules/utils.js` 通过
- [x] `git diff --check` 无输出
