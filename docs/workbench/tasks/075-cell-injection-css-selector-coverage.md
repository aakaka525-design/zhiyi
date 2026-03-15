---
status: done
priority: P2
created: 2026-03-14
---

# 075 — Cell-内注入译文样式过重 + 选择器覆盖缺口

- 来源讨论: [discussions/075-cell-injection-css-selector-coverage.md](../discussions/075-cell-injection-css-selector-coverage.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/075-cell-injection-css-selector-coverage.md](../discussions/075-cell-injection-css-selector-coverage.md)（完整讨论记录 + Codex 审阅）

## 背景

068/070 将 `td`/`th`/`li` 改为 cell-内注入（append div inside element），但 `.st-immersive-translation` 的卡片样式（background、10px padding、border-radius、shadow）在表格单元格和列表项内部视觉过重。同时 `<figcaption>`、`<dt>`、`<dd>`、`<caption>` 等语义元素不在选择器列表中，导致图片说明、定义列表、表格标题不翻译。

Codex 审阅结论：
- A 成立 — 为 cell-内注入补轻量 CSS override，保留最小视觉区分（细 border-left）
- B 部分接受 — `figcaption`/`dt`/`dd`/`caption` 可以纳入，但**必须先加入 cell-内注入分支**，不能走 block wrapper
- `summary` 明确排除 — 折叠状态下译文不可见，交互/语义问题需单独任务
- 顺序关键：先扩 cell-内注入分支 → 再扩选择器 → 再扩 `getImmersiveMinLength`

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/content.css` | A1：cell-内注入轻量样式覆盖 |
| `content/modules/immersive.js` | B1：扩展 cell-内注入分支 |
| `content/modules/immersive.js` | B2：初始扫描选择器扩展 |
| `content/modules/immersive.js` | B3：Observer 选择器扩展 |
| `content/modules/immersive.js` | B4：`getImmersiveMinLength` 阈值扩展 |
| `tests/075-cell-css-selector-coverage.test.mjs` | C：回归测试 |

## 任务清单

### 必做

#### A1. Cell-内注入轻量样式覆盖

- [x] `content.css:254` — 在 `.st-immersive-translation` 样式块之后，添加 cell-内注入的轻量覆盖：

  ```css
  /* 改后（在 .st-immersive-translation 之后新增） */
  td > .st-immersive-translation,
  th > .st-immersive-translation,
  li > .st-immersive-translation,
  figcaption > .st-immersive-translation,
  dt > .st-immersive-translation,
  dd > .st-immersive-translation,
  caption > .st-immersive-translation {
      background: transparent;
      border-left: 2px solid var(--accent);
      padding: 0 0 0 8px;
      margin: 4px 0 0 0;
      border-radius: 0;
      box-shadow: none;
      font-size: 0.9em;
  }
  ```

  行为说明：
  - 覆盖 `.st-immersive-translation` 的卡片样式，在 cell-内上下文中使用轻量样式
  - 保留 `color: var(--accent)`（从基础类继承）— 译文颜色仍有区分
  - 保留 `border-left: 2px solid var(--accent)` — 最小视觉标记，标识这是译文
  - `padding: 0 0 0 8px` — 只在左边框后留小间距
  - `margin: 4px 0 0 0` — 原文和译文之间只留 4px 间隙
  - `background: transparent` — 不在 cell 内创建嵌套背景
  - `border-radius: 0` + `box-shadow: none` — 去掉卡片感
  - `font-size: 0.9em` — 比基础类的 `0.95em` 更小，视觉上区分原文和译文
  - 子选择器（`>`）确保只影响 direct child，不影响更深嵌套
  - dark mode 自动适配 — `var(--accent)` 在 dark mode 下变为 `#8FB3A4`

#### B1. 扩展 cell-内注入分支

- [x] `immersive.js:235` — 扩展 `container.matches()` 包含新元素：

  ```javascript
  /* 改前 */
  } else if (container.matches('td, th, li')) {

  /* 改后 */
  } else if (container.matches('td, th, li, figcaption, dt, dd, caption')) {
  ```

  行为说明：
  - `figcaption`：图片说明 — 在 `<figure>` 内，wrapper sibling 会插在 `<figure>` 外或 `<figcaption>` 和下一个 `<figure>` 之间，不合适
  - `dt`：定义术语 — wrapper sibling 会插在 `<dt>` 和 `<dd>` 之间，打断 term-description 配对
  - `dd`：定义描述 — wrapper sibling 会插在 `<dd>` 和下一个 `<dt>` 之间，打断列表结构
  - `caption`：表格标题 — wrapper sibling 会插在 `<caption>` 和 `<thead>`/`<tbody>` 之间，在 `<table>` 内部创建非法 HTML
  - cell-内注入（append div inside element）避免所有这些结构问题
  - 这些元素的 parent（`figure`/`dl`/`table`）都有特殊的子元素约束，cell-内注入是唯一安全的方式

#### B2. 初始扫描选择器扩展

- [x] `immersive.js:102-107` — 在选择器数组中添加新元素：

  ```javascript
  /* 改前 */
  const selectors = [
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'li', 'td', 'th', 'blockquote',
      '.markdown-body p', '.markdown-body li',
      '.comment-body p', '.js-comment-body p'
  ].join(', ');

  /* 改后 */
  const selectors = [
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'li', 'td', 'th', 'blockquote',
      'figcaption', 'dt', 'dd', 'caption',
      '.markdown-body p', '.markdown-body li',
      '.comment-body p', '.js-comment-body p'
  ].join(', ');
  ```

  行为说明：
  - 新增 4 个 HTML5 语义元素：`figcaption`（图片说明）、`dt`（定义术语）、`dd`（定义描述）、`caption`（表格标题）
  - 放在 `blockquote` 之后、GitHub 特定选择器之前
  - 不添加 `summary` — Codex 明确排除

#### B3. Observer 选择器扩展

- [x] `immersive.js:305`（Observer Discord 通用 fallback 选择器）和 `immersive.js:309`（Observer 通用路径选择器）— 同步扩展：

  ```javascript
  /* 改前（两处都是） */
  'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote'

  /* 改后（两处同步修改） */
  'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption'
  ```

  行为说明：
  - Observer 选择器与初始扫描选择器保持一致
  - Discord 路径的通用 fallback 也同步扩展
  - 不添加 `summary`

#### B4. `getImmersiveMinLength` 阈值扩展

- [x] `immersive.js:17` — 在 matches 字符串中添加新元素：

  ```javascript
  /* 改前 */
  if (el.matches('[id^="message-content-"], h1, h2, h3, h4, h5, h6, li, td, th')) return 2;

  /* 改后 */
  if (el.matches('[id^="message-content-"], h1, h2, h3, h4, h5, h6, li, td, th, figcaption, dt, dd, caption')) return 2;
  ```

  行为说明：
  - `figcaption`/`dt`/`dd`/`caption` 通常是短文本 — 阈值 2 与 `h1-h6`/`li`/`td`/`th` 一致
  - 不添加 `summary`

#### C. 回归测试

- [x] 新建 `tests/075-cell-css-selector-coverage.test.mjs`，至少覆盖：
  1. **A1 — CSS 验证**：确认 CSS 文件包含 cell-内注入轻量覆盖选择器
  2. **B1 — cell-内注入路径覆盖 `figcaption`**：`<figcaption>` 元素走 cell-内注入，div 追加在元素内部
  3. **B1 — cell-内注入路径覆盖 `dt`/`dd`**：`<dt>`/`<dd>` 元素走 cell-内注入
  4. **B1 — cell-内注入路径覆盖 `caption`**：`<caption>` 元素走 cell-内注入
  5. **B1 — 原有 `td`/`th`/`li` 不受影响**：仍走 cell-内注入
  6. **B1 — `<p>`/`<blockquote>` 不受影响**：仍走 block wrapper 路径
  7. **B2 — 初始扫描选中新元素**：页面包含 `<figcaption>`/`<dt>`/`<dd>`/`<caption>` 时被选中
  8. **B3 — Observer 收集新元素**：模拟 mutation 添加含新元素的节点
  9. **B4 — `getImmersiveMinLength` 新元素阈值为 2**
  10. **不选 `summary`**：`<summary>` 元素不被初始扫描或 Observer 选中

**不要做的事**：
- 不要添加 `summary` 到任何选择器或注入路径 — Codex 明确排除
- 不要修改 block wrapper 路径的样式 — 对 `<p>`/`<h1-h6>`/`<blockquote>` 的卡片样式是合适的
- 不要修改 inline 路径的样式 — 066 已处理
- 不要修改 heading 字号同步逻辑 — 066 已处理
- 不要修改 Discord/Twitter 专用选择器 — 073 已处理
- 不要修改 EXCLUDE_SELECTORS 数组内容
- 不要修改 `filterContainedImmersiveElements` — 074 已处理
- 不要修改 `isExcludedByImmersiveContext` — 072 已处理
- 不要碰 popup.js、selection.js、sidebar.js、float-window.js、content.js、utils.js、tts.js、options.js、floating-ball.js、ad-blocker.js、storage.js、translator.js、message-router.js、service-worker.js、offscreen.js、manifest.json、menus.js、popup.css

## 不做的事

- **不做** `summary` 选择器或注入 — Codex 明确推迟，需单独任务处理折叠/交互语义
- **不做** 修改 block wrapper 路径样式
- **不做** 修改 inline 路径样式
- **不做** 修改 EXCLUDE_SELECTORS

## 验证要求

- [x] `node --test tests/075-cell-css-selector-coverage.test.mjs` 通过
- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `git diff --check` 无输出
