---
task: "100"
status: done
priority: P2
created: 2026-03-15
scope: "Popup 视觉：去渐变 + 语言栏圆角 + 翻译按钮减重（dark-mode-safe）"
---

# 100 — Popup 视觉优化

## 范围

纯 CSS 改动。不碰 popup.html / popup.js / theme.css。

---

## 改动

**文件：`popup/popup.css`**

### A — 头部去渐变

**删除**整个 `.popup-container::before` 规则（当前 line 17-27）：

```css
/* 删除 */
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

`.popup-header` 的 `z-index: 1` 保留（轻微冗余，不是 blocker）。

### B — 语言栏圆角（popup-scope 变量）

在 `.popup-container` 规则中添加局部变量，然后在 `.language-selector` 中使用：

```css
.popup-container {
    /* ... 现有属性 ... */
    --popup-lang-radius: 10px;
}

.language-selector {
    /* ... */
    border-radius: var(--popup-lang-radius);  /* 改前：var(--radius-xl) */
    /* ... */
}
```

### C — 翻译按钮减重（dark-mode-safe 局部变量）

在 `.popup-container` 中定义按钮局部变量，在 `body.dark-mode .popup-container` 中覆写：

```css
.popup-container {
    /* ... 现有属性 ... */
    --popup-lang-radius: 10px;
    --popup-translate-bg: rgba(122, 154, 139, 0.12);
    --popup-translate-bg-hover: rgba(122, 154, 139, 0.2);
    --popup-translate-border: rgba(122, 154, 139, 0.2);
}

body.dark-mode .popup-container {
    --popup-translate-bg: rgba(143, 179, 164, 0.15);
    --popup-translate-bg-hover: rgba(143, 179, 164, 0.25);
    --popup-translate-border: rgba(143, 179, 164, 0.25);
}
```

更新 `.translate-btn` 和 `.translate-btn:hover`：

改前：

```css
.translate-btn {
    background: var(--accent);
    color: white;
    box-shadow: 0 4px 12px var(--accent-glow);
}

.translate-btn:hover {
    background: var(--accent-light);
    box-shadow: 0 6px 16px var(--accent-glow);
}
```

改后：

```css
.translate-btn {
    background: var(--popup-translate-bg);
    color: var(--accent);
    border: 1px solid var(--popup-translate-border);
    box-shadow: none;
}

.translate-btn:hover {
    background: var(--popup-translate-bg-hover);
    transform: translateY(-1px);
    box-shadow: none;
}
```

**`.translate-btn:active` 保留不变**（`transform: translateY(0)`）。

---

## 约束

1. **B 不裸写 `10px`**：用 popup-scope 变量 `--popup-lang-radius`
2. **C dark-mode-safe**：popup 局部变量 + `body.dark-mode .popup-container` 覆写
3. **保留** `.translate-btn:active` 的交互反馈
4. **不改** popup.html / popup.js / theme.css
5. **不碰** options、content、immersive

---

## 测试

**文件：`tests/100-popup-visual-polish.test.mjs`**

### 静态断言

1. `popup.css` **不包含** `.popup-container::before`（渐变已删）
2. `popup.css` 包含 `--popup-lang-radius`
3. `.language-selector` 使用 `var(--popup-lang-radius)`，不使用 `var(--radius-xl)`
4. `popup.css` 包含 `--popup-translate-bg`
5. `popup.css` 包含 `body.dark-mode .popup-container`（dark mode 覆写）
6. `.translate-btn` 不包含 `color:\s*white`（不再白色文字）

全量 `node --test tests/*.test.mjs` 必须通过。

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `popup/popup.css` | A（删 ::before）+ B（lang radius 变量）+ C（按钮减重 + dark mode） |
| `tests/100-popup-visual-polish.test.mjs` | 静态断言 |

## 完成情况

- [x] 删除 popup 头部装饰性渐变光球
- [x] 语言栏圆角改为 popup-scope 变量 `--popup-lang-radius`
- [x] 翻译按钮改为浅填充 + 绿色文字 + 无 glow，并补齐 dark-mode 覆写
- [x] 保留 `.translate-btn:active` 交互反馈
- [x] 新增 `100` 专项测试
- [x] `/opt/homebrew/bin/node --test tests/*.test.mjs`
