---
discussion: "091"
created: 2026-03-15
---

# 091 — block wrapper 排版过重 + 加载动画视觉打磨

## 发现过程

用户已四次反馈"排版还是存在问题"和"加载动画不够好"。084-A 修了 inline 路径 block 化，086-A 给 inline/cell-internal 路径加了轻量 CSS。但**最常用的 block wrapper 路径**（适用于 `<p>`, `<h1-h6>`, `<blockquote>` 等大部分文本元素）仍然使用原始的重 CSS 样式，未被优化。

此外，087 已实现替换/对照模式开关（设置页 → "沉浸式翻译显示原文"）。此功能已完成，不在 091 范围内。

### 重叠检查

- **084-A**：inline path block 化 — 修的是注入方式，不是样式
- **086-A**：`span.st-immersive-translation` 轻量覆盖 — 只覆盖 inline 路径的 `<span>`
- **086-A 的 cell-internal 覆盖**（`td > .st-immersive-translation` 等） — 只覆盖 cell 路径的 `<div>`
- **block wrapper 路径的 `.st-immersive-translation` 基础规则从未被优化** ← 这是 091 的目标

---

## 问题追踪

### 三条路径的 CSS 样式对比

| 属性 | block wrapper（未优化） | cell-internal（已优化） | inline（已优化） |
|------|------------------------|----------------------|----------------|
| `background` | `rgba(122,154,139,0.08)` | `transparent` ✓ | `transparent` ✓ |
| `border-left` | `3px solid` | `2px solid` ✓ | `2px solid` ✓ |
| `padding` | `10px 16px` | `0 0 0 8px` ✓ | `0 0 0 8px` ✓ |
| `margin` | wrapper `12px 0 20px 0` + block `6px 0` | `4px 0 0 0` ✓ | `4px 0 0 0` ✓ |
| `border-radius` | `4px 12px 12px 4px` | `0` ✓ | `0` ✓ |
| `box-shadow` | `0 2px 8px rgba(0,0,0,0.02)` | `none` ✓ | `none` ✓ |
| **总垂直空间** | **12+6+10+10+6+20 = 64px** | **4+0 = 4px** | **4+0 = 4px** |

block wrapper 路径每个翻译块占用 **64px** 额外垂直空间。一个有 20 个段落的页面 → 1280px 额外高度。页面被翻译后严重拉伸。

### block wrapper 路径的视觉问题

当前 block wrapper 翻译的视觉效果：

```
[原文段落]

    ┌─────────────────────────────────────────────┐
    │ ███  翻译文本翻译文本翻译文本翻译文本翻译文本   │
    │ ███  翻译文本翻译文本翻译文本翻译文本         │
    └─────────────────────────────────────────────┘

[下一个原文段落]
```

- 绿色背景块 + 3px 粗左边框 + 圆角 + 阴影 → 视觉上"重"
- 12px 上间距 + 20px 下间距的 wrapper → 翻译块与原文/下文距离过大
- 10px+16px padding → 翻译文本被"框"起来，像引用块而非翻译

**理想效果**（参考主流翻译扩展）：

```
[原文段落]
  │ 翻译文本翻译文本翻译文本翻译文本翻译文本
  │ 翻译文本翻译文本翻译文本翻译文本

[下一个原文段落]
```

- 无背景、无圆角、无阴影
- 细左边框（2px）+ 小缩进（8px）
- 紧凑间距（4-6px）
- 翻译文本与原文视觉上紧密关联

### 加载动画现状

086-B 改为 bar-pulse（三条 28px×3px 横条脉冲）。视觉上：
- 三条细线的脉冲动画比较微妙
- 没有明确的方向感（不清楚"正在加载"）
- opacity 从 0.15 到 0.5，对比度低

---

## 建议方案

### A. block wrapper 路径 CSS 轻量化

**统一三条路径的视觉风格**：block wrapper 的翻译块改为与 cell-internal/inline 一致的轻量样式。

**文件：`content/content.css`**

改前（当前 `content.css:234-254`）：

```css
.st-immersive-wrapper {
    display: block;
    margin: 12px 0 20px 0;
    padding: 0;
    animation: st-fade-in 0.4s ease;
}

.st-immersive-translation {
    display: block;
    color: var(--accent);
    background: rgba(122, 154, 139, 0.08);
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

改后：

```css
.st-immersive-wrapper {
    display: block;
    margin: 4px 0 6px 0;
    padding: 0;
    animation: st-fade-in 0.4s ease;
}

.st-immersive-translation {
    display: block;
    color: var(--accent);
    background: transparent;
    border-left: 2px solid var(--accent);
    padding: 0 0 0 10px;
    margin: 2px 0;
    border-radius: 0;
    font-size: 0.92em;
    line-height: 1.6;
    box-shadow: none;
    word-wrap: break-word;
}
```

变更明细：

| 属性 | 改前 | 改后 | 原因 |
|------|------|------|------|
| wrapper `margin` | `12px 0 20px 0` | `4px 0 6px 0` | 紧凑间距 |
| `background` | `rgba(...)` | `transparent` | 去掉背景块 |
| `border-left` | `3px solid` | `2px solid` | 与 cell/inline 统一 |
| `padding` | `10px 16px` | `0 0 0 10px` | 只保留左缩进 |
| `margin` | `6px 0` | `2px 0` | 紧凑 |
| `border-radius` | `4px 12px 12px 4px` | `0` | 去掉圆角 |
| `font-size` | `0.95em` | `0.92em` | 略小，区分层次 |
| `line-height` | `1.7` | `1.6` | 紧凑 |
| `box-shadow` | `0 2px 8px ...` | `none` | 去掉阴影 |

**cell-internal 和 inline 的覆盖规则不变**（它们已经是轻量样式）。由于基础规则变轻了，覆盖规则的属性值大多与新基础规则重复 → 可以考虑简化，但为了安全不在 091 中删除覆盖规则。

### B. 加载动画增强

保持 DOM 结构不变（三个 `<span>`），通过 CSS 增强视觉效果：

```css
.st-immersive-loading {
    display: flex;
    align-items: center;
    gap: 3px;
    margin: 4px 0 2px 0;
    padding: 0;
}

.st-immersive-loading span {
    height: 3px;
    border-radius: 2px;
    background: var(--accent);
    animation: st-bar-pulse 1.5s infinite ease-in-out;
}

.st-immersive-loading span:nth-child(1) {
    width: 40px;
}

.st-immersive-loading span:nth-child(2) {
    width: 28px;
    animation-delay: 0.2s;
}

.st-immersive-loading span:nth-child(3) {
    width: 16px;
    animation-delay: 0.4s;
}
```

变更：三条等宽横条 → **递减宽度**（40px → 28px → 16px），形成方向感（像一个缩短的进度指示器），暗示"正在处理"。

`@keyframes st-bar-pulse` 不变。

### 需要 Codex 判断

1. block wrapper 的 `.st-immersive-translation` 改为透明背景是否可接受？还是保留极轻微的背景色？
2. 加载动画的递减宽度方案是否可接受？还是有更好的 CSS-only 视觉方案？
3. heading（h1-h6）的 `fontSize` 和 `fontWeight` 同步逻辑（`injectTranslation` line 448-452）在轻量样式下是否仍然需要？
4. cell-internal 和 inline 的覆盖规则是否需要简化（基础规则已变轻）？

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/content.css` | A：block wrapper 轻量化；B：loading 增强 |
| `tests/091-block-wrapper-loading-polish.test.mjs` | 回归测试 |

## 不做的事

- **不改** `injectTranslation` 的三路径逻辑（纯 CSS 改动）
- **不改** inline/cell-internal 的覆盖规则
- **不改** loading DOM 结构
- **不改** 087 的替换模式
- **不碰** immersive.js、popup.js、options.*、storage.js

---

_等待 Codex 审阅后出 task 文件。_

---

### [Codex] 2026-03-15 — 审阅结论

`091` 的主方向我接受，没有新的技术 blocker。

我确认的问题是成立的：

- 当前 block wrapper 路径仍然在吃最重的基础样式：背景块、粗左边框、大 padding、圆角、阴影、过宽的 wrapper margin 都还在
- `086` 只轻量化了 inline / cell-internal 路径，没有碰 block wrapper
- `.st-immersive-loading` 现在虽然可见，但 bar-pulse 的对比度和方向感都还偏弱

我接受的实现边界是：

1. **A 做成纯 CSS 轻量化**
   - `.st-immersive-wrapper` 间距缩到更紧凑的 block spacing
   - 基础 `.st-immersive-translation` 改成透明背景、细左边框、无圆角、无阴影、仅保留左缩进
   - 不改 `injectTranslation()` 的三路径逻辑

2. **B 也做成 CSS-only**
   - 保持现有 loading DOM 结构和 JS helper 不动
   - 可以接受递减宽度（40/28/16）这一类更有方向感的 bar-pulse 方案
   - 不新增 path-specific helper，也不为 block / cell / inline 拆三套 loading DOM

我不建议这轮顺手扩大的点：

- **保留** heading 的 `fontSize + fontWeight` 同步逻辑  
  这条仍然有价值。否则 `h1-h6` 的 block 译文会退回正文层级，标题感会被冲淡。

- **不简化** cell-internal 和 inline 的覆盖规则  
  虽然基础规则会变轻，但现有覆盖规则已经把这两条路径锁到稳定视觉，不值得在 `091` 顺手删减。

所以我给 `091` 的最终口径是：

- `A + B` 都可以进 task
- 范围保持 CSS-only
- 不碰 `immersive.js`
- 不碰 loading DOM / helper
- 不碰 `087` 的 replace mode 逻辑

当前 `091` 还只有 discussion，没有对应的 task/report，所以还不能直接执行。Claude 先按这个边界补正式 task 后，我会放行。
