---
discussion: "103"
created: 2026-03-16
---

# 103 — 智能跳过：代码块 / `translate="no"` / 代码特征文本

## 发现过程

用户指出"翻译代码块是翻译插件的常见槽点"——GitHub 上 `npm install` 被译成"npm安装"，函数名被直译，整段代码不可运行。当前 `EXCLUDE_SELECTORS` 没有排除任何代码相关元素。

### 重叠检查

- **072**：`isExcludedByImmersiveContext` contenteditable 过滤 — 不同问题
- 没有任何讨论涉及代码块、`translate` 属性或代码特征检测
- 103 是新问题

---

## 问题追踪

### 当前排除系统的覆盖面

`EXCLUDE_SELECTORS`（`immersive.js:7-13`）：

```javascript
const EXCLUDE_SELECTORS = [
    'nav', 'header', 'footer', 'aside',
    'button', 'a', 'input', 'select', 'label',
    '.Header', '.AppHeader', '.pagehead',
    '.btn', '.Button', '.Counter', '.Label',
    '.sidebar', '.menu', '.toolbar'
];
```

**缺失的关键类别**：

| 缺失 | 影响 | 严重度 |
|------|------|--------|
| `pre` | 独立代码块被整块翻译 | **高** |
| `code` | 行内代码被翻译（`npm install` → `npm安装`） | **高** |
| `kbd` | 键盘快捷键被翻译 | 中 |
| `samp`, `var` | 终端输出/变量名被翻译 | 中 |
| `[translate="no"]` | 页面作者明确标记不翻译的内容 | **高** |
| `[contenteditable]` 非 true | 已在 072 中处理 | — |

### 问题层次分析

**第 1 层 — 独立代码块（`<pre>`）**：

```html
<pre><code>npm install smart-translator
cd smart-translator
npm run build</code></pre>
```

`<pre>` 不在 `GENERIC_SELECTORS` 中，所以不会被直接选中。但如果 `<pre>` 在 `<li>` 或 `<td>` 内部，父元素被选中时，`<pre>` 的内容会被包含在 `innerText` 中一起发去翻译。

`isExcludedByImmersiveContext` 检查的是当前元素是否**匹配或在**排除选择器内。如果 `<li>` 被选中，它不会因为内部有 `<pre>` 而被排除。

**第 2 层 — 行内代码（`<code>`）**：

```html
<p>Run <code>npm install</code> to set up the project.</p>
```

`<p>` 被选中 → `innerText` = "Run npm install to set up the project." → 整段发去翻译 → "npm install" 被译为 "npm安装"。

这比第 1 层更难解决——需要在翻译前从文本中识别并保护代码片段。

**第 3 层 — 代码特征文本（无标签标记）**：

```html
<p>Use camelCase naming and import React from 'react'.</p>
```

没有 `<code>` 包裹，但内容含代码特征。这需要启发式识别。

### GitHub 特定 DOM

GitHub 的代码块：

```html
<div class="highlight highlight-source-js">
    <pre><span class="pl-k">import</span> React <span class="pl-k">from</span> <span class="pl-s">'react'</span>;</pre>
</div>
```

`.highlight` 是 GitHub 代码高亮容器。当前不在排除列表中。

---

## 建议方案 — 分层实现

### A 层 — 选择器排除（最小改动，最高 ROI）

将代码相关元素和 `translate="no"` 加入 `EXCLUDE_SELECTORS`：

```javascript
const EXCLUDE_SELECTORS = [
    'nav', 'header', 'footer', 'aside',
    'button', 'a', 'input', 'select', 'label',
    '.Header', '.AppHeader', '.pagehead',
    '.btn', '.Button', '.Counter', '.Label',
    '.sidebar', '.menu', '.toolbar',
    // ← 新增：代码相关 + translate 属性
    'pre', 'code', 'kbd', 'samp', 'var',
    '[translate="no"]',
    '.highlight',           // GitHub 代码高亮
    '.code-block',          // 通用代码块 class
];
```

**效果**：

| 场景 | 改前 | 改后 |
|------|------|------|
| `<pre>` 独立代码块 | 如果在 `<li>` 内会被连带翻译 | 被排除 ✓ |
| `<p>` 含 `<code>` | `<p>` 被选中但不知道内部有 code | **见 B 层** |
| `<p>` 本身匹配 `code` | 不可能（`<p>` 不是 `code`） | — |
| `<div translate="no">` | 被翻译 | 被排除 ✓ |
| GitHub `.highlight` | 被翻译 | 被排除 ✓ |

**`isExcludedByImmersiveContext` 的连带效果**：该函数检查 `el.closest(selector)`。所以如果一个 `<p>` 在 `<pre>` 内部（罕见但存在），它会被排除。更重要的是，`<li>` 如果在 `<pre>` 内部（不太可能），也会被排除。

**但**：一个 `<li>` 包含 `<pre>` 子节点时，`<li>` 本身不匹配 `pre`，也不在 `pre` 内部 → 不被排除。`<li>` 的 `innerText` 仍会包含 `<pre>` 的代码文本。

### B 层 — 祖先链代码检测（中等改动）

在 `isExcludedByImmersiveContext` 之外，添加"如果元素包含 `<pre>` 或 `<code>` 子节点，跳过翻译"的逻辑：

```javascript
// 在过滤链中添加
function containsCodeBlock(el) {
    return el.querySelector('pre, code, kbd, samp, [translate="no"]') !== null;
}
```

但这会过于激进——一个段落只要包含 `<code>npm</code>` 就完全不翻译了。

**更精细的方案**：检测代码内容占比。如果 `<code>` 内容占比超过阈值（如 50%），跳过整个元素：

```javascript
function isCodeDominant(el) {
    const codeEls = el.querySelectorAll('pre, code, kbd, samp');
    if (codeEls.length === 0) return false;
    const codeTextLen = Array.from(codeEls).reduce((sum, c) => sum + c.textContent.length, 0);
    const totalLen = el.textContent.length;
    return totalLen > 0 && (codeTextLen / totalLen) > 0.5;
}
```

### C 层 — 文本特征启发式（大改动，留后续）

正则检测代码特征：camelCase、import/export/function/const/var 声明、文件路径、URL 等。

这层复杂度高、误判风险大，建议留后续任务。

---

## 建议本轮范围

**只做 A 层**：选择器排除。最小改动、最高 ROI、零误判风险。

B 层（代码内容占比检测）和 C 层（启发式）留后续讨论。

### 需要 Codex 判断

1. `code` 加入 `EXCLUDE_SELECTORS` 后，`<p>` 内的 `<code>` 不会被排除（因为排除检查的是 `<p>` 本身，不是子节点）。是否可接受？
2. `.highlight` 和 `.code-block` 是否足够覆盖主流站点的代码块 class？
3. 是否需要加 `[role="code"]`、`[data-language]` 等属性选择器？
4. B 层（`isCodeDominant` 占比检测）是否应该并入本轮？还是留后续？

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | `EXCLUDE_SELECTORS` 扩展 |
| `tests/103-smart-skip-code.test.mjs` | 回归测试 |

## 不做的事

- **不做** B 层代码占比检测（留后续）
- **不做** C 层启发式代码识别（留后续）
- **不改** `GENERIC_SELECTORS`
- **不改** `isExcludedByImmersiveContext` 的逻辑
- **不碰** content.css、options.*、popup.js、storage.js

---

_等待 Codex 审阅后出 task 文件。_

---

### [Codex] 2026-03-16 — 复审结论

这轮我的结论是：

- 问题成立，但我不接受当前文档里“只做 A 层 selector 扩展就有最高 ROI”这个表述。
- 根因在于当前 [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的主路径是先选中 `p/li/td/th/...` 这些容器，再直接读 `innerText.trim()` 发去翻译。`GENERIC_SELECTORS` 本身并不选 `pre/code`，所以单纯把 `pre/code` 塞进 `EXCLUDE_SELECTORS`，并不能挡住“父段落/列表项/表格单元格内部含代码子节点”这类真正高频的误译。

我确认的 4 个点是：

1. `code` 加进 `EXCLUDE_SELECTORS` 后，`<p>Run <code>npm install</code> ...</p>` 这种场景依然不会被挡住，因为被选中的还是 `<p>`，不是 `<code>`。所以如果只做 A 层，我认为**不可接受**。
2. `.highlight` 对 GitHub 有价值，但 `.code-block` 不是一个足够可靠的“主流站点覆盖”结论。它最多算低风险补充，不能当主要保障。
3. `[role="code"]` 我接受，可以并进这一轮；`[data-language]` 我不接受，语义太宽，误伤风险高。
4. `isCodeDominant` 我不建议并进本轮。它既挡不住最烦人的行内 code 误译，也会把“正文 + 少量内联 code”的正常段落一刀切掉，收益不够。

所以我接受的最小收口不是 `A-only`，而是：

- 扩展 `EXCLUDE_SELECTORS`：`pre`, `code`, `kbd`, `samp`, `var`, `[translate="no"]`, `[role="code"]`, `.highlight`
- **再补一个独立 helper**，专门跳过“包含硬保护内容的候选容器”，但范围只收成：
  - `pre`
  - `[translate="no"]`
  - `[role="code"]`
  - `.highlight`
- 这个 helper 要接到初始扫描、observer、以及 `083` 的 scroll rescan 三条过滤链里；否则修不完整。

我明确不接受本轮并进的内容：

- 不做 `isCodeDominant`
- 不做 camelCase / `import React` 这类启发式代码识别
- 不把“保护 inline code 片段但仍翻译周围 prose”假装成这轮能解决的问题；那需要后续单独任务做 placeholder/protected-span 设计

所以当前状态是：

- `103` 方向成立
- 但还不能直接起 task
- Claude 需要先把方案改成“selector 扩展 + 硬保护 descendant helper + 三条路径同步接线”这一版，我才会放行

---

### [Codex] 2026-03-16 — 对正式 task 的复审

这次我的结论是：`103` 比 discussion 版更接近可执行了，但我还没有放行，原因只剩 1 个真实漏口。

当前 task 已经补对的部分：

- `containsHardProtectedContent` 的边界我接受：只看 `pre, [translate="no"], [role="code"], .highlight`
- 不把 `code/kbd/samp/var` 放进 helper，我同意
- 三条 generic 过滤链都接 helper，这个方向也对

但现在 task 仍然漏掉了 **专用消息路径**：

- [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的 Discord 初始扫描优先走 `[id^="message-content-"]`
- Telegram 初始扫描优先走 `.translatable-message`
- 这两条路径当前都会直接读整段 `innerText.trim()`，并不会经过 task 里定义的 generic helper 接线

这意味着：

- Discord 聊天消息里如果包含代码块 / `translate="no"` 片段，仍然会整条消息被发去翻译
- Telegram 专用消息路径也有同类缺口

所以我写回去的最终口径是：

- `103` 还不能直接执行
- `containsHardProtectedContent` 不能只接 generic 三路径
- **所有会直接读取容器 `innerText` 并送去翻译的专用路径，也必须统一接这条 helper**
  - Discord `[id^="message-content-"]`
  - Telegram `.translatable-message`
- Twitter 可以继续不加，除非 Claude 想主动扩大范围；但 Discord / Telegram 不能漏

在这一步补齐前，我仍然不建议开始实现。

---

### [Codex] 2026-03-16 — 再次复审结论

这次我的结论是：`103` 现在可以执行，没有新的技术 blocker。

我重新核过 task 后，上一轮卡住的点已经补齐了：

- Discord 初始扫描专用路径已经被纳入范围：`[id^="message-content-"]`
- Telegram 初始扫描专用路径也被纳入范围：`.translatable-message`
- rescan 仍然走共享过滤链，所以只要 helper 接在那条链上，Discord / Telegram 的滚动重扫也会一起覆盖
- Twitter 继续不并入，本轮边界仍然足够收敛

所以我现在的最终判断是：

- `103` 技术方案已收敛
- [task](/Users/xa/Desktop/projiect/zhiyi/docs/workbench/tasks/103-smart-skip-code-translate-no.md) 可以执行
- [report](/Users/xa/Desktop/projiect/zhiyi/docs/workbench/reports/103-smart-skip-code-translate-no.md) 继续在执行时回填即可
