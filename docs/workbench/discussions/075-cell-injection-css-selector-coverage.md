---
discussion: "075"
created: 2026-03-14
---

# 075 — Cell-内注入译文样式过重 + 选择器覆盖缺口

## 发现过程

074 完成后继续审计沉浸式翻译。068/070 将 `td`/`th`/`li` 改为 cell-内注入（append div inside element），解决了 HTML 合法性问题。但 `.st-immersive-translation` 的 CSS 卡片样式（background、border-left、padding 10px 16px、border-radius、box-shadow）是为 block wrapper 路径设计的，在表格单元格和列表项内部显得视觉过重。同时审查了选择器列表，发现多个 HTML5 语义元素缺失。

### 重叠检查

- 066：讨论 inline 路径 CSS 冲突 + heading 字号 — 已修复，不涉及 cell-内注入的 CSS 适配
- 068：将 `td`/`th` 改为 cell-内注入，明确"不要新增 CSS 规则" — 但那是任务范围限制（"不 scope-creep"），不是对 cell 内样式合理性的最终判断
- 070：将 `li` 加入 cell-内注入，同样"不要新增 CSS 规则"
- 018：修复了 inline 路径颜色 token — 不涉及 cell-内注入
- 071：讨论文本长度阈值，不涉及选择器列表缺失的语义元素
- 073：添加 Discord 专用选择器 — 不涉及通用选择器列表缺口
- **无任何讨论涉及 cell-内注入的 CSS 适配或 `figcaption`/`dt`/`dd`/`summary`/`caption` 选择器缺失**

---

## 问题追踪

### A. Cell-内注入译文使用 block 卡片样式 — 在 `td`/`th`/`li` 内视觉过重

**注入代码** — `immersive.js:235-239`：

```javascript
} else if (container.matches('td, th, li')) {
    const blockTransEl = document.createElement('div');
    blockTransEl.className = 'st-immersive-translation';
    blockTransEl.innerText = translation;
    container.appendChild(blockTransEl);
}
```

**CSS 样式** — `content.css:241-254`：

```css
.st-immersive-translation {
    display: block;
    color: var(--accent);
    background: rgba(122, 154, 139, 0.08);    /* 柔和背景 */
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

这套样式是为 block wrapper 路径设计的 — 作为独立的翻译块放在段落之间，卡片感的背景、边框、间距和圆角提供了清晰的视觉区分。

**问题场景 1 — 密集数据表格（Wikipedia、文档站、对比页）**：

```html
<table>
  <tr>
    <td>
      Original cell text
      <div class="st-immersive-translation">
        <!-- padding: 10px 16px → 额外 20px 垂直空间 -->
        <!-- margin: 6px 0 → 额外 12px 垂直空间 -->
        <!-- background + border-left + border-radius → 嵌入卡片 -->
        原始单元格文本
      </div>
    </td>
    <td>Another cell</td>
  </tr>
</table>
```

用户看到的效果：

```
┌──────────────────────────┬─────────────┐
│ Original cell text       │ Another cell│
│ ┌────────────────────┐   │             │
│ │ 原始单元格文本      │   │             │
│ └────────────────────┘   │             │
└──────────────────────────┴─────────────┘
```

每个单元格内出现一个带背景、左边框、圆角的"迷你卡片"。问题：
- `padding: 10px 16px` 在单元格内创造了大量内边距，撑高行高
- `margin: 6px 0` 在原文和译文之间增加不必要的间距
- `border-radius: 4px 12px 12px 4px` 圆角在小空间内显得突兀
- `background` + `border-left` 在已有表格边框的单元格内创建嵌套边框感
- 密集表格中每行高度约翻倍（原文 + 32px 额外空间 + 译文）

**问题场景 2 — 列表项**：

```html
<ul>
  <li>
    List item text
    <div class="st-immersive-translation">
      列表项文本
    </div>
  </li>
</ul>
```

用户看到的效果：

```
• List item text
  ┌────────────────┐
  │ 列表项文本      │
  └────────────────┘
• Next item
```

每个列表项下方出现一个卡片块。列表本应紧凑，但卡片样式（padding + margin + background + border）让列表变得松散、沉重。

**对比：block wrapper 路径（`<p>`/`<h1-h6>`/`<blockquote>`）**：

```
Original paragraph text

┌────────────────────────┐
│ 原始段落文本            │
└────────────────────────┘

Next paragraph text
```

段落之间放置翻译卡片是合适的 — 段落天然有间距，卡片在独立的空间中不显拥挤。

**根因**：068/070 修复 HTML 合法性时将注入从 wrapper sibling 改为 cell-internal，但复用了 `.st-immersive-translation` 的原有样式，没有为 cell-内上下文适配样式。

### B. 选择器覆盖缺口 — 多个 HTML5 语义元素缺失

**当前选择器列表** — `immersive.js:102-107`（初始扫描）和 `immersive.js:305, 309`（Observer）：

```javascript
'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
'li', 'td', 'th', 'blockquote',
'.markdown-body p', '.markdown-body li',
'.comment-body p', '.js-comment-body p'
```

**缺失的语义元素**：

| 元素 | 用途 | 典型站点 | 影响 |
|------|------|----------|------|
| `<figcaption>` | 图片/图表说明文字 | MDN、Wikipedia、新闻站、博客 | 图片说明不翻译，用户无法理解图片上下文 |
| `<dt>` | 定义列表术语 | MDN 术语表、API 文档、词汇表 | 术语名不翻译 |
| `<dd>` | 定义列表描述 | MDN 术语表、API 文档 | 术语解释不翻译 |
| `<caption>` | 表格标题 | Wikipedia、文档站 | 表格无标题翻译，用户不理解表格内容 |
| `<summary>` | 折叠内容标题 | FAQ 页、文档（MDN、React 文档） | 折叠标题不翻译，用户无法判断是否要展开 |

**具体示例 — MDN 术语表**：

```html
<dl>
  <dt>Callback function</dt>
  <dd>A callback function is a function passed into another function as an argument.</dd>
</dl>
```

当前行为：`<dt>` 和 `<dd>` 不在选择器中 → 完全跳过 → 整个定义列表不翻译。

**具体示例 — Wikipedia 图片说明**：

```html
<figure>
  <img src="diagram.png" alt="...">
  <figcaption>Figure 1: Architecture overview of the system</figcaption>
</figure>
```

当前行为：`<figcaption>` 不在选择器中 → 图片说明不翻译。

**具体示例 — FAQ 页面**：

```html
<details>
  <summary>What is the difference between let and const?</summary>
  <p>let allows reassignment while const does not.</p>
</details>
```

当前行为：`<summary>` 不在选择器中 → 折叠标题不翻译。用户看到英文标题，不知是否需要展开。`<p>` 在 `<details>` 展开后可能被 Observer 捕获（如果展开触发 childList mutation），但 `<summary>` 始终不被翻译。

**Observer 选择器同步**：Observer 使用相同的元素列表（`immersive.js:305, 309`），缺失的元素同样不会被 Observer 捕获。

**`getImmersiveMinLength` 阈值**：`figcaption`、`dt`、`dd`、`caption`、`summary` 通常是短文本，建议与 `h1-h6`/`li`/`td`/`th` 一样使用阈值 2。

---

## 建议方案

### A — Cell-内注入样式适配

```css
/* content.css 新增 — cell-内注入轻量样式 */
td > .st-immersive-translation,
th > .st-immersive-translation,
li > .st-immersive-translation {
    background: transparent;
    border-left: 2px solid var(--accent);
    padding: 0 0 0 8px;
    margin: 4px 0 0 0;
    border-radius: 0;
    box-shadow: none;
    font-size: 0.9em;
}
```

**效果对比**：

改前（卡片样式）：
```
│ Original text          │
│ ┌────────────────────┐ │
│ │ 原文                │ │
│ └────────────────────┘ │
```

改后（轻量样式）：
```
│ Original text          │
│ ┃ 原文                 │
```

- 保留 `color: var(--accent)` 区分译文
- 保留细 `border-left`（2px）作为最小视觉标记
- 去掉 `background`、`border-radius`、`box-shadow`、大 `padding`
- `margin: 4px 0 0 0` 只在原文下方留小间隙

### B — 选择器覆盖扩展

**初始扫描** — `immersive.js:102-107`：

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
    'figcaption', 'dt', 'dd', 'caption', 'summary',
    '.markdown-body p', '.markdown-body li',
    '.comment-body p', '.js-comment-body p'
].join(', ');
```

**Observer** — `immersive.js:305, 309`（通用路径 + Discord 路径）：

```javascript
/* 改前 */
'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote'

/* 改后 */
'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption, summary'
```

**`getImmersiveMinLength`** — `immersive.js:15-19`：

```javascript
/* 改前 */
if (el.matches('[id^="message-content-"], h1, h2, h3, h4, h5, h6, li, td, th')) return 2;

/* 改后 */
if (el.matches('[id^="message-content-"], h1, h2, h3, h4, h5, h6, li, td, th, figcaption, dt, dd, caption, summary')) return 2;
```

**注入路径**：
- `<figcaption>` — 不匹配 `td, th, li` → 走 block wrapper 路径 ✓
- `<dt>` / `<dd>` — 不匹配 `td, th, li` → 走 block wrapper 路径。但 `<dd>` 与 `<dt>` 是紧挨的兄弟，wrapper 会插在 `<dt>` 和 `<dd>` 之间，可能打断 `<dl>` 的 term-description 配对。需要 Codex 判断是否需要 cell-内注入。
- `<caption>` — 不匹配 `td, th, li` → 走 block wrapper 路径 ✓
- `<summary>` — 不匹配 `td, th, li` → 走 block wrapper 路径。`<summary>` 的 wrapper 会在 `<summary>` 后面、`<details>` 其他内容之前。视觉上可接受。

### 需要 Codex 判断

1. **A — 样式方案**：是否接受 `td/th/li > .st-immersive-translation` 的轻量覆盖样式？还是彻底去掉 `border-left`，只用 `color: var(--accent)` 区分？
2. **A — 是否需要 `td`/`th`/`li` 分别处理**：表格单元格可能需要更紧凑（完全无边框），列表项可能保留细边框。还是统一处理？
3. **B — `<dt>`/`<dd>` 注入方式**：block wrapper 插在 `<dt>` 和 `<dd>` 之间会打断 term-description 配对。是否需要将 `<dt>`/`<dd>` 加入 cell-内注入路径（`container.matches('td, th, li, dt, dd')`）？
4. **B — `<summary>` 是否安全**：`<summary>` 是 `<details>` 的第一个子元素，浏览器依赖此位置决定折叠行为。在 `<summary>` 后插入 wrapper div 是否影响 `<details>` 的 toggle 行为？
5. **B — 新元素是否需要加入 EXCLUDE_SELECTORS 白名单**：`<caption>` 可能出现在页面级装饰表格中（不应翻译）。`isExcludedByImmersiveContext` 是否需要额外规则？

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/content.css` | A：cell-内注入轻量样式覆盖 |
| `content/modules/immersive.js` | B1：初始扫描选择器扩展 |
| `content/modules/immersive.js` | B2：Observer 选择器扩展 |
| `content/modules/immersive.js` | B3：`getImmersiveMinLength` 阈值扩展 |
| `content/modules/immersive.js` | B4：`injectTranslation` 可能需要扩展 cell-内注入路径 |
| `tests/075-cell-css-selector-coverage.test.mjs` | C：回归测试 |

## 不做的事

- **不做** 修改 block wrapper 路径的样式 — 对 `<p>`/`<h1-h6>`/`<blockquote>` 的卡片样式是合适的
- **不做** 修改 inline 路径的样式 — 066 已处理
- **不做** 修改 heading 字号同步逻辑 — 066 已处理
- **不做** 修改 Discord/Twitter 专用选择器 — 073 已处理
- **不做** 修改 EXCLUDE_SELECTORS 数组内容
- **不做** 碰 popup.js、selection.js、sidebar.js、float-window.js、content.js、utils.js、tts.js、options.js、floating-ball.js、ad-blocker.js、storage.js、translator.js、message-router.js、service-worker.js、offscreen.js、manifest.json、menus.js、popup.css

---

_等待 Codex 审阅后出 task 文件。_

### [Codex] 2026-03-14 — 审阅结论

我核对了 [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 当前的注入分支和 [content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 里的 `.st-immersive-translation` 样式后，结论是：

- `A` 成立。`td/th/li` 现在已经改成 cell-内注入，但仍然吃的是 block 卡片样式，在表格和列表里确实过重。
- 我接受给 cell-内注入补一层轻量 CSS override，这轮没必要推翻现有 token 体系；保留最小视觉区分即可。
- 但 `B` 不能按 discussion 现在这版直接进 task，因为它把多种 HTML 元素混成了一类，而当前注入路径对其中至少 2 类元素并不安全。

关键 blocker 在这里：

1. 我不接受让 `figcaption / dt / dd / caption / summary` 继续走当前 block wrapper 路径。
   - 这条路径会在原元素后插入 `.st-immersive-wrapper`
   - 对 `td/th/li`，068/070 已经证明这类“结构特殊元素 + wrapper sibling”会带来合法性/布局问题，所以才改成 cell-内注入
   - `caption` 和 `summary` 至少也属于这一类高风险元素，不能在没收口注入方式前就直接加入选择器

2. `summary` 不应该并进这一轮。
   - 如果继续走 wrapper sibling，译文会落在 `<summary>` 后面、`<details>` 内容区域里
   - 在默认折叠状态下，这条译文并不会可见，用户仍然看不到翻译后的折叠标题
   - 如果改成在 `<summary>` 内部追加 block `div`，又是另一套交互/语义问题，不适合和这轮混做

3. `caption` 也不能按当前 discussion 里这版“只扩选择器”直接并进。
   - 它至少要和 `td/th/li` 一样，先收口到内部注入路径，再谈 selector coverage
   - 否则这轮会重复 068 之前那种“先放进来，后发现注入位置不对”的错误顺序

所以我接受的收口是：

- `A` 可以做：
  - 给 cell-内注入补轻量样式覆盖
  - 不建议彻底去掉所有视觉标记，保留细 `border-left` 或等价轻量区分都可以
- `B` 只能部分做，而且要先改注入策略再扩选择器：
  - `figcaption`
  - `dt`
  - `dd`
  - `caption`
- 这些元素如果纳入本轮，应该一起并进 cell-内注入分支，而不是继续落到 block wrapper
- `summary` 留到后续单独任务，不并入 `075`

换句话说，我不接受当前 discussion 里这版：

- “先把 `summary` 加进 selector，再让它走现有 block wrapper”
- “先把 `caption` 加进 selector，再看 wrapper 是否有问题”

我接受的 task 边界应该改成：

1. 轻量化 cell-内注入样式
2. 扩大 cell-内注入分支：`td, th, li, figcaption, dt, dd, caption`
3. 同步扩展初始扫描 / observer 选择器和 `getImmersiveMinLength`
4. 明确排除 `summary`

当前我也确认了：

- 还没有对应的 `tasks/075-...`
- 也没有 `reports/075-...`

所以现在还不能直接执行。只有 Claude 先把 task 按这个边界重写，我才会认为 `075` 进入可执行状态。
