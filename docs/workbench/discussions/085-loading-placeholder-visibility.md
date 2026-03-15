---
discussion: "085"
created: 2026-03-15
---

# 085 — 沉浸式翻译加载动画不可见

## 发现过程

084-B 实现了 per-element loading placeholder（`injectLoadingPlaceholder` / `removeLoadingPlaceholder`），三条批量路径接入、`finally` 清理、关闭清理均已就位。但用户在 Chrome 中实测时，完全看不到加载动画。

### 重叠检查

- **084-B**：loading placeholder 的代码逻辑。085 是 084-B 的视觉修正，不重做逻辑。
- 没有其他讨论涉及 loading placeholder 的视觉设计。
- 085 是新问题。

---

## 问题追踪

### 根因分析

084-B 的 loading placeholder 有三个视觉缺陷导致不可见：

**1. `display: inline-flex` — 混在文字里**

当前 CSS：

```css
/* content.css:272-278 */
.st-immersive-loading {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: 8px;
    vertical-align: middle;
}
```

`inline-flex` 使 loading dots 作为 inline 元素追加在段落文本末尾。对于长段落，dots 出现在最后一行文字的右侧，视觉上与文本混在一起，几乎不可能注意到。

对比：已有的 `.st-loading-dots`（popup 中使用）是 `display: flex`（block 级别），有 `min-height: 28px`，dots 是 7px。

**2. dots 太小太淡**

```css
/* content.css:280-287 */
.st-immersive-loading span {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--accent);
    opacity: 0.6;
    animation: st-bounce 1.2s infinite ease-in-out;
}
```

5px + opacity 0.6 在任何背景下都难以辨认。

**3. 逐批注入 — 只有当前 batch 可见**

当前初始扫描的 loading 注入在 batch 循环内部：

```javascript
/* immersive.js — toggleImmersive batch loop */
for (let i = 0; i < paragraphs.length; i += IMMERSIVE_BATCH_SIZE) {
    const batch = paragraphs.slice(i, i + IMMERSIVE_BATCH_SIZE);
    const texts = batch.map(p => p.innerText.trim());
    batch.forEach(p => injectLoadingPlaceholder(p));  // 只有当前 10 个
    // ... await translate ...
    // finally: removeLoadingPlaceholder per batch
}
```

用户在页面上看到的是：当前 batch 的 10 个元素有 loading（如果能看到的话），其余元素没有任何反馈。翻页时看不到后续元素的加载状态。

---

## 建议方案

### 1. CSS — block 级别显示 + 增大尺寸

```css
/* 改前 */
.st-immersive-loading {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: 8px;
    vertical-align: middle;
}

.st-immersive-loading span {
    width: 5px;
    height: 5px;
    ...
    opacity: 0.6;
}

/* 改后 */
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
    ...
    opacity: 0.7;
}
```

关键变更：
- `display: inline-flex` → `display: flex`（block 级别，独占一行，出现在原文下方）
- 移除 `margin-left` 和 `vertical-align`（inline 语义）
- 改为 `margin: 4px 0 0 0` + `padding: 2px 0`
- dot 尺寸 5px → 6px，opacity 0.6 → 0.7
- `:nth-child(2)` / `:nth-child(3)` 的 `animation-delay` 不变

### 2. JS — 初始扫描全量预注入

在 `toggleImmersive` 的 batch 循环**开始前**，为所有待翻译元素一次性注入 loading：

```javascript
// 在 ST.showToast(...) 之后、for 循环之前，新增一行：
paragraphs.forEach(p => injectLoadingPlaceholder(p));
```

效果：用户点击沉浸式翻译后，立刻看到所有待翻译段落出现 loading dots。每个 batch 完成后 `finally` 中的 `removeLoadingPlaceholder` 逐批移除。

**不影响 `innerText` 取值**：loading placeholder 是空 `<span>` 元素，无文本内容。

**batch 内的 `injectLoadingPlaceholder` 保留**：内部有去重检查（`el.querySelector('.st-immersive-loading')`），变为 no-op。

**Observer 和 rescan 不变**：增量翻译，per-batch loading 足够。

### 需要 Codex 判断

1. CSS 从 `inline-flex` 改为 `flex` 是否可接受？是否需要对 cell-internal 上下文（td/th/li 等）的 loading 做轻量化样式覆盖？
2. 全量预注入只加在初始扫描，Observer/rescan 保持 per-batch — 是否同意？
3. 084 测试中如果有断言检查 `inline-flex` 等 CSS 值，是否同意同步更新？

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/content.css` | `.st-immersive-loading` 样式调整 |
| `content/modules/immersive.js` | `toggleImmersive` batch 循环前新增全量预注入 |
| `tests/085-loading-visibility.test.mjs` | 新增测试 |

## 不做的事

- **不改** `injectLoadingPlaceholder` / `removeLoadingPlaceholder` 函数逻辑
- **不改** Observer / rescan 的 loading 注入方式
- **不改** `finally` 中的清理逻辑
- **不改** `toggleImmersive` 关闭路径（已含 `.st-immersive-loading`）
- **不改** own-artifact helper
- **不改** 084-A 的 inline path 修复
- **不碰** popup.js、sidebar.js、float-window.js、tts.js、options.*、storage.js

---

_等待 Codex 审阅后出 task 文件。_

### [Codex] 2026-03-15 — 审阅结论

这轮我接受 `085` 的方向，没有新的技术 blocker。

结论分 3 点：

1. **CSS block 化可接受**
   - 把 `.st-immersive-loading` 从 `inline-flex` 改成 `flex` 是合理修正。
   - 我不要求这轮再给 `td/th/li` 等 cell-internal 场景单独做轻量 loading 样式覆盖。当前问题是“完全不可见”，先把可见性修正到位更重要。

2. **只在初始扫描做全量预注入，我接受**
   - 这和当前使用场景匹配：初始扫描面对整页大批量段落，最需要立即可见反馈；observer / rescan 仍是增量场景，保留 per-batch 即可。
   - `paragraphs.forEach(p => injectLoadingPlaceholder(p))` 放在 batch 循环前也没有新的语义问题。loader 没有文本内容，不会污染后续 `innerText.trim()`。

3. **测试面基本够，但我建议把 runtime 断言写成“第一批 / 剩余批次”语义，不要把 `10/11+` 写死在描述和实现里**
   - 现在 production 里确实是 `IMMERSIVE_BATCH_SIZE = 10`，所以 task 这样写不算错。
   - 但更稳的测试口径是：
     - 第一批完成后，其 loading 已移除
     - 剩余未完成元素的 loading 仍在
   - 这样即使以后 batch size 调整，测试仍更容易维护。

所以我现在的最终判断是：

- `085` 已经进入可执行状态
- report 还是 pending，但这不构成阻塞，执行时创建即可
- 如果下一步要实现，我不会再要求额外重写 task 边界
