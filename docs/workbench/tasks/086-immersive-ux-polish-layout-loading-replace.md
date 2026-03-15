---
task: "086"
status: done
priority: P2
created: 2026-03-15
scope: "A (inline CSS 轻量化) + B (loading CSS-only 视觉升级)"
---

# 086 — 沉浸式翻译 UX：inline 排版轻量化 + 加载动画 CSS 升级

## 范围

只做 **A + B**。C（替换/对照模式）已拆出，不在本任务范围内。

B 约束：**不改变 loading helper DOM 结构**，仅通过 CSS 改变视觉表现。

---

## A — inline 路径 CSS 轻量化

### 问题

inline 路径（`isFlexItem || isGridItem || isInline`）的翻译 `<span class="st-immersive-translation">` 继承了 block wrapper 的重 CSS（背景 + 3px 边框 + 10px padding + 圆角 + 阴影）。在 inline/flex/grid 容器内部视觉过于突兀。

### 改动

**文件：`content/content.css`**

在 cell-internal 覆盖规则（当前 `caption > .st-immersive-translation` 规则之后、`.st-immersive-loading` 之前）添加：

```css
span.st-immersive-translation {
    background: transparent;
    border-left: 2px solid var(--accent);
    padding: 0 0 0 8px;
    margin: 4px 0 0 0;
    border-radius: 0;
    box-shadow: none;
    font-size: 0.9em;
}
```

### 原理

- inline 路径是唯一创建 `<span>` 翻译元素的路径
- cell-internal 和 block wrapper 都创建 `<div>`
- `span.st-immersive-translation` 精准匹配 inline 路径，不需要 JS 改动或额外 class

### 约束

1. **纯 CSS 改动**，不改 `injectTranslation` 或任何 JS
2. **不改** cell-internal 覆盖规则（`td > .st-immersive-translation` 等）
3. **不改** block wrapper 的 `.st-immersive-translation` 基础规则

---

## B — 加载动画 CSS-only 视觉升级

### 问题

当前 loading placeholder 是三个 6px 弹跳圆点，视觉效果简陋。

### 约束（Codex 审阅要求）

**不改变 loading helper DOM 结构**。当前 DOM：

```html
<span class="st-immersive-loading">
    <span></span><span></span><span></span>
</span>
```

`injectLoadingPlaceholder` / `removeLoadingPlaceholder` 函数不改。仅通过 CSS 改变视觉。

### 改动

**文件：`content/content.css`**

将三个空 `<span>` 从圆点样式改造为**脉冲条段**（bar-pulse）。视觉效果：三个短条依次亮灭，类似进度波浪。

改前（当前 `content.css:272-295`）：

```css
.st-immersive-loading {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 4px 0 0 0;
    padding: 2px 0;
}

.st-immersive-loading span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
    opacity: 0.7;
    animation: st-bounce 1.2s infinite ease-in-out;
}

.st-immersive-loading span:nth-child(2) {
    animation-delay: 0.15s;
}

.st-immersive-loading span:nth-child(3) {
    animation-delay: 0.3s;
}
```

改后：

```css
.st-immersive-loading {
    display: flex;
    align-items: center;
    gap: 3px;
    margin: 6px 0 2px 0;
    padding: 0;
}

.st-immersive-loading span {
    width: 28px;
    height: 3px;
    border-radius: 2px;
    background: var(--accent);
    animation: st-bar-pulse 1.5s infinite ease-in-out;
}

.st-immersive-loading span:nth-child(2) {
    animation-delay: 0.2s;
}

.st-immersive-loading span:nth-child(3) {
    animation-delay: 0.4s;
}
```

新增 `@keyframes st-bar-pulse`（放在现有 `@keyframes st-bounce` 之后）：

```css
@keyframes st-bar-pulse {
    0%, 100% {
        opacity: 0.15;
        transform: scaleX(0.7);
    }
    50% {
        opacity: 0.5;
        transform: scaleX(1);
    }
}
```

变更明细：

| 属性 | 改前（dots） | 改后（bar-pulse） |
|------|-------------|------------------|
| `width` | `6px` | `28px` |
| `height` | `6px` | `3px` |
| `border-radius` | `50%`（圆形） | `2px`（圆角矩形） |
| `opacity` | `0.7` 固定 | `0.15 ↔ 0.5` 脉冲 |
| `animation` | `st-bounce`（上下弹跳） | `st-bar-pulse`（透明度 + 水平缩放） |
| nth-child delays | `0.15s / 0.3s` | `0.2s / 0.4s` |
| 容器 `gap` | `6px` | `3px` |
| 容器 `margin` | `4px 0 0 0` | `6px 0 2px 0` |

### 不碰的东西

- **`@keyframes st-bounce` 保留**：popup 的 `.st-loading-dots` 仍在使用
- **`injectLoadingPlaceholder` / `removeLoadingPlaceholder` 不改**
- **loading DOM 结构不改**（仍然是一个 span 内三个空 span）
- **085 的全量预注入逻辑不改**

---

## 测试

**文件：`tests/086-immersive-ux-polish.test.mjs`**

两层测试结构：

### 第一层 — 静态断言

1. **CSS 存在 `span.st-immersive-translation` 覆盖规则**：读取 `content.css`，断言包含 `span\.st-immersive-translation\s*\{`。
2. **CSS 存在 `@keyframes st-bar-pulse`**：断言 `content.css` 中包含 `st-bar-pulse`。
3. **CSS 保留 `@keyframes st-bounce`**：断言 `st-bounce` 仍然存在（popup 依赖）。
4. **`.st-immersive-loading span` 使用 `st-bar-pulse` 而非 `st-bounce`**：断言 `.st-immersive-loading span` 规则块中包含 `st-bar-pulse`。

### 第二层 — Runtime harness

5. **inline 路径注入 `<span>` 翻译元素**：构造 inline 容器 → `injectTranslation` → 断言子节点是 `SPAN`（非 `DIV`），class 为 `st-immersive-translation`。
6. **cell-internal 路径仍注入 `<div>`**：构造 `td` → `injectTranslation` → 断言子节点是 `DIV`。
7. **loading DOM 结构未改**：调用 `injectLoadingPlaceholder` → 断言产物是 `span.st-immersive-loading` 内含 3 个 `<span>` 子节点。

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `content/content.css` | A：`span.st-immersive-translation` 覆盖规则；B：loading bar-pulse CSS |
| `tests/086-immersive-ux-polish.test.mjs` | 静态 + runtime harness 两层测试 |

## 不做的事

- **不改** `injectTranslation` 或任何 JS 逻辑
- **不改** loading helper DOM 结构 / 函数逻辑
- **不改** 085 的全量预注入逻辑
- **不改** `@keyframes st-bounce` 或 `.st-loading-dots`
- **不改** own-artifact helper / stale hash 语义
- **不做** C（替换/对照模式）— 拆到后续独立任务
- **不碰** popup.js、sidebar.js、float-window.js、tts.js、options.*、storage.js、immersive.js
