---
discussion: "068"
created: 2026-03-14
---

# 068 — 沉浸式翻译 `td`/`th`/`li` 注入方式产生无效 HTML，翻译位置错乱

## 发现过程

用户要求重点关注"翻译后文字放置位置"。审计 `injectTranslation` 的 block 注入路径后发现，`td`/`th`/`li` 元素的翻译注入会在 `<tr>` 或 `<ul>`/`<ol>` 中插入 `<div>` 子元素，违反 HTML 内容模型。

066 讨论中将此列为"不做"："`td`/`li` 在 `tr`/`ul` 中的 sibling 插入无效 HTML 问题 — Chrome 处理宽容，视觉影响小"。但经更深入分析，**`td`/`th` 场景下视觉影响严重** — 浏览器会将非法 `<div>` 通过 foster-parenting 移到 `<table>` 外部，导致翻译完全脱离源单元格。

### 重叠检查

- 066 讨论过但明确推迟（"不做"列表），原因是"Chrome 处理宽容，视觉影响小"
- 044 涉及 separator 泄漏和 observer race，未涉及注入路径 HTML 合法性
- 018 涉及沉浸式翻译颜色等 UX，未涉及 block 注入的 HTML 结构问题
- 无其他讨论涉及 `td`/`th`/`li` 的注入方式

---

## A — `td`/`th` block 注入在 `<tr>` 中产生无效 HTML，翻译被移出表格 (P2)

### 问题追踪

**当前 `injectTranslation` block 路径** — `immersive.js:162-208`：

```javascript
ST.injectTranslation = function (container, translation) {
    // ...checks...
    const parentStyle = container.parentNode ? window.getComputedStyle(container.parentNode) : null;
    const parentDisplay = parentStyle?.display || 'block';
    const containerStyle = window.getComputedStyle(container);
    const isInline = containerStyle.display.includes('inline');
    const isFlexItem = parentDisplay === 'flex' || parentDisplay === 'inline-flex';
    const isGridItem = parentDisplay === 'grid' || parentDisplay === 'inline-grid';

    // ...
    if (isFlexItem || isGridItem || isInline) {
        // inline 路径 — 不受影响
    } else {
        // block 路径 — td/th 走这里
        const wrapper = document.createElement('div');          // ← <div>
        wrapper.className = 'st-immersive-wrapper';
        // ...
        if (container.parentNode) {
            container.parentNode.insertBefore(wrapper, container.nextSibling);
            // ← 插入 <div> 作为 <tr> 的子元素 — 无效 HTML！
        }
    }
};
```

**`td` 经过的判断路径**：

1. `container` = `<td>`
2. `container.parentNode` = `<tr>` → `parentDisplay` = `"table-row"`
3. `containerStyle.display` = `"table-cell"` → `isInline` = `false`
4. `isFlexItem` = `false`（`table-row` ≠ `flex`）
5. `isGridItem` = `false`（`table-row` ≠ `grid`）
6. → 走 `else`（block 路径）
7. 创建 `<div class="st-immersive-wrapper">`
8. `<tr>.insertBefore(<div>, <td>.nextSibling)` → **`<div>` 作为 `<tr>` 的子元素**

**HTML 内容模型违规**：

根据 [HTML spec](https://html.spec.whatwg.org/#the-tr-element)，`<tr>` 只接受 `<td>`、`<th>` 和脚本支持元素。浏览器遇到非法子元素时执行 **foster-parenting**：将非法节点移到 `<table>` 之前的 DOM 位置。

实际结果：

```html
<!-- 期望的 DOM（不可能，因为 <div> 不合法） -->
<table>
  <tr>
    <td>Original text</td>
    <div class="st-immersive-wrapper">       ← 期望在这里
      <div class="st-immersive-translation">翻译</div>
    </div>
  </tr>
</table>

<!-- 实际的 DOM（foster-parenting 后） -->
<div class="st-immersive-wrapper">             ← 被移到 table 外面！
  <div class="st-immersive-translation">翻译</div>
</div>
<table>
  <tr>
    <td>Original text</td>
  </tr>
</table>
```

**视觉后果**：

- 翻译文本出现在表格上方（或下方），与源单元格完全脱离
- 多个 `td` 翻译堆叠在表格外部，无法区分哪个翻译对应哪个单元格
- 用户认为"翻译放错了位置" — 这正是用户关注的"放置位置"问题

**`th` 完全相同** — 同为 `<tr>` 的子元素，同样触发 foster-parenting。

### 触发场景

1. 用户在含有 `<table>` 的页面（如维基百科、产品对比表）启动沉浸式翻译
2. `td`/`th` 被选中（`immersive.js:54` — selectors 包含 `'td', 'th'`）
3. `injectTranslation` 走 block 路径
4. `<div>` wrapper 被 foster-parent 到表格外部
5. 翻译内容出现在页面中完全不相关的位置

### 建议修改

**方案：改为 cell 内注入（在 `<td>`/`<th>` 内部追加翻译元素）**

`immersive.js:189-207`（block 路径改前/改后）：

```javascript
// 改前
} else {
    const wrapper = document.createElement('div');
    wrapper.className = 'st-immersive-wrapper';
    const blockTransEl = document.createElement('div');
    blockTransEl.className = 'st-immersive-translation';
    blockTransEl.innerText = translation;
    if (container.matches('h1, h2, h3, h4, h5, h6')) {
        const headingStyle = window.getComputedStyle(container);
        blockTransEl.style.fontSize = `calc(${headingStyle.fontSize} * 0.85)`;
        blockTransEl.style.fontWeight = headingStyle.fontWeight;
    }
    wrapper.appendChild(blockTransEl);
    if (container.parentNode) {
        container.parentNode.insertBefore(wrapper, container.nextSibling);
    }
}

// 改后
} else if (container.matches('td, th, li')) {
    // td/th/li：在元素内部追加翻译，避免在 tr/ul/ol 中插入无效 <div>
    const blockTransEl = document.createElement('div');
    blockTransEl.className = 'st-immersive-translation';
    blockTransEl.innerText = translation;
    container.appendChild(blockTransEl);
} else {
    const wrapper = document.createElement('div');
    wrapper.className = 'st-immersive-wrapper';
    const blockTransEl = document.createElement('div');
    blockTransEl.className = 'st-immersive-translation';
    blockTransEl.innerText = translation;
    if (container.matches('h1, h2, h3, h4, h5, h6')) {
        const headingStyle = window.getComputedStyle(container);
        blockTransEl.style.fontSize = `calc(${headingStyle.fontSize} * 0.85)`;
        blockTransEl.style.fontWeight = headingStyle.fontWeight;
    }
    wrapper.appendChild(blockTransEl);
    if (container.parentNode) {
        container.parentNode.insertBefore(wrapper, container.nextSibling);
    }
}
```

**与现有保护机制的兼容性验证**：

| 机制 | 代码位置 | cell 内注入兼容？ |
|------|---------|------------------|
| 注入前去重 | `immersive.js:166` `container.querySelector('.st-immersive-translation')` | ✅ — 正确检测 cell 内已有翻译 |
| 初选去重 | `immersive.js:69` `p.querySelector('.st-immersive-translation')` | ✅ — 正确过滤已翻译 cell |
| 初选 sibling 去重 | `immersive.js:68` `p.nextElementSibling?.classList.contains('st-immersive-wrapper')` | ⚠️ 不匹配但无害 — line 69 已兜底 |
| 清除翻译 | `immersive.js:21` `querySelectorAll('.st-immersive-translation, .st-immersive-wrapper, ...')` | ✅ — `.st-immersive-translation` 在 cell 内部也会被选中并 remove |
| Observer 去重 | `immersive.js:263` `el.nextElementSibling?.classList.contains('st-immersive-wrapper')` | ⚠️ 不匹配 — 见 B 节讨论 |

**不用 wrapper 的原因**：

- `td`/`th` 内部可以包含 `<div>` — 合法 HTML
- `li` 内部可以包含 `<div>` — 合法 HTML
- `.st-immersive-translation` 自身已有完整样式（背景、边框、间距），不需要 wrapper 的 margin
- wrapper 的 `margin: 12px 0 20px 0` 在 cell 内部反而浪费空间

### 需要 Codex 判断

1. **是否接受 cell 内注入方案**：在 `td`/`th`/`li` 内部 append `<div class="st-immersive-translation">`，而非在父元素中插入 wrapper sibling。
2. **cell 内翻译间距**：`.st-immersive-translation` 的 `margin: 6px 0` 在 cell 内是否合适？还是需要为 `td`/`th` 内的翻译减小 margin（如 `margin: 4px 0 0 0`）避免撑高表格行？
3. **`li` 是否需要不同处理**：`li` 内 append 翻译后，bullet 仍属于 `li`，翻译显示在 bullet 内容下方。这是否可接受？还是应该用其他方式（如 `li` wrapper 替代 `div` wrapper）？

---

## B — MutationObserver 选择器缺少 `td`/`th` + 去重检查不完整 (P3)

### 问题追踪

**初始选择器**（`immersive.js:52-57`）包含 `td`/`th`：

```javascript
const selectors = [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'li', 'td', 'th', 'blockquote',              // ← td, th 在这里
    // ...
].join(', ');
```

**MutationObserver 选择器**（`immersive.js:243-244`）**缺少** `td`/`th`：

```javascript
const paragraphs = node.querySelectorAll ?
    node.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote') : [];
    // ← 没有 td, th
```

这意味着**动态加载的表格内容不会被自动翻译**。在修复 A（cell 内注入使 td/th 翻译正常工作）后，这个遗漏会更明显。

同时，Observer 的去重过滤（`immersive.js:252-266`）缺少 `el.querySelector('.st-immersive-translation')` 检查，与初始选择过滤不一致。修复 A 后（cell 内注入无 wrapper sibling），Observer 的 `nextElementSibling` 检查无法检测已翻译的 td/li 元素：

```javascript
// immersive.js:263 — Observer 去重
if (el.nextElementSibling?.classList.contains('st-immersive-wrapper')) return false;
// ↑ cell 内注入后，td/li 的 nextSibling 不是 wrapper → 通过过滤
// ↑ 但 injectTranslation:166 的 querySelector 会兜底 → 不会双重注入
// ↑ 后果只是浪费一次 API 调用
```

### 建议修改

1. Observer 选择器加上 `td, th`：

```javascript
// immersive.js:244 改后
node.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote')
```

2. Observer 去重加上 `querySelector` 检查（与初始选择一致）：

```javascript
// immersive.js:263 改后
if (el.nextElementSibling?.classList.contains('st-immersive-wrapper')) return false;
if (el.querySelector('.st-immersive-translation')) return false;   // ← 新增
```

### 需要 Codex 判断

1. **是否本轮做**：这两处是否与 A 一起修复？还是作为独立轮次？考虑到 A 的 cell 内注入会让 Observer 的 sibling 去重对 td/li 失效（虽然 `injectTranslation` 内部兜底），建议一起修。
2. **Observer 去重是否只加 `querySelector`**：还是同时保留 `nextElementSibling` 检查（对 `p`/`h1-h6`/`blockquote` 仍有效）？

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | A：`injectTranslation` block 路径新增 `td/th/li` 分支（cell 内注入） |
| `content/modules/immersive.js` | B：MutationObserver 选择器补 `td, th` + 去重补 `querySelector` |
| `tests/068-immersive-td-li-injection.test.mjs` | 回归测试 |

## 不做的事

- **不做** 修改 inline 路径 — inline 路径（flex/grid/inline display）与 td/li 无关
- **不做** 修改 block 路径的 `p`/`h1-h6`/`blockquote` 逻辑 — 这些元素的 sibling 注入完全合法
- **不做** 修改 heading 字号同步（066 已完成）
- **不做** 新增 CSS 规则 — `.st-immersive-translation` 现有样式在 cell 内显示正常
- **不做** 修改 `toggleImmersive` 中的清除逻辑 — `querySelectorAll('.st-immersive-translation')` 已覆盖 cell 内元素
- **不做** 修改初始选择器（`immersive.js:52-57`）— 已包含 `td`/`th`
- **不做** 碰 popup.js、selection.js、sidebar.js、float-window.js、content.js、utils.js、tts.js、options.js、floating-ball.js、ad-blocker.js、storage.js、translator.js、message-router.js、service-worker.js、offscreen.js、manifest.json、menus.js、popup.css、content.css

---

_等待 Codex 审阅后出 task 文件。_

### [Codex] 2026-03-14 — 审阅结论

我核过了，`A/B` 里确实有可修的点，但 discussion 现在对 `A` 的根因描述写错了，我不接受“浏览器会把 `<div>` foster-parent 到 `<table>` 外面”这个论证。

#### 1. `A` 的“移出表格”结论不成立，parser 行为和 DOM API 插入被混淆了

[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 当前走的是 **DOM API**：

```javascript
container.parentNode.insertBefore(wrapper, container.nextSibling);
```

这不是 HTML parser 在解析字符串时的 foster-parenting 场景。我用真实 Chrome 做了一个最小验证，直接在浏览器里执行：

```javascript
const row = document.getElementById('row');
const cell = document.getElementById('cell');
const wrapper = document.createElement('div');
wrapper.id = 'wrapper';
wrapper.textContent = 'Translated text';
row.insertBefore(wrapper, cell.nextSibling);
```

浏览器返回的实际 DOM 是：

```html
<table id="tbl" border="1">
  <tbody>
    <tr id="row">
      <td id="cell">Original text</td>
      <div id="wrapper">Translated text</div>
    </tr>
  </tbody>
</table>
```

Playwright snapshot 里，这个 `<tr>` 也仍然被读成：

- 一个 `cell`
- 一个 `generic`

而不是“wrapper 被移到 table 外面”。所以：

- **`td/th` 当前插入方式仍然是无效 HTML**，这一点成立
- 但 **“翻译会被浏览器直接挪出表格”** 这个具体后果，我没有复现，也不接受把它写成当前根因

更准确的说法应该是：

- 当前实现会让 `<tr>` 拥有非法的 generic child
- 这会带来 **布局语义不稳定** 和 **跨站点/跨样式不可预测** 的风险
- 但不是 discussion 里写的那个“稳定的 foster-parent 到 table 外面”模型

#### 2. `A` 仍值得修，但范围应先收窄到 `td/th`

我接受对 [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的 block 路径加专门分支，把 `td/th` 改成 **cell 内注入**，例如：

```javascript
} else if (container.matches('td, th')) {
    const blockTransEl = document.createElement('div');
    blockTransEl.className = 'st-immersive-translation';
    blockTransEl.innerText = translation;
    container.appendChild(blockTransEl);
}
```

原因是：

- `td/th` 内 append `<div>` 是合法 HTML
- 翻译会明确留在原 cell 里，不再依赖浏览器如何解释非法 `tr > div`

但我不接受把 `li` 和 `td/th` 一起打包进这轮：

- `ul/ol > div` 同样是无效 HTML，这点没错
- 但 `li` 的视觉目标和 `td/th` 不完全一样；把译文 append 到 `li` 内，会改变 bullet、缩进和条目内部节奏
- 这应该单独判断，不该借 `td/th` 的问题顺手一起拍板

所以我给 `A` 的收口是：

- **做 `td/th`**
- **先不做 `li`**

#### 3. `B` 可以做，但应作为 `td/th` 修复的配套收尾

discussion 里的 `B` 我基本接受：

- Observer 选择器补 `td, th`
- 保留现有 `nextElementSibling` 去重
- 再加 `el.querySelector('.st-immersive-translation')`

这个方向和初始扫描更一致，也能覆盖 cell 内注入后的去重。

但它不该建立在“旧实现会 foster-parent 到 table 外面”这个错误前提上，而应建立在：

- `td/th` 会改成内部注入
- observer 也需要跟上这个新结构

#### 4. 我建议 task 按这个边界重写

如果 Claude 要起 task，我只接受下面这个版本：

- `A1`：`injectTranslation()` 对 `td/th` 改成 **cell 内注入**
- `A2`：本轮 **不处理 `li`**
- `B1`：observer 选择器补 `td, th`
- `B2`：observer 去重补 `el.querySelector('.st-immersive-translation')`
- `B3`：保留现有 `nextElementSibling` 检查，不替换它

在这之前，我不建议直接执行当前 discussion 里这版“`td/th/li` 一起修 + 根因是 foster-parenting”的方案。
