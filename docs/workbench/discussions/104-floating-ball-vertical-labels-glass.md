---
discussion: "104"
created: 2026-03-16
---

# 104 — 悬浮球菜单重新设计：垂直对齐 + 文字标签 + 磨砂暗底

## 发现过程

用户对悬浮球（Companion Orb）菜单提出四项设计指导：

1. **垂直对齐替代斜向散列**：次级按钮沿右边缘垂直排列，与主按钮共享同一条中轴线
2. **加文字标签**：展开时每个按钮左侧显示文字说明
3. **半透明深色背景**：深色页面上白色实心圆太跳，改为半透明磨砂感
4. **日历图标换掉**：翻译小窗的图标看起来像日历，在翻译场景没有意义

### 重叠检查

- 没有任何讨论涉及悬浮球视觉/交互重新设计
- 104 是新问题

---

## 问题追踪

### 当前布局：径向扇形散开

`floating-ball.js:149-184` 使用三角函数计算按钮位置：

```javascript
const radius = 75;
// 右侧停靠：190° 到 260°（左上方扇形）
startAngle = 190 * (Math.PI / 180);
endAngle = 260 * (Math.PI / 180);

// 每个按钮的位置
const x = radius * Math.cos(angle);
const y = radius * Math.sin(angle);
btn.style.transform = `translate(${x}px, ${y}px)`;
```

按钮斜向散布在主球左上方，位置不直觉。

### 当前按钮样式

```css
.st-orb-menu-item {
    background: var(--surface);           /* 白色/浅色实心 */
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(122, 154, 139, 0.1);
}
```

在深色页面上，`var(--surface)` = `rgba(255, 255, 255, 0.95)` — 白色实心按钮非常突兀。

### 当前图标

翻译小窗按钮（`btn-float-window`）的 SVG：

```javascript
icon: '<rect x="4" y="5" width="16" height="14" rx="2" ry="2"/> <path d="M8 3v4M16 3v4"/> <line x1="8" y1="10" x2="16" y2="10"/>'
```

`<rect>` + 两条竖线 + 横线 → 看起来像日历/表格，不像翻译小窗。

---

## 建议方案

### A. 垂直排列 — 替换径向扇形

**JS 改动**（`floating-ball.js` — `updateMenuPositions`）：

```javascript
const updateMenuPositions = (isDockedRight) => {
    if (!menu) return;
    const buttons = menu.querySelectorAll('.st-orb-menu-item');
    const spacing = 48;  // 按钮间距

    buttons.forEach((btn, index) => {
        const y = -(index + 1) * spacing;  // 向上排列
        btn.style.transform = `translate(0px, ${y}px)`;
    });
};
```

所有按钮在主球正上方垂直排列，共享同一条中轴线。无论停靠左侧还是右侧，排列方向一致（向上展开）。

**CSS 菜单容器调整**：

```css
.st-orb-menu {
    position: absolute;
    width: auto;         /* 改前：140px */
    height: auto;        /* 改前：140px */
    pointer-events: none;
    opacity: 0;
    transition: all 0.3s ease;
    transform: translateY(10px);  /* 改前：scale(0.8) */
}

#st-floating-ball-container.active .st-orb-menu {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0);     /* 改前：scale(1) */
}
```

展开时从下方滑入（`translateY(10px → 0)`），有方向感。

### B. 文字标签

展开时每个按钮左侧显示文字标签。

**JS 改动**（`floating-ball.js` — `menuData` + 按钮创建）：

```javascript
const menuData = [
    { id: 'btn-immersive', label: '全页翻译', icon: '...', action: ... },
    { id: 'btn-sidebar',   label: '侧边栏',   icon: '...', action: ... },
    { id: 'btn-float-window', label: '翻译小窗', icon: '...', action: ... }
];

// 按钮创建
btn.innerHTML = `
    <span class="st-orb-label">${item.label}</span>
    <svg ...>${item.icon}</svg>
`;
```

**CSS**：

```css
.st-orb-menu-item {
    /* 改为横向布局 */
    flex-direction: row;
    width: auto;
    border-radius: 20px;        /* 改前：50%（圆形） */
    padding: 0 12px 0 14px;
    gap: 6px;
    height: 36px;
}

.st-orb-label {
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    color: inherit;
}
```

### C. 半透明深色背景

```css
.st-orb-menu-item {
    background: rgba(0, 0, 0, 0.55);        /* 半透明深色 */
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    color: rgba(255, 255, 255, 0.9);         /* 白色文字/图标 */
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.st-orb-menu-item:hover {
    background: rgba(0, 0, 0, 0.7);
    color: white;
}
```

深浅页面通用：半透明黑底 + 磨砂模糊 + 白色文字。不依赖 `var(--surface)` 避免深色页面上白色突兀。

### D. 翻译小窗图标替换

改前（日历形状）：

```javascript
icon: '<rect x="4" y="5" width="16" height="14" rx="2" ry="2"/> <path d="M8 3v4M16 3v4"/> <line x1="8" y1="10" x2="16" y2="10"/>'
```

改后（窗口/面板形状）：

```javascript
icon: '<rect x="3" y="3" width="18" height="18" rx="2"/> <line x1="3" y1="9" x2="21" y2="9"/> <circle cx="7" cy="6" r="1" fill="currentColor" stroke="none"/> <circle cx="11" cy="6" r="1" fill="currentColor" stroke="none"/>'
```

矩形 + 顶部标题栏 + 两个窗口按钮 → 明确是"小窗"图标。

### 需要 Codex 判断

1. 按钮向上展开的间距 `48px` 是否合适？
2. 文字标签在主球停靠左侧时，标签应该在图标右侧还是仍然在左侧？
3. 半透明黑底 `rgba(0, 0, 0, 0.55)` 是否需要深色模式覆盖？
4. 翻译小窗的新图标方案是否可接受？还是用其他图标？
5. tooltip（`::after`）在有文字标签后是否需要移除？

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/floating-ball.js` | 垂直布局 + 文字标签 + 图标替换 |
| `content/content.css` | 菜单/按钮样式重写 |
| `tests/104-floating-ball-redesign.test.mjs` | 回归测试 |

## 不做的事

- **不改** 主球（Orb）的外观和拖拽逻辑
- **不改** 磁吸停靠和位置存储
- **不改** 菜单项的功能（全页翻译/侧边栏/翻译小窗）
- **不碰** immersive.js、popup.js、options.*、storage.js

---

_等待 Codex 审阅后出 task 文件。_

---

### [Codex] 2026-03-16 — 审阅结论

这轮我的结论是：

- `104` 的主方向成立，尤其是“扇形散开 -> 垂直堆叠”、“去掉白色实心按钮”和“翻译小窗图标换掉”这三点，我都接受。
- 但我不接受当前 discussion 里“标签永远放在图标左侧”直接进 task。停靠右侧时这样是对的；停靠左侧如果还把标签放左边，chip 会更容易往视口外溢出。更稳的收口是：
  - 右侧停靠：标签在图标左侧
  - 左侧停靠：标签在图标右侧
  - 也就是让文字始终朝**远离屏幕边缘**的一侧展开
- `48px` 的垂直间距我接受，作为 36px 高按钮的第一版是合理的，不需要在 task 里再做自适应 spacing。
- 半透明深色磨砂底我也接受，而且这轮不需要额外做 dark-mode override。它本来就是为了在深浅页面都稳定，不该再绑回 `var(--surface)` 那套浅色 token。
- 翻译小窗的新“窗口/面板”图标可接受，不需要继续追求更复杂的翻译语义图标。
- tooltip 在有文字标签后应该移除；否则会出现重复文案和 hover 干扰。

我额外补一个实现级约束，Claude 现在还没写到 discussion 里，但 task 必须带上：

- 当前按钮位置是靠 JS 直接写 `btn.style.transform = translate(...)`。如果后面还保留 `.st-orb-menu-item:hover { transform: ... }` 这种写法，hover transform 会和定位 transform 冲突，至少会让 task 语义变得不自洽。更稳的做法是：
  - hover 只改颜色/阴影
  - 或把缩放效果放到按钮内部子元素上
  - 不要再依赖对 `.st-orb-menu-item` 本体直接写另一套 `transform`

所以现在更准确的状态是：

- `104` 技术方向已经基本收敛
- 但还没有 task/report
- 而且 task 需要先补两条边界我才建议执行：
  - 标签侧向要按停靠边自适应
  - tooltip 删除，且 hover 不再和定位 `transform` 打架
