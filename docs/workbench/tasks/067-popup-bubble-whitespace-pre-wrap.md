---
status: done
priority: P2
created: 2026-03-14
---

# 067 — Popup 和 Bubble 翻译结果丢失换行符

- 来源讨论: [discussions/067-popup-bubble-whitespace-pre-wrap.md](../discussions/067-popup-bubble-whitespace-pre-wrap.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/067-popup-bubble-whitespace-pre-wrap.md](../discussions/067-popup-bubble-whitespace-pre-wrap.md)（完整讨论记录 + Codex 审阅）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `popup/popup.css` | A：`.result-content` 加 `white-space: pre-wrap` |
| `content/content.css` | B：`.st-bubble-result` 加 `white-space: pre-wrap` |
| `tests/067-popup-bubble-whitespace.test.mjs` | 回归测试 |

## 任务清单

### 必做

#### A. Popup `.result-content` 加 `white-space: pre-wrap`

- [x] `popup/popup.css:227-234` — 在 `.result-content` 规则中加 `white-space: pre-wrap`：
  ```css
  /* 改前（line 227-234） */
  .result-content {
      padding: 16px;
      max-height: 200px;
      overflow-y: auto;
      font-size: 15px;
      color: var(--text-primary);
      line-height: 1.7;
  }

  /* 改后 */
  .result-content {
      padding: 16px;
      max-height: 200px;
      overflow-y: auto;
      font-size: 15px;
      color: var(--text-primary);
      line-height: 1.7;
      white-space: pre-wrap;
  }
  ```

  行为说明：
  - **正常情况**（翻译无 `\n`）：与之前完全相同
  - **AI 翻译返回多行文本**：`escapeHtml` 保留在文本节点中的 `\n` 在 `pre-wrap` 下渲染为换行符
  - `showError` 也会受益 — 多行错误信息同样保留换行
  - 不改 JS 渲染方式 — Codex 明确：`escapeHtml` 没丢换行，只是 CSS 缺 `pre-wrap`
  - 不删 `.result-text` wrapper — 不构成 bug，属可选清理，不扩大范围

#### B. Bubble `.st-bubble-result` 加 `white-space: pre-wrap`

- [x] `content/content.css:163-169` — 在 `.st-bubble-result` 规则中加 `white-space: pre-wrap`：
  ```css
  /* 改前（line 163-169） */
  .st-bubble-result {
      max-height: 280px;
      overflow-y: auto;
      word-wrap: break-word;
      color: var(--text-primary);
      font-size: 15px;
  }

  /* 改后 */
  .st-bubble-result {
      max-height: 280px;
      overflow-y: auto;
      word-wrap: break-word;
      color: var(--text-primary);
      font-size: 15px;
      white-space: pre-wrap;
  }
  ```

  行为说明：
  - **正常情况**（短文本翻译无 `\n`）：与之前完全相同
  - **多段落划选翻译**：`textContent` 设置的 `\n` 在 `pre-wrap` 下渲染为换行符
  - 不改 `renderBubbleMessage` — Codex 明确：`textContent + pre-wrap` 已够用
  - 与 sidebar `.st-result-text` 和 float-window `.st-float-result-text` 的 `white-space: pre-wrap` 保持一致

#### C. 回归测试

- [x] 新建 `tests/067-popup-bubble-whitespace.test.mjs`，至少覆盖：
  1. **A — popup `.result-content` 有 `white-space: pre-wrap`**：popup.css 的 `.result-content` 规则包含 `white-space: pre-wrap`（或等效值如 `pre-wrap`）
  2. **B — bubble `.st-bubble-result` 有 `white-space: pre-wrap`**：content.css 的 `.st-bubble-result` 规则包含 `white-space: pre-wrap`

**不要做的事**：
- 不要改 `popup.js` 的 `showResult` — 不改 `innerHTML + escapeHtml` 为 `innerText`
- 不要改 `popup.js` 的 `showError` — CSS 修复自动覆盖
- 不要删 `.result-text` wrapper div — 不属本轮范围
- 不要改 `selection.js` 的 `renderBubbleMessage` — `textContent + pre-wrap` 已够用
- 不要改 sidebar/float-window — 它们已有 `white-space: pre-wrap`
- 不要碰 popup.js、selection.js、sidebar.js、float-window.js、immersive.js、utils.js、tts.js、options.js、floating-ball.js、ad-blocker.js、storage.js、translator.js、message-router.js、service-worker.js、offscreen.js、manifest.json、menus.js

## 不做的事

- **不做** `showResult` 改 `innerText` — Codex 明确：CSS 缺 `pre-wrap` 是根因，不是渲染 API 选型问题
- **不做** `.result-text` wrapper 清理 — 不构成 bug
- **不做** `overflow-wrap` 统一 — 独立问题

## 验证要求

- [x] `node --test tests/067-popup-bubble-whitespace.test.mjs` 通过
- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `git diff --check` 无输出
