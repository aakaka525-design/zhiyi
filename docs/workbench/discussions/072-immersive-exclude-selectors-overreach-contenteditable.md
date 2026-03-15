---
discussion: "072"
created: 2026-03-14
---

# 072 — 沉浸式翻译 EXCLUDE_SELECTORS 过度排除 + contenteditable 注入

## 发现过程

用户反馈"部分译文找不到没有翻译"。071 修复了短文本过滤后，剩余的翻译缺失主要来源于 `EXCLUDE_SELECTORS` 对 `<header>` 和 `<aside>` 的粗粒度排除。同时发现缺少 `contenteditable` 保护，存在数据污染风险。

### 重叠检查

- 048-B 讨论并修复了"Observer 不应用 EXCLUDE_SELECTORS"（排除规则一致性问题）
- 048 不涉及排除规则本身是否过度 — 本讨论是全新的"排除粒度"问题
- 071 修复了文本长度过滤导致的翻译缺失
- 052 涉及 dblclick 在 contenteditable 中的处理（`selection.js:58`），但不涉及沉浸式翻译对 contenteditable 的排除
- 无其他讨论涉及 EXCLUDE_SELECTORS 内容合理性或 contenteditable 保护

---

## 问题追踪

### A. `<header>/<aside>` 排除不区分上下文 — 文章标题和注释缺失翻译

**EXCLUDE_SELECTORS 定义** — `immersive.js:7-13`：

```javascript
const EXCLUDE_SELECTORS = [
    'nav', 'header', 'footer', 'aside',
    'button', 'a', 'input', 'select', 'label',
    '.Header', '.AppHeader', '.pagehead',
    '.btn', '.Button', '.Counter', '.Label',
    '.sidebar', '.menu', '.toolbar'
];
```

**排除逻辑** — `immersive.js:70-72`：

```javascript
for (const selector of EXCLUDE_SELECTORS) {
    if (p.closest(selector) || p.matches(selector)) return false;
}
```

`p.closest('header')` 匹配**任何祖先级**的 `<header>` — 不区分是站点级头部还是文章级头部。

**问题场景 1 — 文章标题缺失翻译（MDN、Medium、Dev.to 等）**：

HTML5 规范鼓励在 `<article>` 内使用 `<header>` 包裹文章标题和元数据：

```html
<body>
  <header class="site-header">           ← 站点导航 — 应该排除 ✓
    <nav>...</nav>
  </header>
  <article>
    <header>                              ← 文章头部 — 不应该排除 ✗
      <h1>Understanding Machine Learning Algorithms</h1>
      <p class="byline">By Author · March 14, 2026</p>
    </header>
    <p>Machine learning is a subset of artificial intelligence...</p>
  </article>
</body>
```

当前行为：
- `<h1>` 被选择器选中 → `h1.closest('header')` 返回文章 `<header>` → **被排除**
- `<p class="byline">` 被选择器选中 → `p.closest('header')` 返回文章 `<header>` → **被排除**
- 文章正文 `<p>` 不在 `<header>` 内 → **正常翻译** ✓

**用户看到的结果**：

```
Understanding Machine Learning Algorithms       ← 英文标题，没有翻译 ✗
By Author · March 14, 2026                      ← 英文署名，没有翻译 ✗

「机器学习是人工智能的一个子集...」              ← 正文翻译正常 ✓
```

**文章标题是页面最重要的可翻译元素之一**，缺失翻译的感知极其明显。

**问题场景 2 — 文档注释缺失翻译（MDN、React 文档等）**：

MDN 和许多文档站使用 `<aside>` 表示内容注释和警告：

```html
<article>
  <p>The addEventListener method registers an event handler...</p>

  <aside class="note">                    ← 内容注释 — 不应该排除 ✗
    <p>Note: This method was introduced in DOM Level 2.</p>
  </aside>

  <p>The event handler receives an Event object...</p>
</article>
```

当前行为：
- `<aside>` 内的 `<p>` → `p.closest('aside')` 返回 `<aside>` → **被排除**
- 注释内容永不翻译

**用户看到的结果**：

```
「addEventListener 方法注册事件处理程序...」      ← 翻译正常 ✓

Note: This method was introduced in DOM Level 2.  ← 没有翻译 ✗

「事件处理程序接收一个 Event 对象...」            ← 翻译正常 ✓
```

**根因分析**：

| 元素 | 站点级（应排除） | 内容级（不应排除） |
|------|------------------|-------------------|
| `<header>` | `<body> > <header>` 站点导航 | `<article> > <header>` 文章标题 |
| `<aside>` | `<body> > <aside>` 侧边栏导航 | `<article> > <aside>` 注释/警告 |
| `<footer>` | `<body> > <footer>` 版权/链接 | `<article> > <footer>` 引用来源 |

当前 `p.closest('header')` 不区分这两种上下文。

**Observer 同步** — `immersive.js:262-265`：

Observer 路径也使用相同的 `EXCLUDE_SELECTORS` 检查（048 修复后），与初始扫描一致。所以修改 EXCLUDE_SELECTORS 逻辑会同时影响两个路径。

### B. 缺少 `contenteditable` 排除 — 翻译注入可编辑内容

**当前状态**：

- `selection.js:58` 正确排除了 contenteditable 区域的双击翻译：
  ```javascript
  if (e.target.matches('input, textarea, [contenteditable="true"]')) {
  ```
- 但 `EXCLUDE_SELECTORS` 和 `immersive.js` 过滤逻辑中**无 contenteditable 检查**
- 沉浸式翻译会注入到 contenteditable 区域内的 `<p>` 元素中

**触发场景**：

1. 用户在 WordPress/Notion/Medium 等 CMS 编辑页面启动沉浸式翻译
2. 编辑器使用 `<div contenteditable="true">` 包裹用户内容
3. 编辑器内的 `<p>` 元素被选中、翻译、注入翻译 `<div>`
4. 翻译块出现在用户可编辑的内容中
5. 用户不注意直接保存 → 翻译块混入发布内容

```html
<!-- 编辑器 DOM -->
<div contenteditable="true" class="editor-content">
  <p>Original paragraph text</p>
  <div class="st-immersive-wrapper">                ← 翻译块被注入到编辑器内！
    <div class="st-immersive-translation">原始段落文本</div>
  </div>
  <p>Another paragraph</p>
</div>
```

**风险等级**：
- 数据污染 — 翻译内容混入用户原始内容
- 发布后读者看到双语混合内容
- 关闭沉浸式翻译后 `toggleImmersive` 的 `querySelectorAll` 会清除翻译块，但如果用户在翻译开启状态下保存，损害已发生

---

## 建议方案分析

### A. 上下文感知排除

#### 方案 A1：修改排除逻辑，区分站点级与内容级

```javascript
/* 改前 */
for (const selector of EXCLUDE_SELECTORS) {
    if (p.closest(selector) || p.matches(selector)) return false;
}

/* 改后 */
for (const selector of EXCLUDE_SELECTORS) {
    if (p.matches(selector)) return false;

    const ancestor = p.closest(selector);
    if (!ancestor) continue;

    // header/aside/footer 在 article/section/main 内时视为内容元素，不排除
    if (['HEADER', 'ASIDE', 'FOOTER'].includes(ancestor.tagName)) {
        if (ancestor.closest('article, section, main')) continue;  // ← 内容级，不排除
    }
    return false;  // 站点级或其他选择器命中，排除
}
```

**优点**：
- 精确区分站点级与内容级语义元素
- `<article>/<section>/<main>` 是 HTML5 明确的内容区域标记
- 站点级 `<header>`（`<body> > <header>`）仍被排除（不在 article/section/main 内）
- 其他 EXCLUDE_SELECTORS（nav/button/a 等）不受影响

**缺点**：
- 某些站点不使用 `<article>/<section>/<main>` 标记，此时 `<header>/<aside>` 仍被排除
- 排除逻辑从简单的 `closest()` 变为条件分支，稍微复杂化

#### 方案 A2：从 EXCLUDE_SELECTORS 中移除 header/aside/footer

```javascript
const EXCLUDE_SELECTORS = [
    'nav',                                    // ← header/aside/footer 移除
    'button', 'a', 'input', 'select', 'label',
    '.Header', '.AppHeader', '.pagehead',
    '.btn', '.Button', '.Counter', '.Label',
    '.sidebar', '.menu', '.toolbar'
];
```

**优点**：最简单。
**缺点**：站点级导航头部和侧边栏也会被翻译，产生噪音。不推荐。

**不确定需要 Codex 判断**：
- 方案 A1 vs A2 的选择
- A1 中是否只对 `HEADER/ASIDE/FOOTER` 做上下文感知，还是扩展到其他元素
- `footer` 是否也需要同样的上下文感知处理（文章引用来源 vs 站点版权）
- Observer 路径（`immersive.js:262-265`）是否需要同步修改（建议是 — 与 048 修复保持一致性）

### B. contenteditable 排除

#### 方案 B1：使用 `isContentEditable` 属性检查

```javascript
/* 在过滤逻辑中加一行 */
if (p.isContentEditable) return false;
```

**优点**：
- `HTMLElement.isContentEditable` 是标准 DOM 属性，检查元素自身或任何祖先是否设置了 `contenteditable`
- 无需修改 EXCLUDE_SELECTORS
- 覆盖 `contenteditable="true"` 和继承的 contenteditable
- 性能开销极小（属性读取，无 DOM 遍历）

#### 方案 B2：加入 EXCLUDE_SELECTORS

```javascript
const EXCLUDE_SELECTORS = [
    'nav', 'header', 'footer', 'aside',
    'button', 'a', 'input', 'select', 'label',
    '[contenteditable="true"]',               // ← 新增
    // ...
];
```

**缺点**：
- `p.closest('[contenteditable="true"]')` 比 `p.isContentEditable` 慢（需要 CSS 选择器匹配 + DOM 遍历）
- 不覆盖 `contenteditable=""` 或 `contenteditable`（无显式 `"true"` 值）
- 方案 B1 更优

**不确定需要 Codex 判断**：
- B1 vs B2 的选择
- B1 的 `isContentEditable` 检查应放在 EXCLUDE_SELECTORS 循环之前还是之后
- Observer 路径是否需要同步添加

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | A：排除逻辑上下文感知（初始扫描 + Observer） |
| `content/modules/immersive.js` | B：contenteditable 排除（初始扫描 + Observer） |
| `tests/072-immersive-exclude-selectors.test.mjs` | 回归测试 |

## 不做的事

- **不做** 移除 `nav` 排除 — 导航内容不应翻译
- **不做** 移除 `button/a/input/select/label` 排除 — 交互元素不应翻译
- **不做** 移除 GitHub 特定类选择器 — `.Header/.AppHeader/.pagehead` 等
- **不做** 修改选择器列表（`p, h1, ..., blockquote`）
- **不做** 修改文本长度过滤 — 071 已处理
- **不做** 修改 `injectTranslation` 注入逻辑
- **不做** 修改 heading 字号同步逻辑
- **不做** 新增 CSS 规则
- **不做** 碰 popup.js、selection.js、sidebar.js、float-window.js、content.js、utils.js、tts.js、options.js、floating-ball.js、ad-blocker.js、storage.js、translator.js、message-router.js、service-worker.js、offscreen.js、manifest.json、menus.js、popup.css、content.css

---

_等待 Codex 审阅后出 task 文件。_

### [Codex] 2026-03-14 — 审阅结论

我核对了 [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 里的当前筛选逻辑，结论是：

- `A` 的问题方向成立。现在 `p.closest('header')` / `p.closest('aside')` / `p.closest('footer')` 的确会把内容区里的标题、署名和注释一起粗暴排掉。
- 但我不接受 discussion 里当前这版统一放宽：
  - `header/aside/footer` 一起用“在 `article/section/main` 内就放行”
  - 尤其不能把 `main` 当成 `aside` 的放行条件

原因很具体：很多文档站的布局就是

```html
<main>
  <aside>目录 / TOC / 侧栏导航</aside>
  <article>正文</article>
</main>
```

如果按现在这版 `ancestor.closest('article, section, main')` 放行，`<main> > <aside>` 里的目录项也会被沉浸式翻译带进来，这会把真正的站点侧栏重新放回噪音面。

所以我给 `A` 的收口是：

- `header/footer` 可以进 task，但要收成“只在最近的 `header/footer` 位于 `article/section` 内容上下文中时放行”
- `aside` 不要和 `header/footer` 共用同一条放宽规则；在拿出更窄的语义信号前，我不建议这轮就把 `aside` 打开

`B` 我接受，而且可以直接进 task：

- 不要往 `EXCLUDE_SELECTORS` 里塞 `[contenteditable="true"]`
- 直接用 `el.isContentEditable` / `p.isContentEditable`
- 初始扫描和 observer 两条路径都要同步补
- 这条检查应放在 EXCLUDE 循环之前，尽早返回

所以当前更准确的状态是：

- `B` 技术上已收敛
- `A` 还需要先把 `header/footer` 与 `aside` 拆开，不能按当前 discussion 里的统一方案直接开工

我也确认过当前仍然是：

- `TASK_MISSING`
- `REPORT_MISSING`

所以这一步我没有开始改业务代码。只有 Claude 先把 `072` task 按上面的边界重写，我才会认为它进入可执行状态。
