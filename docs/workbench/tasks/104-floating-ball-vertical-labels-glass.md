---
task: "104"
status: done
priority: P2
created: 2026-03-16
scope: "悬浮球菜单：垂直排列 + 文字标签 + 磨砂暗底 + 图标替换"
---

# 104 — 悬浮球菜单重新设计

## 范围

悬浮球次级菜单从径向扇形改为垂直堆叠，加文字标签，半透明深色磨砂底，翻译小窗图标替换。

---

## 改动

### 1. 垂直排列

**文件：`content/modules/floating-ball.js` — `updateMenuPositions`**

改前（径向扇形）：

```javascript
const updateMenuPositions = (isDockedRight) => {
    // ... 三角函数计算 ...
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    btn.style.transform = `translate(${x}px, ${y}px)`;
};
```

改后（垂直堆叠）：

```javascript
const updateMenuPositions = (isDockedRight) => {
    if (!menu) return;
    const buttons = menu.querySelectorAll('.st-orb-menu-item');
    const spacing = 48;

    buttons.forEach((btn, index) => {
        const y = -(index + 1) * spacing;
        btn.style.transform = `translate(0px, ${y}px)`;
    });

    // 标签方向：远离屏幕边缘
    menu.classList.toggle('dock-left', !isDockedRight);
};
```

### 2. 文字标签（按停靠边自适应方向）

**JS**（按钮创建）：

```javascript
btn.innerHTML = `
    <span class="st-orb-label">${item.label}</span>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${item.icon}</svg>
`;
```

**CSS**：

```css
.st-orb-menu-item {
    display: flex;
    flex-direction: row;           /* 默认：标签在图标左侧（右侧停靠） */
    align-items: center;
    width: auto;
    height: 36px;
    border-radius: 20px;
    padding: 0 12px 0 14px;
    gap: 6px;
}

/* 左侧停靠时：标签在图标右侧 */
.st-orb-menu.dock-left .st-orb-menu-item {
    flex-direction: row-reverse;
    padding: 0 14px 0 12px;
}

.st-orb-label {
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    color: inherit;
}
```

标签始终朝**远离屏幕边缘**的一侧展开。

### 3. 半透明深色磨砂底

```css
.st-orb-menu-item {
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    color: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    cursor: pointer;
    transition: background 0.2s ease, box-shadow 0.2s ease;
}

.st-orb-menu-item:hover {
    background: rgba(0, 0, 0, 0.7);
    color: white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}
```

**不做 dark-mode override**。半透明黑底在深浅页面都稳定。

**hover 不用 `transform`**：只改 `background` / `box-shadow`。避免与定位的 `translate(0, Ypx)` 冲突。

### 4. 翻译小窗图标替换

改前（日历形）：

```javascript
icon: '<rect x="4" y="5" width="16" height="14" rx="2" ry="2"/> <path d="M8 3v4M16 3v4"/> <line x1="8" y1="10" x2="16" y2="10"/>'
```

改后（窗口/面板形）：

```javascript
icon: '<rect x="3" y="3" width="18" height="18" rx="2"/> <line x1="3" y1="9" x2="21" y2="9"/> <circle cx="7" cy="6" r="1" fill="currentColor" stroke="none"/> <circle cx="11" cy="6" r="1" fill="currentColor" stroke="none"/>'
```

### 5. 移除 tooltip

有文字标签后 tooltip 冗余。

**CSS 删除**：

```css
/* 删除 */
.st-orb-menu-item::after { ... }
.st-orb-menu-item:hover::after { ... }
```

**JS 删除**：按钮创建时移除 `btn.setAttribute('data-tooltip', item.title)`。

### 6. 菜单容器调整

```css
.st-orb-menu {
    position: absolute;
    width: auto;
    height: auto;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s ease, transform 0.3s ease;
    transform: translateY(10px);
}

#st-floating-ball-container.active .st-orb-menu {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0);
}
```

展开：从下方滑入。收起：向下滑出。

---

## 约束

1. **标签方向按停靠边自适应**：右停靠 → 标签左侧；左停靠 → 标签右侧（`flex-direction: row-reverse`）
2. **hover 不用 `transform`**：只改颜色/阴影，不和定位 `translate` 冲突
3. **不做 dark-mode override**：半透明黑底深浅通用
4. **移除 tooltip**（`::after` + `data-tooltip`）
5. **不改** 主球外观 / 拖拽 / 磁吸 / 位置存储
6. **不改** 菜单项功能
7. **不碰** immersive.js、popup.js、options.*、storage.js

---

## 测试

**文件：`tests/104-floating-ball-redesign.test.mjs`**

### 静态断言

1. JS `updateMenuPositions` **不包含** `Math.cos` / `Math.sin`（径向扇形已移除）
2. JS 按钮创建包含 `st-orb-label`（文字标签）
3. JS 按钮创建**不包含** `data-tooltip`
4. CSS **不包含** `.st-orb-menu-item::after`（tooltip 已移除）
5. CSS `.st-orb-menu-item` 包含 `backdrop-filter`
6. CSS `.st-orb-menu-item:hover` **不包含** `transform`（不和定位冲突）
7. CSS 包含 `.dock-left`（标签方向自适应）

全量 `node --test tests/*.test.mjs` 必须通过。

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `content/modules/floating-ball.js` | 垂直布局 + 标签 + 图标 + 移除 tooltip |
| `content/content.css` | 菜单/按钮样式重写 |
| `tests/104-floating-ball-redesign.test.mjs` | 静态断言 |
