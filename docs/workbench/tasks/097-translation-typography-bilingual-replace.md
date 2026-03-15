---
task: "097"
status: done
priority: P2
created: 2026-03-15
scope: "A (block-wrapper 双语强化，窄 selector) + B (replace mode 去引用块)"
---

# 097 — 译文排版精调

## 范围

纯 CSS 改动。A 用窄选择器 `.st-immersive-wrapper > .st-immersive-translation` 只影响 block-wrapper 路径。B 统一去引用块。

---

## 改动

**文件：`content/content.css`**

### A — 双语模式：block-wrapper 强化（窄 selector）

**不改** `.st-immersive-translation` 基础规则。新增一条窄选择器规则：

```css
/* block-wrapper 路径专用强化 — 不影响 inline / cell-internal */
.st-immersive-wrapper > .st-immersive-translation {
    background: rgba(122, 154, 139, 0.05);
    border-left-width: 3px;
    line-height: 1.65;
    font-family: inherit;
}
```

放在 `.st-immersive-translation` 基础规则之后、cell-internal 覆盖规则之前。

**为什么用窄 selector**：

- `.st-immersive-wrapper > .st-immersive-translation` 只匹配 block-wrapper 路径（`injectTranslation` 的 else 分支创建 `div.st-immersive-wrapper > div.st-immersive-translation`）
- cell-internal 路径的 `<div class="st-immersive-translation">` 直接在 `td/th/li/...` 内部，无 `.st-immersive-wrapper` 父级 → 不匹配
- inline 路径的 `<span class="st-immersive-translation">` 直接在容器内部，无 `.st-immersive-wrapper` 父级 → 不匹配

**`.st-immersive-translation` 基础规则完全不动**：`background: transparent`、`border-left: 2px`、`line-height: 1.6` 保持原样，继续作为 cell-internal 和 inline 的默认值。

### B — 仅译文模式：去引用块 + wrapper margin

在现有 replace mode 规则块中添加两条新规则：

```css
/* 仅译文模式 — 译文以正文形态呈现 */
body.st-replace-mode .st-immersive-translation {
    border-left: none;
    background: transparent;
    padding: 0;
    margin: 0;
}

body.st-replace-mode .st-immersive-wrapper {
    margin: 0;
}
```

同时更新现有 inline/cell replace mode 的译文恢复规则：

改前：

```css
body.st-replace-mode .st-translated-inline > .st-immersive-translation {
    font-size: 0.9rem !important;
    line-height: 1.7 !important;
    color: var(--accent) !important;
}
```

改后：

```css
body.st-replace-mode .st-translated-inline > .st-immersive-translation {
    font-size: 0.9rem !important;
    line-height: 1.65 !important;
    color: var(--text-primary) !important;
}
```

---

## 约束

1. **A 用窄 selector `.st-immersive-wrapper > .st-immersive-translation`**，不改基础规则
2. **基础 `.st-immersive-translation` 完全不动**
3. **cell-internal / inline 覆盖规则完全不动**
4. **B 用 replace-safe 明确值**，不用 `inherit`
5. **不碰** immersive.js、popup.js、options.*、storage.js

---

## 测试

**文件：`tests/097-translation-typography.test.mjs`**

### 静态断言

1. CSS 包含 `.st-immersive-wrapper > .st-immersive-translation` 选择器
2. 该选择器规则包含 `border-left-width:\s*3px`
3. 该选择器规则包含 `line-height:\s*1\.65`
4. 该选择器规则包含 `background:.*0\.05`
5. 该选择器规则包含 `font-family:\s*inherit`
6. **基础 `.st-immersive-translation` 仍保持 `border-left:\s*2px`**（未被修改）
7. **cell-internal 覆盖规则仍保持 `border-left:\s*2px`**（未被修改）
8. `body.st-replace-mode .st-immersive-translation` 包含 `border-left:\s*none`
9. `body.st-replace-mode .st-immersive-wrapper` 包含 `margin:\s*0`
10. `body.st-replace-mode .st-translated-inline > .st-immersive-translation` 包含 `color:.*--text-primary`

全量 `node --test tests/*.test.mjs` 必须通过。

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `content/content.css` | A（窄 selector 新增规则）+ B（replace mode 规则） |
| `tests/097-translation-typography.test.mjs` | 静态断言 |
