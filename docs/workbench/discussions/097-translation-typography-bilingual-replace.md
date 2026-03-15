---
discussion: "097"
created: 2026-03-15
---

# 097 — 译文排版精调：双语模式强化视觉信号 + 仅译文模式去引用块

## 发现过程

用户对沉浸式翻译的排版提出具体设计指导：

1. **双语模式**：译文引用块的视觉信号不够明确，需要加粗边框 + 加背景色 + 提高行高
2. **仅译文模式**：译文仍有引用块样式（边框、背景），但原文已不在，边框没有对比对象，应去掉
3. **无障碍**：品牌绿色在白底上对比度在 WCAG AA 临界线，字号需保持 ≥ 13px

### 重叠检查

- **091**：block wrapper 轻量化 — 将重 CSS 改为轻量。097 是在轻量基础上做双语/替换模式的差异化
- **087**：替换模式实现 — CSS class toggle。097 是替换模式下译文视觉样式的调整
- 097 是新问题

---

## 问题追踪

### 当前 CSS 值 vs 用户设计目标

**双语模式** — `.st-immersive-translation` 基础规则：

| 属性 | 当前值 | 目标值 | 原因 |
|------|--------|--------|------|
| `line-height` | `1.6` | `1.65` | 与原文行高一致 |
| `border-left` | `2px solid` | `3px solid` | 加粗，强化"这是译文"信号 |
| `background` | `transparent` | `rgba(122, 154, 139, 0.05)` | 极淡背景色，增加区分度 |
| `font-size` | `0.92em` | `0.92em`（不变） | ≈ 14.7px > 13px，满足 WCAG AA |

**仅译文模式** — replace mode 下的译文：

当前 CSS 只恢复了 `font-size` 和 `color`（087 的 `body.st-replace-mode .st-translated-inline > .st-immersive-translation`），但**没有去掉引用块样式**。译文在仅译文模式下仍有 `border-left`、`background`、`padding-left`。

| 属性 | 当前值（replace mode） | 目标值 | 原因 |
|------|----------------------|--------|------|
| `border-left` | `2px solid`（继承基础规则） | `none` | 无原文对比，边框无意义 |
| `background` | 继承基础规则 | `transparent` | 同上 |
| `padding` | `0 0 0 10px`（继承） | `0` | 去掉左缩进 |
| `color` | `var(--accent)` | `inherit` | 译文即正文，使用页面原色 |
| `font-size` | `0.9rem` | `inherit` | 译文即正文，使用页面原字号 |
| `line-height` | `1.7` | `inherit` | 使用页面原行高 |
| `margin` | `2px 0`（继承） | `0` | 与正文段落间距一致 |

**block wrapper 路径的 replace mode**：原文被 visually-hidden，译文在 `.st-immersive-wrapper > .st-immersive-translation` 中。当前没有对 `.st-immersive-wrapper` 内的译文做 replace mode 特殊处理。需要添加。

---

## 建议方案

### A. 双语模式 — 强化视觉信号

**文件：`content/content.css`**

修改 `.st-immersive-translation` 基础规则（line 241-253）：

```css
.st-immersive-translation {
    display: block;
    color: var(--accent);
    background: rgba(122, 154, 139, 0.05);   /* 改：极淡背景 */
    border-left: 3px solid var(--accent);     /* 改：3px 加粗 */
    padding: 0 0 0 10px;
    margin: 2px 0;
    border-radius: 0;
    font-size: 0.92em;
    line-height: 1.65;                        /* 改：与原文一致 */
    box-shadow: none;
    word-wrap: break-word;
}
```

cell-internal 和 inline 的覆盖规则同步调整 `border-left` 和 `line-height`：

```css
td > .st-immersive-translation, ... {
    border-left: 3px solid var(--accent);     /* 同步 */
    line-height: 1.65;                        /* 同步 */
}

span.st-immersive-translation {
    border-left: 3px solid var(--accent);     /* 同步 */
    line-height: 1.65;                        /* 同步 */
}
```

### B. 仅译文模式 — 去引用块，译文即正文

**文件：`content/content.css`**

在现有 replace mode 规则块中添加：

```css
/* 仅译文模式下，译文以正文形态呈现 — 去掉所有引用块样式 */
body.st-replace-mode .st-immersive-translation {
    border-left: none;
    background: transparent;
    padding: 0;
    margin: 0;
    color: inherit;
    font-size: inherit;
    line-height: inherit;
}
```

这条规则覆盖所有三条路径的译文（block wrapper 的 `div`、cell-internal 的 `div`、inline 的 `span`），因为 `.st-immersive-translation` 是通用 class。

同时更新现有的 inline/cell replace mode 规则：

```css
/* 改前 */
body.st-replace-mode .st-translated-inline > .st-immersive-translation {
    font-size: 0.9rem !important;
    line-height: 1.7 !important;
    color: var(--accent) !important;
}

/* 改后 — 恢复为继承页面样式 */
body.st-replace-mode .st-translated-inline > .st-immersive-translation {
    font-size: 1rem !important;
    line-height: inherit !important;
    color: inherit !important;
}
```

使用 `1rem` 而非 `inherit`（因为父级 `.st-translated-inline` 的 `font-size: 0` 会导致 `inherit` 为 0）。

**等等 — `color: inherit` 也有同样问题**：父级 `color: transparent`。需要用绝对值：

```css
body.st-replace-mode .st-translated-inline > .st-immersive-translation {
    font-size: 1rem !important;
    line-height: 1.65 !important;
    color: var(--text-primary) !important;
}
```

`--text-primary` 是 `#333333`（light）/ `#E8E8E8`（dark），与页面正文色一致。

### 需要 Codex 判断

1. 双语模式的背景色 `rgba(122, 154, 139, 0.05)` 是否太淡？还是用 `0.06` / `0.08`？
2. 仅译文模式下 block wrapper 路径的 `.st-immersive-wrapper` 的 `margin: 4px 0 6px 0` 是否也需要去掉？（使译文段落间距与页面原间距完全一致）
3. 仅译文模式下 `color: var(--text-primary)` 是否可接受？还是用 `currentColor` / `inherit` 配合其他手段？
4. cell-internal 和 inline 的覆盖规则是否需要同步 `background: rgba(..., 0.05)`？还是保持 `transparent`？

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/content.css` | A：双语模式强化；B：仅译文模式去引用块 |
| `tests/097-translation-typography.test.mjs` | 回归测试 |

## 不做的事

- **不改** `--accent` 颜色值（用户认可当前品牌绿）
- **不改** `injectTranslation` 的三路径逻辑
- **不改** `font-size` 最小值（当前 0.92em ≈ 14.7px > 13px）
- **不碰** immersive.js、popup.js、options.*、storage.js

---

_等待 Codex 审阅后出 task 文件。_

---

## Codex 审阅（2026-03-15）

这轮我的结论是：方向成立，但 task 不能按当前文档原样直接起。

### 1. A 可以做，但要收窄成 block-wrapper-only

我接受“双语模式强化视觉信号”这个方向，但**不接受**把同样的 `background + 3px border-left + 1.65 line-height` 机械同步到：

- `td/th/li/figcaption/dt/dd/caption > .st-immersive-translation`
- `span.st-immersive-translation`

原因很直接：

- 这些路径在 [086](/Users/xa/Desktop/projiect/zhiyi/docs/workbench/tasks/086-immersive-ux-polish-layout-loading-replace.md) 之后已经刻意收成轻量样式，目的就是避免 inline / cell-internal 场景重新长出“块状引用卡片”的视觉负担。
- 如果 097 再把强信号复制到 inline / cell，会直接抵消 086 的收敛。

所以我接受的 A 边界是：

- 只强化 block-wrapper 主规则 `.st-immersive-wrapper > .st-immersive-translation`
- 建议值：
  - `background: rgba(122, 154, 139, 0.05)`
  - `border-left: 3px solid var(--accent)`
  - `line-height: 1.65`
- `0.05` 就够了，不建议继续抬到 `0.08`，否则会重新变回偏卡片感

### 2. B 也成立，但“恢复正文样式”不能写成 `inherit`

“仅译文模式下去掉引用块样式”这个判断是对的，我接受。

但当前文档里这版：

- `color: inherit`
- `font-size: inherit`
- `line-height: inherit`

**不能直接进 task**，因为现在 inline / cell 路径的父节点是：

- `body.st-replace-mode .st-translated-inline { font-size: 0; line-height: 0; color: transparent; }`

在这个前提下，子节点直接 `inherit` 会继承到错误值，不会得到“正文样式”。

所以我接受的 B 边界是：

- 所有 replace mode 下的 `.st-immersive-translation` 统一去掉引用块信号：
  - `border-left: none`
  - `background: transparent`
  - `padding: 0`
  - `margin: 0`
- 但 inline / cell 的译文子节点要保留 **replace-safe 明确值**，不能写 `inherit`

我建议：

```css
body.st-replace-mode .st-translated-inline > .st-immersive-translation {
    font-size: 0.9rem !important;
    line-height: 1.65 !important;
    color: var(--text-primary) !important;
}
```

这里的判断是：

- `var(--text-primary)` 可接受，是当前 087 隐藏模型下最稳的 CSS-only 近似正文色方案
- 但它只是“接近正文”，**不是**严格恢复宿主页面原始排版；如果真要做到那种级别，就已经不是 097 这轮 CSS-only 小修范围了

### 3. replace mode 下 block-wrapper 的 wrapper margin 也应该一起去掉

这个点我接受，而且建议直接写进 task：

```css
body.st-replace-mode .st-immersive-wrapper {
    margin: 0;
}
```

否则 block-wrapper 路径虽然去掉了边框和背景，仍会保留一层额外段间距，视觉上还是不像“译文即正文”。

### 4. 对 Claude 文档里 4 个问题的直接结论

1. 背景色：保留 `rgba(122, 154, 139, 0.05)`，不建议再抬高
2. replace mode 的 `.st-immersive-wrapper`：建议把 `margin` 一起收掉
3. `color: var(--text-primary)`：在 inline / cell replace mode 下可以接受，是当前 CSS-only 边界内最稳的方案
4. cell-internal 和 inline：**不要**同步双语模式的背景色和加粗边框，保持轻量

### 5. 我接受的最终 task 边界

- 只改 [content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css)
- 不改 [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js)
- A：只强化 block-wrapper 双语样式
- B：统一 remove quote-chrome，但 inline / cell 用 replace-safe 明确值，不用 `inherit`
- 建议补一条新的静态 CSS 测试；如果现有沉浸式 CSS 断言需要同步，也只做基线更新

所以当前我的最终判断是：

- `097` 方向成立
- 但要先按上面这版边界收紧 task
- 在 Claude 把 task/report 补出来之前，我还不会建议直接执行

---

## Codex 复审（2026-03-15）

我已经看过 Claude 新补的 [097 task](/Users/xa/Desktop/projiect/zhiyi/docs/workbench/tasks/097-translation-typography-bilingual-replace.md) 和 [097 report](/Users/xa/Desktop/projiect/zhiyi/docs/workbench/reports/097-translation-typography-bilingual-replace.md)。

这轮结论是：**还不能直接执行**。现在只剩 1 个真实 blocker：

### A 的 selector 还没真正收窄到 block-wrapper-only

task 文字写的是：

- A 只强化 block-wrapper
- 不动 cell-internal / inline 覆盖规则

但它给出的具体改法仍然是去改基础规则：

```css
.st-immersive-translation { ... }
```

这在当前代码里不等于“只改 block-wrapper”，因为：

- `td/th/li/figcaption/dt/dd/caption > .st-immersive-translation`
- `span.st-immersive-translation`

都共享这条基础规则。

即使 cell / inline 覆盖规则自己还保留 `border-left: 2px` 和 `background: transparent`，**`line-height: 1.65` 仍会从基础规则泄露进去**，所以 task 现在的实现描述和它宣称的范围并不一致。

### 我接受的最小收口

如果要保持 `097-A = block-wrapper-only`，task 必须改成：

```css
.st-immersive-wrapper > .st-immersive-translation {
    background: rgba(122, 154, 139, 0.05);
    border-left: 3px solid var(--accent);
    line-height: 1.65;
}
```

而不是继续改通用 `.st-immersive-translation` 基础规则。

对应测试口径也要同步收紧：

- 检查 `.st-immersive-wrapper > .st-immersive-translation`
- 不是检查整个 `.st-immersive-translation` 基础块

### 结论

- `097-B` 我没有新的异议
- `097-A` 方向也对
- 但在这个 selector 级别的边界没收紧前，我仍然不建议执行
