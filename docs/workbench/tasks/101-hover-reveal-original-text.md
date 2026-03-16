---
task: "101"
status: done
priority: P2
created: 2026-03-15
scope: "block-wrapper-only hover reveal 原型（替换模式下 hover 淡入原文）"
---

# 101 — block-wrapper hover reveal 原型

## 范围

替换模式下的 block-wrapper 路径增加 hover 淡入原文能力。不改 `showOriginal` 存储类型，不碰 inline/cell，不新增设置。

---

## 改动

**文件：`content/content.css`**

### 替换 block-wrapper 的隐藏方式

改前（当前 visually-hidden，不可动画）：

```css
body.st-replace-mode .st-translated {
    position: absolute !important;
    overflow: hidden !important;
    clip-path: inset(50%) !important;
    width: 1px !important;
    height: 1px !important;
    margin: -1px !important;
    padding: 0 !important;
    border: 0 !important;
}
```

改后（可动画隐藏 + hover reveal）：

```css
body.st-replace-mode .st-translated {
    opacity: 0;
    max-height: 0;
    overflow: hidden;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    pointer-events: none;
    transition: opacity 0.25s ease, max-height 0.3s ease;
}

body.st-replace-mode .st-translated:has(+ .st-immersive-wrapper:hover),
body.st-replace-mode .st-translated:hover {
    opacity: 1;
    max-height: 2000px;
    overflow: visible;
    pointer-events: auto;
}
```

### 隐藏态

- `opacity: 0` — 不可见（不影响 `innerText`、不影响 rescan `display`/`visibility` 检查）
- `max-height: 0; overflow: hidden` — 不占空间
- `margin: 0; padding: 0; border: 0` — 消除间距
- `pointer-events: none` — 隐藏态不拦截点击
- `transition` — 平滑过渡

### hover 态

- `opacity: 1` — 淡入可见
- `max-height: 2000px` — 展开（固定上限，不用 `revert`）
- `overflow: visible` — 内容不裁剪
- `pointer-events: auto` — 可交互（原文中的链接可点击）

### 不承诺的事

- **不恢复**宿主页面原始 `margin`/`padding`/`border`
- hover 态只保证：原文可见 + 不被裁剪
- 原文在 hover 态时 `margin: 0; padding: 0; border: 0` 仍然生效

### inline/cell 完全不动

`body.st-replace-mode .st-translated-inline` 及其子规则保持原样，无 hover 行为。

---

## 约束

1. **不改** `showOriginal` 存储类型（保持 boolean）
2. **不碰** inline/cell 路径的 CSS
3. **不新增**设置项
4. **不用** `revert` 关键字
5. **不改** `injectTranslation` 或任何 JS
6. **不碰** options.*、storage.js、popup.js
7. `:has()` — Chrome 105+ 支持，Chrome 扩展安全使用

---

## 测试

**文件：`tests/101-hover-reveal.test.mjs`**

### 静态断言

1. CSS `body.st-replace-mode .st-translated` 包含 `opacity:\s*0`（不再用 `position: absolute`）
2. CSS `body.st-replace-mode .st-translated` 包含 `max-height:\s*0`
3. CSS `body.st-replace-mode .st-translated` 包含 `transition`
4. CSS 包含 `:has(+` 选择器（hover reveal 规则）
5. CSS `body.st-replace-mode .st-translated` **不包含** `clip-path`（旧方案已移除）
6. CSS `body.st-replace-mode .st-translated-inline` **仍包含** `font-size:\s*0`（inline/cell 未被修改）

全量 `node --test tests/*.test.mjs` 必须通过。

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `content/content.css` | block-wrapper replace mode 改为可动画隐藏 + hover reveal |
| `tests/101-hover-reveal.test.mjs` | 静态断言 |
| `tests/087-replace-bilingual-mode.test.mjs` | 旧 replace-mode 基线同步到 101 合法结构 |
