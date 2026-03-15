---
discussion: "067"
created: 2026-03-14
---

# 067 — Popup 和 Bubble 翻译结果丢失换行符

## 发现过程

用户要求重点关注翻译后文字排版。对比四个翻译结果渲染区域的 CSS 和 JS 渲染方式后，发现 popup 和 bubble 的换行符处理与 sidebar/float-window 不一致。

### 重叠检查

- 015 讨论了 sidebar 历史记录的 `white-space: nowrap` 截断问题（已修复）。未涉及翻译结果区域的 `white-space` 缺失。
- 从未讨论过 popup 或 bubble 的翻译结果换行渲染。

---

## A — Popup 翻译结果丢失换行符 (P2)

### 问题追踪

**渲染方式差异**：

| 模块 | JS 渲染 | CSS `white-space` | `\n` 是否保留 |
|------|---------|-------------------|---------------|
| Sidebar | `resultContent.innerText = text` | `pre-wrap` (`.st-result-text`) | ✅ `innerText` → `<br>` + `pre-wrap` 兜底 |
| Float-window | `resultText.innerText = text` | `pre-wrap` (`.st-float-result-text`) | ✅ 同上 |
| **Popup** | `innerHTML = escapeHtml(text)` | **无** | ❌ `escapeHtml` 不转 `\n` → `<br>`，无 `pre-wrap` |
| **Bubble** | `container.textContent = text` | **无** | ❌ `textContent` 不转 `\n` → `<br>`，无 `pre-wrap` |

**Popup 渲染路径** — `popup/popup.js:391-395`：

```javascript
function showResult(text) {
    elements.resultSection.classList.add('active');
    elements.resultSection.classList.remove('error-state');
    elements.resultContent.innerHTML = `<div class="result-text">${escapeHtml(text)}</div>`;
}
```

`escapeHtml`（`popup.js:617-621`）：

```javascript
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;   // ← \n 变成文本节点中的 \n
    return div.innerHTML;      // ← 输出为 HTML 实体，\n 保留为字面 \n（不是 <br>）
}
```

**Popup CSS** — `popup/popup.css:227-234`：

```css
.result-content {
    padding: 16px;
    max-height: 200px;
    overflow-y: auto;
    font-size: 15px;
    color: var(--text-primary);
    line-height: 1.7;
    /* 无 white-space: pre-wrap */
}
```

且 `.result-text` **完全没有 CSS 规则**——这个 class 在 `popup.css` 中不存在。

### 触发场景

1. 用户在 popup 中输入多行文本或一段英文段落
2. 选择 OpenAI/Gemini/DeepSeek 等 AI 翻译引擎
3. AI 返回带 `\n` 的结构化翻译（分段、列表等）
4. `escapeHtml` 将 `\n` 保留为 HTML 中的字面 `\n`
5. 浏览器渲染时将 `\n` 折叠为空格（默认 `white-space: normal`）
6. 用户看到单行连续文本，丢失所有段落结构

### 建议修改

**方案 1（最小 CSS 修复）**— 只加 `white-space: pre-wrap`：

`popup/popup.css:227-234`：
```css
.result-content {
    padding: 16px;
    max-height: 200px;
    overflow-y: auto;
    font-size: 15px;
    color: var(--text-primary);
    line-height: 1.7;
    white-space: pre-wrap;     /* ← 新增：保留 \n 换行 */
}
```

行为：`escapeHtml` 输出的 `\n` 在 `pre-wrap` 下渲染为换行符。无需改 JS。

**方案 2（统一渲染方式 + CSS）**— popup 改用 `innerText`，与 sidebar/float-window 一致：

`popup/popup.js:391-395`：
```javascript
// 改后
function showResult(text) {
    elements.resultSection.classList.add('active');
    elements.resultSection.classList.remove('error-state');
    elements.resultContent.innerText = text;
}
```

好处：
- `innerText` 将 `\n` 转为 `<br>` — 换行符直接可见
- 去掉 `escapeHtml` 调用（`innerText` 天然防 XSS）
- 去掉无用的 `.result-text` wrapper div
- 与 sidebar/float-window 渲染方式统一

CSS 仍建议加 `white-space: pre-wrap`，保留多空格等格式。

### 需要 Codex 判断

1. **方案 1 vs 方案 2**：方案 1 最小（只改 CSS），方案 2 更一致（统一渲染方式）。如果选方案 2，`showError` 函数（`popup.js:418-421`）是否也需要同步改为 `innerText`？
2. **`.result-text` wrapper div 是否保留**：如果选方案 2，`showResult` 不再创建 `.result-text` div。已有代码中是否有其他地方依赖 `.result-text` class？（经检查：popup.css 无此 class 的 CSS 规则，popup.js 无其他引用）

---

## B — Bubble 翻译结果丢失换行符 (P3)

### 问题追踪

`content/modules/selection.js:280-283` — `renderBubbleMessage`：

```javascript
function renderBubbleMessage(container, message, isError = false) {
    container.textContent = message;   // ← textContent 不转 \n → <br>
    container.style.color = isError ? 'var(--error)' : '';
}
```

`content/content.css:163-169` — `.st-bubble-result`：

```css
.st-bubble-result {
    max-height: 280px;
    overflow-y: auto;
    word-wrap: break-word;
    color: var(--text-primary);
    font-size: 15px;
    /* 无 white-space: pre-wrap */
}
```

### 影响范围

Bubble 通常处理短文本选择（< 2000 字符），多行翻译结果相对少见。但当用户划选包含多个段落的文本时，AI 翻译引擎返回的结果中 `\n` 同样会被折叠。

优先级 P3 低于 popup 的 P2，因为 bubble 的典型使用场景是短文本。

### 建议修改

`content/content.css:163-169` — `.st-bubble-result` 加 `white-space: pre-wrap`：

```css
.st-bubble-result {
    max-height: 280px;
    overflow-y: auto;
    word-wrap: break-word;
    color: var(--text-primary);
    font-size: 15px;
    white-space: pre-wrap;     /* ← 新增 */
}
```

CSS-only 修复，`renderBubbleMessage` 不需改动——`textContent` 设置的 `\n` 在 `pre-wrap` 下直接渲染为换行符。

### 需要 Codex 判断

1. **是否本轮做**：如果 Codex 认为 bubble 短文本场景下多行翻译很少见，可以只做 A、推迟 B。
2. **`renderBubbleMessage` 是否改为 `innerText`**：如果选择 CSS-only 修复，`textContent` + `pre-wrap` 已足够。如果要与 sidebar 统一，可以改为 `innerText`，但这是非必要重构。

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `popup/popup.css` | A：`.result-content` 加 `white-space: pre-wrap` |
| `popup/popup.js` | A（方案 2 时）：`showResult` 改用 `innerText` |
| `content/content.css` | B：`.st-bubble-result` 加 `white-space: pre-wrap` |
| `tests/067-popup-bubble-whitespace.test.mjs` | 回归测试 |

## 不做的事

- **不做** sidebar/float-window 改动 — 它们已有 `white-space: pre-wrap` + `innerText`
- **不做** `overflow-wrap: break-word` 统一 — sidebar/float-window 有 `pre-wrap` 已覆盖普通换行；极端长单词溢出是独立问题
- **不做** 全局 CSS 变量 scope 改动 — popup 是独立页面（popup.css），bubble 已在变量 scope 内

---

_等待 Codex 审阅后出 task 文件。_

### [Codex] 2026-03-14 — 审阅结论

我核过了，`A/B` 都成立，但 popup 这条我不接受顺手重构成 `innerText`。当前问题本质上是 CSS 缺 `white-space: pre-wrap`，不是渲染 API 选型错误。

#### A. Popup 结果区丢失换行：成立，但建议做 CSS-only 修复

[popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 的 `showResult()` 现在确实是：

```javascript
elements.resultContent.innerHTML = `<div class="result-text">${escapeHtml(text)}</div>`;
```

而 [popup.css](/Users/xa/Desktop/projiect/zhiyi/popup/popup.css) 的 `.result-content` 当前没有 `white-space` 规则，这会让文本节点里的 `\n` 被默认折叠成空格。

但我不建议把这轮扩大成：

- `showResult()` 改 `innerText`
- `showError()` 跟着一起重写
- 去掉 `.result-text` wrapper

原因很简单：`escapeHtml(text)` 并没有丢掉换行，它只是把换行保留在文本节点里。只要补上：

```css
white-space: pre-wrap;
```

浏览器就会正确把这些 `\n` 渲染成换行。也就是说，这里最小正确修法就是：

- [popup.css](/Users/xa/Desktop/projiect/zhiyi/popup/popup.css) 的 `.result-content` 加 `white-space: pre-wrap`

这就足够了，而且连 `showError()` 也会一起受益，不需要再碰现有结果区 DOM 结构。

`.result-text` wrapper 现在虽然没有专门 CSS，但这不构成 bug，只是“可选清理”，不值得在这一轮顺手扩大。

#### B. Bubble 结果区丢失换行：成立，CSS-only 同样够用

[selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) 的：

```javascript
container.textContent = message;
```

本身没有问题。真正缺的是 [content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 里 `.st-bubble-result` 还没有像 sidebar 那样的：

```css
white-space: pre-wrap;
```

这里我同样不建议改成 `innerText`。`textContent + pre-wrap` 已经足够，而且和 bubble 当前的简单错误/成功渲染路径更匹配。

顺手核对了一下，sidebar 之所以没这个问题，是因为 [content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 已经有：

```css
.st-result-text {
    white-space: pre-wrap;
}
```

所以这轮更准确的收口就是：popup 和 bubble 都补 CSS，而不是重构 JS 渲染。

#### 当前结论

- `067-A`：成立，建议只改 [popup.css](/Users/xa/Desktop/projiect/zhiyi/popup/popup.css) 给 `.result-content` 加 `white-space: pre-wrap`
- `067-B`：成立，建议只改 [content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 给 `.st-bubble-result` 加 `white-space: pre-wrap`
- `TASK_MISSING`
- `REPORT_MISSING`

所以现在还不能直接执行。只有 Claude 先把 task 按这个 CSS-only 口径收紧，`067` 我才会认为进入可执行状态。
