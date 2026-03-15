---
task: "091"
status: done
priority: P2
created: 2026-03-15
scope: "A (block wrapper CSS 轻量化) + B (loading bar-pulse 递减宽度)"
---

# 091 — block wrapper 排版轻量化 + 加载动画视觉打磨

## 范围

纯 CSS 改动。不碰 JS。

---

## 改动

### A — block wrapper CSS 轻量化

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

### B — 加载动画递减宽度

**文件：`content/content.css`**

改前（当前 `content.css:327-349`）：

```css
.st-immersive-loading span {
    width: 28px;
    height: 3px;
    /* ... */
}
```

改后：

```css
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

三条等宽横条 → 递减宽度（40→28→16px），增加方向感。

---

## 约束

1. **纯 CSS 改动**，不碰 JS
2. **保留** heading 的 `fontSize + fontWeight` 同步逻辑（`injectTranslation` 中 h1-h6 的动态样式）
3. **不简化** cell-internal 和 inline 的覆盖规则（保持现有稳定视觉）
4. **不改** loading DOM 结构
5. **不改** 087 的替换模式
6. **不碰** immersive.js、popup.js、options.*、storage.js
7. `@keyframes st-bar-pulse` 不变
8. `@keyframes st-bounce` 不变（popup 依赖）

---

## 测试

**文件：`tests/091-block-wrapper-loading-polish.test.mjs`**

### 静态断言

1. `.st-immersive-wrapper` 的 `margin` 不再包含 `20px`
2. `.st-immersive-translation` 基础规则包含 `background:\s*transparent`
3. `.st-immersive-translation` 基础规则包含 `border-left:\s*2px`
4. `.st-immersive-translation` 基础规则不包含 `box-shadow:.*rgba`
5. `.st-immersive-loading span:nth-child(1)` 包含 `width:\s*40px`
6. `.st-immersive-loading span:nth-child(3)` 包含 `width:\s*16px`

全量 `node --test tests/*.test.mjs` 必须通过。

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `content/content.css` | A + B 的 CSS 规则 |
| `tests/091-block-wrapper-loading-polish.test.mjs` | 静态断言 |
