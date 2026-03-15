---
task: "098"
status: done
priority: P2
created: 2026-03-15
scope: "节点级 --st-page-color 颜色恢复（replace mode 深色页面适配）"
---

# 098 — 深色页面译文颜色不可见 — 节点级颜色恢复

## 范围

`injectTranslation` 捕获原容器文本色存为 `--st-page-color`。替换模式 CSS 使用此变量。关闭时清理。不碰全局 content theme。

---

## 改动

### 1. JS — `injectTranslation` 捕获原容器文本色

**文件：`content/modules/immersive.js` — `injectTranslation` 函数**

在函数入口、路径判定之前（`getComputedStyle(container)` 已在 line 392 附近调用），捕获文本色：

```javascript
ST.injectTranslation = function (container, translation) {
    if (!document.contains(container)) return;
    const nextSibling = container.nextElementSibling;
    if (nextSibling && nextSibling.classList.contains('st-immersive-wrapper')) return;
    if (container.querySelector('.st-immersive-translation')) return;

    // ← 新增：捕获原容器文本色（在任何 class/style 修改之前）
    const originalColor = window.getComputedStyle(container).color;

    const parentStyle = container.parentNode ? window.getComputedStyle(container.parentNode) : null;
    // ... 现有路径判定 ...
```

在三条路径中，将 `--st-page-color` 设置到正确的元素上：

```javascript
if (isFlexItem || isGridItem || isInline) {
    container.style.setProperty('--st-page-color', originalColor);  // ← 新增
    container.classList.add('st-translated-inline');
    container.appendChild(transEl);
} else if (container.matches('td, th, li, figcaption, dt, dd, caption')) {
    const blockTransEl = document.createElement('div');
    blockTransEl.className = 'st-immersive-translation';
    blockTransEl.innerText = translation;
    container.style.setProperty('--st-page-color', originalColor);  // ← 新增
    container.classList.add('st-translated-inline');
    container.appendChild(blockTransEl);
} else {
    // ... wrapper 创建 ...
    wrapper.style.setProperty('--st-page-color', originalColor);    // ← 新增（设在 wrapper 上）
    container.classList.add('st-translated');
    if (container.parentNode) {
        container.parentNode.insertBefore(wrapper, container.nextSibling);
    }
}
```

### 2. CSS — 替换模式使用 `--st-page-color`

**文件：`content/content.css`**

更新现有替换模式规则：

改前：

```css
body.st-replace-mode .st-immersive-translation {
    border-left: none;
    background: transparent;
    padding: 0;
    margin: 0;
}

body.st-replace-mode .st-translated-inline > .st-immersive-translation {
    font-size: 0.9rem !important;
    line-height: 1.65 !important;
    color: var(--text-primary) !important;
}
```

改后：

```css
body.st-replace-mode .st-immersive-translation {
    border-left: none;
    background: transparent;
    padding: 0;
    margin: 0;
    color: var(--st-page-color, var(--text-primary));
}

body.st-replace-mode .st-translated-inline > .st-immersive-translation {
    font-size: 0.9rem !important;
    line-height: 1.65 !important;
    color: var(--st-page-color, var(--text-primary)) !important;
}
```

`var(--st-page-color, var(--text-primary))`：有捕获值用捕获值，无则回退 `--text-primary`。

### 3. 关闭时清理 `--st-page-color`

**文件：`content/modules/immersive.js` — `toggleImmersive` 关闭路径**

在现有的 class 清理之后添加：

```javascript
document.querySelectorAll('[style*="--st-page-color"]').forEach(el => {
    el.style.removeProperty('--st-page-color');
});
```

---

## 约束

1. **只影响沉浸式译文的替换模式颜色**
2. **不改** 双语模式颜色（继续用 `var(--accent)`）
3. **不改** 全局 `data-st-theme` / `applyContentTheme`
4. **不碰** bubble / sidebar / float-window / toast 的颜色
5. **不碰** content.js、options.*、storage.js、popup.js
6. **关闭时清理** `--st-page-color`（不留 residual）

---

## 测试

**文件：`tests/098-dark-page-color.test.mjs`**

### 静态断言

1. `immersive.js` 的 `injectTranslation` 包含 `--st-page-color`
2. `content.css` 的 replace mode 规则包含 `var(--st-page-color`
3. `immersive.js` 的 `toggleImmersive` 关闭路径包含 `--st-page-color` 清理

### Runtime harness

4. **inline 路径设置 `--st-page-color` 在容器上**：构造 inline 容器（模拟 `computedStyle.color = 'rgb(200, 200, 200)'`）→ `injectTranslation` → 断言 `container.style.getPropertyValue('--st-page-color')` 包含颜色值
5. **block wrapper 路径设置 `--st-page-color` 在 wrapper 上**：构造 block 容器 → `injectTranslation` → 断言 wrapper 有 `--st-page-color`
6. **关闭清理**：构造含 `--st-page-color` 的元素 → `toggleImmersive()` 关闭 → 断言属性已移除

全量 `node --test tests/*.test.mjs` 必须通过。

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `content/modules/immersive.js` | `injectTranslation` 捕获颜色 + 关闭清理 |
| `content/content.css` | replace mode 规则使用 `--st-page-color` |
| `tests/098-dark-page-color.test.mjs` | 静态 + runtime 测试 |

## 完成情况

- [x] `injectTranslation` 在 inline / cell / wrapper 三条路径写入 `--st-page-color`
- [x] replace mode 译文颜色改为 `var(--st-page-color, var(--text-primary))`
- [x] 关闭沉浸式翻译时清理 `--st-page-color`
- [x] 新增 `098` 专项测试并同步更新受影响的旧静态断言
- [x] `/opt/homebrew/bin/node --test tests/*.test.mjs`
