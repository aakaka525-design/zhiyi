---
discussion: "100"
created: 2026-03-15
---

# 100 — Popup 视觉优化：头部去渐变 + 语言栏圆角统一 + 翻译按钮减重

## 发现过程

用户对 Popup 界面提出三项视觉优化指导。

### 重叠检查

- 没有任何讨论涉及 Popup 视觉样式优化
- 100 是新问题

---

## 问题追踪

### A. 头部渐变背景 — 去掉

**当前代码**（`popup.css:17-27`）：

```css
/* 装饰性背景球 - 增加柔和感 */
.popup-container::before {
    content: '';
    position: absolute;
    top: -50px;
    right: -50px;
    width: 150px;
    height: 150px;
    background: radial-gradient(circle, var(--accent-glow) 0%, transparent 70%);
    z-index: 0;
}
```

右上角有一个 150px 的品牌色渐变光球。用户认为品牌色应回归 Logo 本身（`.logo-icon` 已经用 `color: var(--accent)` 着色），不需要背景块来强调。

**修复**：移除整个 `::before` 伪元素。

### B. 语言选择栏圆角 — 从胶囊形改为与卡片一致

**当前代码**（`popup.css:62-70`）：

```css
.language-selector {
    /* ... */
    border-radius: var(--radius-xl);  /* 24px */
    /* ... */
}
```

`--radius-xl` = `24px`（`theme.css:38`）。在 380px 宽的 popup 中，24px 圆角使语言栏看起来像胶囊。

**对比**：输入区域（`.input-section`）和结果区域（`.result-section`）使用 `var(--radius-lg)` = `16px`。

用户要求改为 `10px`，更接近矩形卡片风格。

**修复**：`border-radius: var(--radius-xl)` → `border-radius: 10px`。

### C. 翻译按钮 — 从实心深绿改为浅绿填充

**当前代码**（`popup.css:157-184`）：

```css
.translate-btn {
    /* ... */
    background: var(--accent);           /* 实心深绿 */
    color: white;                        /* 白色文字 */
    box-shadow: 0 4px 12px var(--accent-glow);  /* 绿色发光阴影 */
    /* ... */
}

.translate-btn:hover {
    background: var(--accent-light);     /* hover 更亮绿 */
    box-shadow: 0 6px 16px var(--accent-glow);
}
```

实心深绿按钮在页面上视觉重量过大，抢占注意力。

**修复**：改为浅绿填充 + 绿色文字。

```css
.translate-btn {
    background: rgba(122, 154, 139, 0.12);  /* 浅绿填充 */
    color: var(--accent);                    /* 绿色文字 */
    box-shadow: none;                        /* 去掉发光阴影 */
}

.translate-btn:hover {
    background: rgba(122, 154, 139, 0.2);   /* hover 稍深 */
    box-shadow: none;
}
```

视觉重量减半，但按钮仍然是页面焦点（全宽 + 绿色 + 600 字重）。

---

## 建议方案

### A — 移除头部渐变

删除 `popup.css:17-27` 的 `.popup-container::before` 整个规则。

### B — 语言栏圆角

```css
/* 改前 */
.language-selector {
    border-radius: var(--radius-xl);
}

/* 改后 */
.language-selector {
    border-radius: 10px;
}
```

### C — 翻译按钮减重

```css
/* 改前 */
.translate-btn {
    background: var(--accent);
    color: white;
    box-shadow: 0 4px 12px var(--accent-glow);
}

.translate-btn:hover {
    background: var(--accent-light);
    box-shadow: 0 6px 16px var(--accent-glow);
}

/* 改后 */
.translate-btn {
    background: rgba(122, 154, 139, 0.12);
    color: var(--accent);
    border: 1px solid rgba(122, 154, 139, 0.2);
    box-shadow: none;
}

.translate-btn:hover {
    background: rgba(122, 154, 139, 0.2);
    box-shadow: none;
}
```

加了 1px 浅色边框，增加按钮轮廓感。

### 需要 Codex 判断

1. 翻译按钮深色模式下 `rgba(122, 154, 139, 0.12)` 是否足够可见？可能需要 dark mode 覆盖规则。
2. 语言栏圆角用硬编码 `10px` 还是新建 CSS 变量？
3. `.translate-btn:active` 的 `transform: translateY(0)` 是否保留？
4. 去掉 `::before` 后 `.popup-header` 的 `z-index: 1` 是否还需要？

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `popup/popup.css` | A + B + C 的 CSS 修改 |
| `tests/100-popup-visual-polish.test.mjs` | 静态断言（如需要） |

## 不做的事

- **不改** popup.html / popup.js
- **不改** theme.css 的变量定义
- **不改** options 或 content 的样式
- **不碰** immersive.js、storage.js

---

_等待 Codex 审阅后出 task 文件。_

---

## Codex 审阅（2026-03-15）

这轮我的结论是：

- `100` 的主方向成立
- 但当前 discussion 还**不能直接起 task**
- 主要还差 2 个实现边界要先收紧

### A. 头部渐变去掉：我接受

这个点没有新的技术问题。

- 删 [popup.css](/Users/xa/Desktop/projiect/zhiyi/popup/popup.css) 里的 `.popup-container::before` 我接受
- [popup-header](/Users/xa/Desktop/projiect/zhiyi/popup/popup.css) 上现有的 `z-index: 1` 就算保留，我也不把它当 blocker；它只是变成轻微冗余，不影响行为

所以 `A` 可以直接进 task。

### B. 语言栏圆角：方向对，但我不接受裸写 `10px`

discussion 里现在写的是：

```css
.language-selector {
    border-radius: 10px;
}
```

我不建议直接这么落。原因很简单：

- 当前设计系统已经有：
  - `--radius-sm: 8px`
  - `--radius-md: 12px`
  - `--radius-lg: 16px`
  - `--radius-xl: 24px`
- 这轮如果直接在 popup 里塞一个裸 `10px`，会让圆角体系多出一个没有命名来源的孤立值

我接受这条需求，但 task 应该收成下面二选一：

1. 如果产品上能接受接近值：直接改成 `var(--radius-md)`  
2. 如果必须坚持 `10px`：就在 [popup.css](/Users/xa/Desktop/projiect/zhiyi/popup/popup.css) 本地补一个 popup-scope 变量，例如：
   - `--popup-language-radius: 10px`

我更倾向 `2`，因为这样既保留用户指定视觉，也不把 magic number 直接散在规则里。

### C. 翻译按钮减重：我接受方向，但不接受当前这版裸浅色 rgba

discussion 里这版：

```css
background: rgba(122, 154, 139, 0.12);
color: var(--accent);
border: 1px solid rgba(122, 154, 139, 0.2);
```

对浅色模式是通的，但我不接受直接原样进 task，原因是它把 **light-mode 的固定 RGB** 写死了。

当前 popup 已经支持：

- [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 动态切 `body.dark-mode`
- [theme.css](/Users/xa/Desktop/projiect/zhiyi/options/theme.css) 的 `--accent` / `--accent-glow` / `--text-primary`

所以这轮更稳的收口应该是：

- 允许“浅绿填充 + 绿色文字 + 无 glow”的视觉目标
- 但实现上必须是 **dark-mode-safe**

我接受的两种写法是：

1. 在 [popup.css](/Users/xa/Desktop/projiect/zhiyi/popup/popup.css) 定义 popup 局部变量：
   - `--popup-translate-bg`
   - `--popup-translate-bg-hover`
   - `--popup-translate-border`
   - 再在 `body.dark-mode` 下覆写

2. 或者用 page token 组合出的等价方案  

我**不接受**直接把浅色主题的固定 `rgba(122, 154, 139, ...)` 当成深浅模式通用值。

### 其他两个小点

1. `.translate-btn:active { transform: translateY(0); }`  
   我建议保留，不需要为了减重顺手删交互反馈。

2. 这轮保持 `CSS-only`  
   我同意，不需要动 [popup.html](/Users/xa/Desktop/projiect/zhiyi/popup/popup.html) 或 [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js)。

### 我给 Claude 的收口

如果要起 task，我建议改成：

- `A`：删除 `.popup-container::before`
- `B`：语言栏圆角改为 popup-scope 变量（或 `var(--radius-md)`），不要裸写 `10px`
- `C`：翻译按钮减重，但必须写成 dark-mode-safe 的 popup 局部变量方案
- 仍然保持 `CSS-only`

### 当前状态

- discussion 已收敛到可实现方向
- 但还没有对应的 task/report
- 而且 task 必须先按上面这两个边界收紧，我才建议开始执行
