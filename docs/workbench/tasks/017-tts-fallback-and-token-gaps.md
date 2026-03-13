---
status: done
priority: P1
created: 2026-03-13
---

# 017 — Sidebar TTS 回退参数修复 & 残留硬编码颜色

- 来源讨论: [discussions/017-tts-fallback-and-token-gaps.md](../discussions/017-tts-fallback-and-token-gaps.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/017-tts-fallback-and-token-gaps.md](../discussions/017-tts-fallback-and-token-gaps.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/sidebar.js` | A: TTS provider fallback lang/speed 修复 |
| `content/modules/selection.js` | B: 复制成功颜色 token 化 |
| `popup/popup.css` | D: 状态点颜色 token 化 |
| `tests/tts-fallback-token-gaps.test.mjs` | A + B + C + D |

## 任务清单

### 必做

#### A. Sidebar TTS provider fallback lang/speed 统一

所有 provider 内部 fallback 统一调用 `speakSystem(text, lang, settings.ttsSpeed || 1.0)`，不再硬编码 `'zh'` 或 `1.0`。

**A1. `speakOpenAI` 加 `lang` 参数 + 修复 fallback**

- [x] `content/modules/sidebar.js` — `speakOpenAI` 签名（当前 line 189）：
  ```javascript
  // 改前
  const speakOpenAI = async (text, settings) => {
  // 改后
  const speakOpenAI = async (text, lang, settings) => {
  ```
- [x] `content/modules/sidebar.js` — `speakOpenAI` no-key fallback（当前 line 191）：
  ```javascript
  // 改前
  if (!apiKey) { speakSystem(text, 'zh', 1.0); return; }
  // 改后
  if (!apiKey) { speakSystem(text, lang, settings.ttsSpeed || 1.0); return; }
  ```

**A2. `speakGLM` 加 `lang` 参数 + 修复 fallback**

- [x] `content/modules/sidebar.js` — `speakGLM` 签名（当前 line 233）：
  ```javascript
  // 改前
  const speakGLM = async (text, settings) => {
  // 改后
  const speakGLM = async (text, lang, settings) => {
  ```
- [x] `content/modules/sidebar.js` — `speakGLM` no-key fallback（当前 line 236）：
  ```javascript
  // 改前
  speakSystem(text, 'zh', 1.0);
  // 改后
  speakSystem(text, lang, settings.ttsSpeed || 1.0);
  ```
- [x] `content/modules/sidebar.js` — `speakGLM` no-audioData fallback（当前 line 253）：
  ```javascript
  // 改前
  speakSystem(text, 'zh', settings.ttsSpeed || 1.0);
  // 改后
  speakSystem(text, lang, settings.ttsSpeed || 1.0);
  ```

**A3. `speakGoogle` no-key fallback speed 修复**

- [x] `content/modules/sidebar.js` — `speakGoogle` no-key fallback（当前 line 212）：
  ```javascript
  // 改前
  speakSystem(text, lang, 1.0);
  // 改后
  speakSystem(text, lang, settings.ttsSpeed || 1.0);
  ```

**A4. `speak()` 调用点传 `lang`**

- [x] `content/modules/sidebar.js` — `speak()` 函数内 switch（当前 line 150-162）：
  ```javascript
  // 改前
  case 'openai':
      await speakOpenAI(text, settings);
      break;
  // 改后
  case 'openai':
      await speakOpenAI(text, lang, settings);
      break;
  ```
  ```javascript
  // 改前
  case 'glm':
      await speakGLM(text, settings);
      break;
  // 改后
  case 'glm':
      await speakGLM(text, lang, settings);
      break;
  ```
- [x] `speakGoogle` 调用点不需要改（已经传了 `lang`）

**不要做的事**：不要给 `speakOpenAI` 的 "有 key 但无 audioData" 路径加 provider 内 fallback — 它当前 throw 到外层 catch，外层已经正确调用 `speakSystem(text, lang, speed)`。

### 必做

#### B. Bubble 复制成功颜色 token 化

- [x] `content/modules/selection.js` — copy 成功反馈（当前 line 164）：
  ```javascript
  // 改前
  copyBtn.style.color = '#00c853';
  // 改后
  copyBtn.style.color = 'var(--accent)';
  ```

### 必做

#### C. Sidebar 底部信息文字颜色 token 化

- [x] `content/modules/sidebar.js` — 底部信息块内联样式（当前 line 81）：
  ```javascript
  // 改前
  color: #666;
  // 改后
  color: var(--text-secondary);
  ```

### 推荐

#### D. Popup 状态点颜色 token 化

不新增 theme token，只使用已有 token。删除 glow 效果。

- [x] `popup/popup.css` — `.status-dot`（当前 line 288-293）：
  ```css
  /* 改前 */
  .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #D1D1D1;
  }
  /* 改后 */
  .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--text-tertiary);
  }
  ```
- [x] `popup/popup.css` — `.status-dot.active`（当前 line 295-299）：
  ```css
  /* 改前 */
  .status-dot.active {
      background: #A5D6A7;
      /* 柔和绿 */
      box-shadow: 0 0 8px rgba(165, 214, 167, 0.5);
  }
  /* 改后 */
  .status-dot.active {
      background: var(--success);
  }
  ```

**不要做的事**：不要为 glow 创建 `--success-glow` 或其他新 theme token。直接删除 `box-shadow` 和注释。

## 不做的事

- **不做** TTS speak 公共模块提取 — 单独架构任务
- **不做** float-window 复制按钮 — product-surface 任务
- **不做** float-window 源语言选择器 — 功能增强
- **不做** speakOpenAI "有 key 无 audioData" 路径增加 provider 内 fallback — throw 到外层 catch 已正确处理
- **不碰** service worker、manifest、options、translator.js、content.js、float-window.js

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check content/modules/sidebar.js` 通过
- [x] `node --check content/modules/selection.js` 通过
- [x] `git diff --check` 无输出
