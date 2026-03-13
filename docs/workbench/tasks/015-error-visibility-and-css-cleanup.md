---
status: done
priority: P1
created: 2026-03-13
---

# 015 — 错误反馈不可见 & CSS/文案清理

- 来源讨论: [discussions/015-error-visibility-and-css-cleanup.md](../discussions/015-error-visibility-and-css-cleanup.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/015-error-visibility-and-css-cleanup.md](../discussions/015-error-visibility-and-css-cleanup.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `popup/popup.js` | A: showError 补 active class + 早返回路径清状态 |
| `options/options.css` | B: 删除重复 .history-target |
| `options/options.js` | C: 错误消息文案 |
| `options/options.html` | D: 关于页面文案 |
| `tests/error-visibility-css-cleanup.test.mjs` | A + B + C + D |

## 任务清单

### 必做

#### A. Popup 翻译错误不可见修复

两处改动：

**A1. `showError()` 补 active class**

- [x] `popup/popup.js` — `showError()` 函数（当前 line 360）中，在设置 `innerHTML` 之前补入：
  ```javascript
  elements.resultSection.classList.add('active');
  ```
- [x] 改后 `showError()` 完整形态：
  ```javascript
  function showError(message) {
      elements.resultSection.classList.add('active');
      elements.resultContent.innerHTML = `<div class="result-error" style="color: var(--error)">${escapeHtml(message)}</div>`;
  }
  ```

**A2. 早返回路径先清旧状态**

- [x] `popup/popup.js` — `handleTranslate()` 中 MAX_CHARS 检查（当前 line 261-263）：在 `showError()` 之前插入 `clearResult()`
- [x] 改后代码：
  ```javascript
  if (text.length > MAX_CHARS) {
      clearResult();
      showError('文本超出最大长度限制');
      return;
  }
  ```
- [x] 这样确保：(1) `currentResult` 被清空 (2) 收藏按钮状态被重置 (3) 错误信息可见

**不要做的事**：不要把 `showError` 提升为完整错误态入口（负责 clearResult + 显示错误），保持 `showError` 职责单一。

### 必做

#### B. Options `.history-target` CSS 规则重复修复

- [x] `options/options.css` — 删除第二条 `.history-target` 规则（当前 line 522-528）：
  ```css
  /* 删除以下整块 */
  .history-target {
      font-size: 14px;
      color: var(--text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
  }
  ```
- [x] 保留第一条（当前 line 511-519）的 3 行截断样式不变
- [x] **不动** `.history-source`，它只有一条规则，没有冲突

### 推荐

#### C. GLM TTS 测试错误消息文案

- [x] `options/options.js` — 当前 line 390 的：
  ```javascript
  throw new Error('请先填写 ppinfra API Key');
  ```
  改为：
  ```javascript
  throw new Error('请先填写 DeepSeek API Key（用于 GLM TTS）');
  ```
- [x] **只改这一处运行时错误消息**，不扩大到 `options.html` 中的平台说明文案

### 顺手

#### D. 关于页面引擎列表

- [x] `options/options.html` — 当前 line 448 的：
  ```html
  <strong>多引擎驱动</strong>：支持 Google, OpenAI, Gemini 多种服务。
  ```
  改为：
  ```html
  <strong>多引擎驱动</strong>：支持 Google、OpenAI、Gemini、DeepSeek 等多种翻译引擎，并提供离线英译中能力。
  ```

## 不做的事

- **不做** TTS speak 公共模块提取 — 单独任务
- **不做** translateBatch fallback chain — 架构任务
- **不做** float-window 拖拽边界约束 — 低优先级
- **不做** options.html 中其余 ppinfra 说明文案清理 — 011 有意保留，需另开任务明确边界
- **不碰** service worker、manifest、content script、translator.js

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check popup/popup.js` 通过
- [x] `node --check options/options.js` 通过
- [x] `git diff --check` 无输出
