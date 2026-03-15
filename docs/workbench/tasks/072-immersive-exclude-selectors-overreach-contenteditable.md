---
status: done
priority: P2
created: 2026-03-14
---

# 072 — 沉浸式翻译 EXCLUDE_SELECTORS 上下文感知 + contenteditable 排除

- 来源讨论: [discussions/072-immersive-exclude-selectors-overreach-contenteditable.md](../discussions/072-immersive-exclude-selectors-overreach-contenteditable.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/072-immersive-exclude-selectors-overreach-contenteditable.md](../discussions/072-immersive-exclude-selectors-overreach-contenteditable.md)（完整讨论记录 + Codex 审阅）

## 背景

`EXCLUDE_SELECTORS` 使用 `p.closest('header')` 粗粒度排除，导致 `<article><header>` 内的文章标题和 `<article><footer>` 内的引用来源被跳过。同时缺少 `contenteditable` 保护，沉浸式翻译会注入到可编辑区域，存在数据污染风险。

Codex 审阅结论：
- `header/footer` 可以放行，但上下文限定为 `article/section`（不含 `main`）
- `aside` 不进本轮 — 需要更窄的语义信号才能安全放行
- `contenteditable` 用 `p.isContentEditable` 检查，放在 EXCLUDE 循环之前
- 初始扫描和 Observer 两条路径都要同步修改

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | A1：初始扫描排除逻辑上下文感知 |
| `content/modules/immersive.js` | A2：Observer 排除逻辑上下文感知 |
| `content/modules/immersive.js` | B1：初始扫描 contenteditable 排除 |
| `content/modules/immersive.js` | B2：Observer contenteditable 排除 |
| `tests/072-immersive-exclude-selectors.test.mjs` | C：回归测试 |

## 任务清单

### 必做

#### B1. 初始扫描 contenteditable 排除（在 EXCLUDE 循环之前）

- [x] `immersive.js:69` — 在 EXCLUDE_SELECTORS 循环之前加入 contenteditable 检查：

  ```javascript
  /* 改前（line 68-72） */
  if (style.display === 'none' || style.visibility === 'hidden') return false;

  for (const selector of EXCLUDE_SELECTORS) {
      if (p.closest(selector) || p.matches(selector)) return false;
  }

  /* 改后 */
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (p.isContentEditable) return false;

  for (const selector of EXCLUDE_SELECTORS) {
      if (p.closest(selector) || p.matches(selector)) return false;
  }
  ```

  行为说明：
  - `HTMLElement.isContentEditable` 是标准 DOM 属性，检查元素自身或任何祖先的 `contenteditable`
  - 覆盖 `contenteditable="true"`、`contenteditable=""`、继承的 contenteditable
  - 放在 EXCLUDE 循环之前 — 尽早返回，避免无意义的 closest 遍历
  - 防止翻译块注入到 WordPress/Notion/Medium 等 CMS 的可编辑区域

#### B2. Observer contenteditable 排除

- [x] `immersive.js:267` — 在 Observer 的 EXCLUDE_SELECTORS 循环之前加入：

  ```javascript
  /* 改前（line 266-271） */
  if (text.length < getImmersiveMinLength(el, isTwitter)) return false;
  if (!isTwitter) {
      for (const selector of EXCLUDE_SELECTORS) {
          if (el.closest(selector) || el.matches(selector)) return false;
      }
      if (ST.isPluginElement(el)) return false;
  }

  /* 改后 */
  if (text.length < getImmersiveMinLength(el, isTwitter)) return false;
  if (el.isContentEditable) return false;
  if (!isTwitter) {
      for (const selector of EXCLUDE_SELECTORS) {
          if (el.closest(selector) || el.matches(selector)) return false;
      }
      if (ST.isPluginElement(el)) return false;
  }
  ```

  行为说明：
  - 与 B1 保持一致 — 动态新增的 contenteditable 内容也被保护
  - 放在 `isTwitter` 分支之前 — contenteditable 排除对所有站点生效（包括 Twitter）

#### A1. 初始扫描排除逻辑上下文感知（header/footer）

- [x] `immersive.js:70-72` — 修改 EXCLUDE_SELECTORS 循环，对 `header/footer` 增加上下文判断：

  ```javascript
  /* 改前（line 70-72） */
  for (const selector of EXCLUDE_SELECTORS) {
      if (p.closest(selector) || p.matches(selector)) return false;
  }

  /* 改后 */
  for (const selector of EXCLUDE_SELECTORS) {
      if (p.matches(selector)) return false;

      const ancestor = p.closest(selector);
      if (!ancestor) continue;

      // header/footer 在 article/section 内时视为内容元素，不排除
      if (ancestor.tagName === 'HEADER' || ancestor.tagName === 'FOOTER') {
          if (ancestor.closest('article, section')) continue;
      }
      return false;
  }
  ```

  行为说明：
  - **站点级 `<header>`**（`<body> > <header>`，不在 article/section 内）：仍被排除 ✓
  - **文章级 `<header>`**（`<article> > <header>` 或 `<section> > <header>`）：不再排除 → 文章标题可翻译 ✓
  - **站点级 `<footer>`**（`<body> > <footer>`）：仍被排除 ✓
  - **文章级 `<footer>`**（`<article> > <footer>`）：不再排除 → 引用来源可翻译 ✓
  - **`<aside>`**：不变，仍全部排除 — Codex 明确不进本轮
  - **`<nav>/<button>/<a>` 等其他选择器**：不变，`p.matches()` 或 `p.closest()` 命中直接排除
  - **`main` 不作为放行条件** — Codex 明确：`<main> > <aside>` 的 TOC/侧栏不应放行

#### A2. Observer 排除逻辑上下文感知

- [x] `immersive.js:268-270` — 与 A1 相同的修改：

  ```javascript
  /* 改前（line 268-270） */
  for (const selector of EXCLUDE_SELECTORS) {
      if (el.closest(selector) || el.matches(selector)) return false;
  }

  /* 改后 */
  for (const selector of EXCLUDE_SELECTORS) {
      if (el.matches(selector)) return false;

      const ancestor = el.closest(selector);
      if (!ancestor) continue;

      if (ancestor.tagName === 'HEADER' || ancestor.tagName === 'FOOTER') {
          if (ancestor.closest('article, section')) continue;
      }
      return false;
  }
  ```

  行为说明：
  - 与 A1 保持一致 — 动态加载的文章头部内容也能被翻译
  - 在 `if (!isTwitter)` 分支内 — Twitter 路径不使用 EXCLUDE_SELECTORS

#### C. 回归测试

- [x] 新建 `tests/072-immersive-exclude-selectors.test.mjs`，至少覆盖：
  1. **B1 — contenteditable 排除**：`<div contenteditable="true"><p>text</p></div>` 中的 `<p>` 应被过滤
  2. **B1 — 非 contenteditable 不受影响**：普通 `<p>` 不被 contenteditable 检查过滤
  3. **A1 — 站点级 `<header>` 仍排除**：`<body><header><h1>Site Title</h1></header></body>` 中的 `<h1>` 应被过滤
  4. **A1 — 文章级 `<header>` 不排除**：`<article><header><h1>Article Title</h1></header></article>` 中的 `<h1>` 不应被过滤
  5. **A1 — `<section>` 内 `<header>` 不排除**：`<section><header><h2>Section Title</h2></header></section>` 中的 `<h2>` 不应被过滤
  6. **A1 — 站点级 `<footer>` 仍排除**：`<body><footer><p>Copyright</p></footer></body>` 中的 `<p>` 应被过滤
  7. **A1 — 文章级 `<footer>` 不排除**：`<article><footer><p>Source: ...</p></footer></article>` 中的 `<p>` 不应被过滤
  8. **A1 — `<aside>` 仍全部排除**：`<article><aside><p>Note text</p></aside></article>` 中的 `<p>` 仍应被过滤（aside 不放行）
  9. **A1 — 其他排除选择器不受影响**：`<nav><p>text</p></nav>` 中的 `<p>` 仍应被过滤

**不要做的事**：
- 不要放行 `<aside>` — Codex 明确不进本轮
- 不要把 `main` 加入放行条件 — `<main> > <aside>` 的 TOC 不应被翻译
- 不要修改 EXCLUDE_SELECTORS 数组本身 — 只修改排除逻辑
- 不要往 EXCLUDE_SELECTORS 数组里加 `[contenteditable="true"]` — 用 `isContentEditable` 属性
- 不要修改选择器列表（`p, h1, ..., blockquote`）
- 不要修改文本长度过滤逻辑
- 不要修改 `injectTranslation` 注入逻辑
- 不要新增 CSS 规则
- 不要碰 popup.js、selection.js、sidebar.js、float-window.js、content.js、utils.js、tts.js、options.js、floating-ball.js、ad-blocker.js、storage.js、translator.js、message-router.js、service-worker.js、offscreen.js、manifest.json、menus.js、popup.css、content.css

## 不做的事

- **不做** `<aside>` 放行 — Codex 明确：需要更窄的语义信号才能安全放行
- **不做** `<main>` 作为放行条件 — `<main> > <aside>` 的 TOC/侧栏会被误放行
- **不做** 修改 EXCLUDE_SELECTORS 数组 — 只修改循环内的判断逻辑
- **不做** 修改 heading 字号同步逻辑

## 验证要求

- [x] `node --test tests/072-immersive-exclude-selectors.test.mjs` 通过
- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `git diff --check` 无输出
