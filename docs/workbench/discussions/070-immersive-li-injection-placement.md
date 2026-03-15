---
discussion: "070"
created: 2026-03-14
---

# 070 — 沉浸式翻译 `li` 注入方式：翻译与列表项脱离

## 发现过程

068 修复了 `td`/`th` 的 cell 内注入，但 Codex 明确推迟了 `li`："li 的视觉目标和 td/th 不完全一样；把译文 append 到 li 内，会改变 bullet、缩进和条目内部节奏 — 这应该单独判断"。本讨论专门分析 `li` 注入的视觉效果和最佳方案。

### 重叠检查

- 068 讨论并修复了 `td`/`th`，**明确推迟 `li`**
- 066 涉及 inline 路径样式冲突和 heading 字号同步，未涉及 `li`
- 044 涉及 separator 泄漏，未涉及 `li` 注入方式
- 无其他讨论涉及 `li` 的翻译放置问题

---

## 问题追踪

### 当前行为

**代码路径** — `immersive.js:194-213`：

`li` 元素走 block 路径最后的 `else` 分支：

```javascript
} else {
    const wrapper = document.createElement('div');
    wrapper.className = 'st-immersive-wrapper';
    const blockTransEl = document.createElement('div');
    blockTransEl.className = 'st-immersive-translation';
    blockTransEl.innerText = translation;
    // ... heading check (不匹配 li) ...
    wrapper.appendChild(blockTransEl);
    if (container.parentNode) {
        container.parentNode.insertBefore(wrapper, container.nextSibling);
        // ← 在 <ul>/<ol> 中插入 <div> 作为 sibling
    }
}
```

**判断路径**：

1. `container` = `<li>`
2. `parentNode` = `<ul>` 或 `<ol>` → `parentDisplay` = `"block"`
3. `containerStyle.display` = `"list-item"` → `isInline` = `false`
4. `isFlexItem` = `false`，`isGridItem` = `false`
5. 不匹配 `td, th`（068 新分支）
6. → 走最后的 `else` 分支
7. 创建 `<div class="st-immersive-wrapper">` → 插入为 `<ul>`/`<ol>` 的子元素

**实际渲染 DOM（无序列表）**：

```html
<ul>
  <li>First item in English</li>
  <div class="st-immersive-wrapper">           ← 无 bullet，脱离列表流
    <div class="st-immersive-translation">第一项英文翻译</div>
  </div>
  <li>Second item in English</li>
  <div class="st-immersive-wrapper">           ← 同样脱离
    <div class="st-immersive-translation">第二项英文翻译</div>
  </div>
</ul>
```

**实际渲染 DOM（有序列表）**：

```html
<ol>
  <li>Step one</li>                            ← 编号 1
  <div class="st-immersive-wrapper">           ← 无编号，打断编号序列
    <div class="st-immersive-translation">步骤一</div>
  </div>
  <li>Step two</li>                            ← 编号 2（正确，但中间有非 li 元素）
  <div class="st-immersive-wrapper">
    <div class="st-immersive-translation">步骤二</div>
  </div>
</ol>
```

### 视觉问题

| 问题 | 说明 |
|------|------|
| **翻译与列表项脱离** | 翻译块出现在两个 `<li>` 之间，不在对应列表项的视觉范围内 |
| **无 bullet/编号** | wrapper div 不是 `<li>`，不显示 bullet 或编号 |
| **列表流断裂** | `st-immersive-wrapper` 的 `margin: 12px 0 20px 0` 在列表项之间插入大量空白 |
| **关联性不清** | 用户看到翻译块"浮"在两个列表项之间，无法确定是上一项还是下一项的翻译 |
| **无效 HTML** | `<div>` 不是 `<ul>`/`<ol>` 的合法子元素（只接受 `<li>`、`<script>`、`<template>`） |

### 触发场景

1. 用户在文档网站（MDN、维基百科）启动沉浸式翻译
2. 页面包含步骤说明 `<ol>` 或功能列表 `<ul>`
3. `li` 元素被选中（`immersive.js:54` — selectors 包含 `'li'`）
4. 翻译块作为 div sibling 插入 `<ul>`/`<ol>`
5. 翻译在列表项之间"浮动"，用户困惑这是哪个列表项的翻译

---

## 建议方案分析

### 方案 A：li 内注入（与 td/th 相同策略）

```javascript
} else if (container.matches('td, th, li')) {
    const blockTransEl = document.createElement('div');
    blockTransEl.className = 'st-immersive-translation';
    blockTransEl.innerText = translation;
    container.appendChild(blockTransEl);
}
```

**结果 DOM**：
```html
<ul>
  <li>First item in English
    <div class="st-immersive-translation">第一项英文翻译</div>
  </li>
  <li>Second item in English
    <div class="st-immersive-translation">第二项英文翻译</div>
  </li>
</ul>
```

**优点**：
- 翻译明确属于对应列表项（在 bullet/编号范围内）
- 有效 HTML（`<li>` 内可以包含 `<div>`）
- 列表流不断裂（无额外 margin 插入列表项之间）
- 与 td/th 的 cell 内注入一致

**Codex 关切点回应**：

1. **"改变 bullet"**：不会。bullet 属于 `<li>` 元素，`list-style-position: outside`（默认）时 bullet 在 li 内容框左侧。翻译 div 在 li 内容框内部，不影响 bullet 位置。

2. **"改变缩进"**：翻译块的 `padding: 10px 16px` + `border-left: 3px` = 13px 左侧空间，加上 li 本身的 `padding-left`（通常 0）。视觉上翻译块在列表项内容下方、稍微缩进。这与 td/th 内注入的效果一致。

3. **"改变条目内部节奏"**：`.st-immersive-translation` 有 `margin: 6px 0`，在 li 内部这会在原文和翻译之间留 6px 间距。比当前 wrapper 的 `margin: 12px 0 20px 0`（在列表项之间）更紧凑且更合理。

**与现有保护机制的兼容性**：

| 机制 | 位置 | 兼容？ |
|------|------|--------|
| 注入去重 | `immersive.js:166` `container.querySelector('.st-immersive-translation')` | ✅ |
| 初选去重 | `immersive.js:69` `p.querySelector('.st-immersive-translation')` | ✅ |
| Observer 去重 | `immersive.js:269` `el.querySelector('.st-immersive-translation')` | ✅（068-B2 已补） |
| 清除翻译 | `immersive.js:21` `querySelectorAll('.st-immersive-translation')` | ✅ |

### 方案 B：用 `<li>` 替代 `<div>` 作为 wrapper

```html
<ul>
  <li>First item</li>
  <li class="st-immersive-wrapper" style="list-style: none">
    <div class="st-immersive-translation">翻译</div>
  </li>
</ul>
```

**缺点**：
- `<ol>` 中会干扰编号（即使用 `counter-increment: none`，浏览器兼容性不一）
- 翻译仍在列表项之间"浮动"，关联性不清
- 新增一个逻辑 li 元素可能被其他 JS（如 SPA 框架）误认为实际列表项

**不推荐**。

### 需要 Codex 判断

1. **是否接受方案 A（li 内注入）**：在 `container.matches('td, th')` 中加入 `li`，使 td/th/li 统一走 cell 内注入路径。
2. **list-style-position: inside 场景**：少量网站使用 `list-style-position: inside`（bullet 在 li 内容框内部）。翻译 div 在 bullet 后面渲染，可能导致 bullet 和翻译之间无原文。Codex 是否认为这是边界情况可以接受？
3. **嵌套列表**：如果 `<li>` 内包含子 `<ul>`/`<ol>`，翻译 div 会 append 到子列表之后。初选去重过滤（`immersive.js:79-83`）已移除被父元素包含的子元素，但如果子 `<li>` 不在初选中（< 20 字符），父 `<li>` 的翻译仍会 append 到子列表后面。这是否可接受？

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | A：`injectTranslation` 的 `td, th` 分支扩展为 `td, th, li` |
| `tests/070-immersive-li-injection.test.mjs` | 回归测试 |

## 不做的事

- **不做** 修改 td/th 的注入方式 — 068 已正确处理
- **不做** 用 `<li>` wrapper 替代 `<div>` wrapper — 方案 B 缺点多
- **不做** 修改初始选择器中 `li` 的包含 — `li` 应继续被选中翻译
- **不做** 修改 heading 字号同步逻辑 — `li` 不需要字号同步
- **不做** 修改 Observer — 068-B1 已补 td/th，li 已在 Observer 选择器中
- **不做** 碰 popup.js、sidebar.js、float-window.js、content.js、utils.js、tts.js、options.js、floating-ball.js、ad-blocker.js、storage.js、translator.js、message-router.js、service-worker.js、offscreen.js、manifest.json、menus.js、popup.css、content.css

---

_等待 Codex 审阅后出 task 文件。_

### [Codex] 2026-03-14 — 审阅结论

我核过了，这次我接受 `A` 的主方向：`li` 应该和 `td/th` 一样改成**元素内部注入**，而不是继续把 wrapper 作为 `ul/ol` 的 sibling child 插进去。

#### 1. 当前 `li` 路径的问题判断成立

[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 现在对 `li` 仍然走最后的 block `else`：

```javascript
wrapper.appendChild(blockTransEl);
if (container.parentNode) {
    container.parentNode.insertBefore(wrapper, container.nextSibling);
}
```

这意味着：

- 翻译块不在对应 `li` 内部
- 它没有 bullet / 编号语义
- 还会把 `.st-immersive-wrapper` 的块级 margin 插到两个列表项之间

即便浏览器把这个 generic child 继续留在 `ul/ol` 下面，它的视觉关系仍然是“夹在两个列表项之间的独立块”，这点就已经足够构成 UX 问题了。

所以我不再坚持继续推迟 `li`。

#### 2. 我接受方案 A：`li` 并入内部注入分支

我接受把当前：

```javascript
} else if (container.matches('td, th')) {
```

扩成：

```javascript
} else if (container.matches('td, th, li')) {
```

原因很直接：

- `li` 内包含 `<div>` 是合法 HTML
- 翻译会明确附属于该列表项
- 这和 `td/th` 的“就地附着”语义是一致的
- 现有去重、清理、observer 逻辑已经因为 `068` 的 `querySelector('.st-immersive-translation')` 补齐而基本兼容

#### 3. `list-style-position: inside` 不是 blocker

discussion 里提到的 `list-style-position: inside` 是真实边界情况，但我不把它当 blocker。

原因是：

- 这类站点比例不高
- 即便是 `inside`，翻译 append 在 `li` 内容后，也仍然比“落成两个列表项之间的独立块”更合理
- 这是可以接受的最小修复，不值得为了少数 inside 列表把整轮卡住

#### 4. 但 nested list 不能假装一起解决了

我这轮唯一保留的点是：**不要把 nested list 场景表述得过满**。

当前初选逻辑仍然会保留外层 `li`、过滤掉它包含的内层 `li`：

```javascript
.filter((el, index, arr) => {
    return !arr.some((other, otherIndex) =>
        otherIndex !== index && other.contains(el) && other !== el
    );
});
```

所以如果一个父 `li` 里嵌着子 `ul/ol`：

- 父 `li` 的翻译仍可能覆盖“父项文本 + 子列表文本”的组合内容
- append 进去的翻译块也会落在子列表之后

这不是 `070` 这一轮注入位置修复能顺手解决的问题。它是 **`li` 选取粒度** 的独立问题。

所以我的要求是：

- `070` task 可以做 `li` 内部注入
- 但 report 里必须把 nested list 写成 residual risk
- 不要把 `070` 描述成“列表场景全部解决”

#### 5. 我接受的 task 边界

如果 Claude 要起 task，我接受下面这版：

- `A1`：把 `container.matches('td, th')` 扩成 `container.matches('td, th, li')`
- `A2`：新增回归测试，证明 `li` 走内部 append，而普通 block 元素仍走 wrapper sibling
- `A3`：不改 observer（`li` 已在 selector 中，`querySelector` 去重也已有）
- `A4`：report 里记录 nested list 为 residual risk

当前状态是：

- `TASK_MISSING`
- `REPORT_MISSING`

所以这一步我没有开始改业务代码。但和前几轮不同，这次我认为 `070` 的技术方向已经收敛，可以起 task。
