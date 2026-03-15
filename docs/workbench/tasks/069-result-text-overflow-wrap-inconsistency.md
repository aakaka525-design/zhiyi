---
status: done
priority: P2
created: 2026-03-14
---

# 069 — 翻译结果容器补 `word-wrap: break-word` 防长文本溢出

- 来源讨论: [discussions/069-result-text-overflow-wrap-inconsistency.md](../discussions/069-result-text-overflow-wrap-inconsistency.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/069-result-text-overflow-wrap-inconsistency.md](../discussions/069-result-text-overflow-wrap-inconsistency.md)（完整讨论记录 + Codex 审阅）

## 背景

五个翻译结果容器中只有 `.st-bubble-result` 有 `word-wrap: break-word`。其余四个在遇到长 URL 或无空格长字符串时会水平溢出（sidebar/float-window）或被裁切（popup）。

Codex 审阅结论：
- 统一用 `word-wrap: break-word`（与 `.st-bubble-result` 一致）
- 不用 `overflow-wrap`（不扩大 diff、不改现有 bubble）
- 不补 `white-space: pre-wrap` 到 `.st-immersive-translation`（保持单一目标：防溢出）
- 纯 CSS 修复，不改 JS

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/content.css` | A：`.st-result-text` 加 `word-wrap: break-word` |
| `content/content.css` | B：`.st-float-result-text` 加 `word-wrap: break-word` |
| `content/content.css` | C：`.st-immersive-translation` 加 `word-wrap: break-word` |
| `popup/popup.css` | D：`.result-content` 加 `word-wrap: break-word` |
| `tests/069-result-text-overflow-wrap.test.mjs` | E：回归测试 |

## 任务清单

### 必做

#### A. Sidebar `.st-result-text` 加 `word-wrap: break-word`

- [x] `content/content.css:512-517` — 在 `.st-result-text` 规则中加 `word-wrap: break-word`：

  ```css
  /* 改前（line 512-517） */
  .st-result-text {
      font-size: 15px;
      line-height: 1.7;
      color: var(--text-primary);
      white-space: pre-wrap;
  }

  /* 改后 */
  .st-result-text {
      font-size: 15px;
      line-height: 1.7;
      color: var(--text-primary);
      white-space: pre-wrap;
      word-wrap: break-word;
  }
  ```

  行为说明：
  - **正常文本**：与之前完全相同 — `break-word` 只在单词超出容器宽度时断行
  - **长 URL / 连续字符串**：在 sidebar 400px 宽度边界处断行，不再溢出
  - 与 `.st-bubble-result` 保持一致

#### B. Float-window `.st-float-result-text` 加 `word-wrap: break-word`

- [x] `content/content.css:718-723` — 在 `.st-float-result-text` 规则中加 `word-wrap: break-word`：

  ```css
  /* 改前（line 718-723） */
  .st-float-result-text {
      font-size: 14px;
      line-height: 1.6;
      color: var(--text-primary);
      white-space: pre-wrap;
  }

  /* 改后 */
  .st-float-result-text {
      font-size: 14px;
      line-height: 1.6;
      color: var(--text-primary);
      white-space: pre-wrap;
      word-wrap: break-word;
  }
  ```

  行为说明：
  - 小窗默认宽度约 320px，更容易触发长文本溢出
  - 补上后与 sidebar 和 bubble 行为一致

#### C. Immersive `.st-immersive-translation` 加 `word-wrap: break-word`

- [x] `content/content.css:241-253` — 在 `.st-immersive-translation` 规则中加 `word-wrap: break-word`：

  ```css
  /* 改前（line 241-253） */
  .st-immersive-translation {
      display: block;
      color: var(--accent);
      background: rgba(122, 154, 139, 0.08);
      border-left: 3px solid var(--accent);
      padding: 10px 16px;
      margin: 6px 0;
      border-radius: 4px 12px 12px 4px;
      font-size: 0.95em;
      line-height: 1.7;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
  }

  /* 改后 */
  .st-immersive-translation {
      display: block;
      color: var(--accent);
      background: rgba(122, 154, 139, 0.08);
      border-left: 3px solid var(--accent);
      padding: 10px 16px;
      margin: 6px 0;
      border-radius: 4px 12px 12px 4px;
      font-size: 0.95em;
      line-height: 1.7;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
      word-wrap: break-word;
  }
  ```

  行为说明：
  - 沉浸式翻译的容器宽度由宿主页面决定，在窄列布局中尤其容易溢出
  - 不补 `white-space: pre-wrap` — Codex 明确：本轮目标是防溢出，不是换行保留
  - block 路径用 `innerText` 设置文本（`\n` → `<br>`），不需要 `pre-wrap`

#### D. Popup `.result-content` 加 `word-wrap: break-word`

- [x] `popup/popup.css:227-235` — 在 `.result-content` 规则中加 `word-wrap: break-word`：

  ```css
  /* 改前（line 227-235） */
  .result-content {
      padding: 16px;
      max-height: 200px;
      overflow-y: auto;
      font-size: 15px;
      color: var(--text-primary);
      line-height: 1.7;
      white-space: pre-wrap;
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
      word-wrap: break-word;
  }
  ```

  行为说明：
  - Popup 父容器有 `overflow: hidden`，当前长文本会被裁切（用户看不到完整内容）
  - 补上后长文本在 380px 宽度处断行，不再被裁切

#### E. 回归测试

- [x] 新建 `tests/069-result-text-overflow-wrap.test.mjs`，至少覆盖：
  1. **A — sidebar `.st-result-text` 有 `word-wrap: break-word`**
  2. **B — float-window `.st-float-result-text` 有 `word-wrap: break-word`**
  3. **C — immersive `.st-immersive-translation` 有 `word-wrap: break-word`**
  4. **D — popup `.result-content` 有 `word-wrap: break-word`**

**不要做的事**：
- 不要改 `.st-bubble-result` — 已有 `word-wrap: break-word`，本轮不动
- 不要把 `.st-bubble-result` 的 `word-wrap` 改为 `overflow-wrap` — 不扩大 diff
- 不要改父容器的 `overflow-x` — `word-wrap` 从源头解决溢出
- 不要改用 `word-break: break-all` — 过于激进
- 不要给 `.st-immersive-translation` 补 `white-space: pre-wrap` — 保持单一目标
- 不要碰 JS 文件 — 纯 CSS 修复
- 不要碰 popup.js、selection.js、sidebar.js、float-window.js、immersive.js、content.js、utils.js、tts.js、options.js、floating-ball.js、ad-blocker.js、storage.js、translator.js、message-router.js、service-worker.js、offscreen.js、manifest.json、menus.js

## 不做的事

- **不做** 修改 `.st-bubble-result` — 已有正确的 `word-wrap: break-word`
- **不做** 属性名统一（`word-wrap` → `overflow-wrap`）— 无行为收益，扩大 diff
- **不做** 父容器 `overflow-x` 修改 — 从源头断词比加滚动条更好
- **不做** `.st-immersive-translation` 补 `white-space: pre-wrap` — 独立目标

## 验证要求

- [x] `node --test tests/069-result-text-overflow-wrap.test.mjs` 通过
- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `git diff --check` 无输出
