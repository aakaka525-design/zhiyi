---
task: "106"
status: done
priority: P1
created: 2026-03-16
scope: "悬浮球胶囊重构：点击展开 + 拖拽把手 + 进度环（不含极简态）"
---

# 106 — 悬浮球胶囊重构

## 范围

悬浮球从"球+弹出菜单"改为"胶囊展开"模式。拖拽从主球迁到把手。进度环联动共享 progress helper。**不做极简态**（留后续）。

---

## 改动

### 1. DOM 结构重写

**文件：`content/modules/floating-ball.js`**

```html
<div id="st-floating-ball-container">
    <div class="st-capsule">
        <div class="st-capsule-handle" title="拖拽移动">
            <svg width="6" height="14" viewBox="0 0 6 14">
                <circle cx="1.5" cy="2" r="1.2" fill="currentColor"/>
                <circle cx="4.5" cy="2" r="1.2" fill="currentColor"/>
                <circle cx="1.5" cy="7" r="1.2" fill="currentColor"/>
                <circle cx="4.5" cy="7" r="1.2" fill="currentColor"/>
                <circle cx="1.5" cy="12" r="1.2" fill="currentColor"/>
                <circle cx="4.5" cy="12" r="1.2" fill="currentColor"/>
            </svg>
        </div>
        <button class="st-capsule-btn" data-action="immersive">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                <circle cx="12" cy="12" r="10"/>
            </svg>
            <span>全页翻译</span>
        </button>
        <button class="st-capsule-btn" data-action="sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
            <span>侧边栏</span>
        </button>
        <button class="st-capsule-btn" data-action="float-window">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <circle cx="7" cy="6" r="1" fill="currentColor" stroke="none"/>
                <circle cx="11" cy="6" r="1" fill="currentColor" stroke="none"/>
            </svg>
            <span>翻译小窗</span>
        </button>
    </div>
    <div id="st-floating-ball">
        <svg class="st-orb-progress" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="20" fill="none" stroke="var(--accent)"
                stroke-width="2.5" stroke-dasharray="125.6" stroke-dashoffset="125.6"
                stroke-linecap="round" transform="rotate(-90 22 22)"/>
        </svg>
        <svg class="st-orb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/>
            <line x1="16" y1="8" x2="2" y2="22"/>
            <line x1="17.5" y1="15" x2="9" y2="15"/>
        </svg>
    </div>
</div>
```

### 2. 交互逻辑

**点击主球 → 展开/收起胶囊**：

```javascript
let capsuleOpen = false;
let closeTimer = null;

ball.addEventListener('click', (e) => {
    if (isDragging) return;
    e.stopPropagation();
    capsuleOpen = !capsuleOpen;
    container.classList.toggle('capsule-open', capsuleOpen);
});
```

**300ms 延迟收起**：

```javascript
container.addEventListener('mouseleave', () => {
    if (!capsuleOpen) return;
    closeTimer = setTimeout(() => {
        capsuleOpen = false;
        container.classList.remove('capsule-open');
    }, 300);
});

container.addEventListener('mouseenter', () => {
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
});
```

**按钮点击后立即收起**：

```javascript
capsuleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    item.action();
    capsuleOpen = false;
    container.classList.remove('capsule-open');
});
```

### 3. 拖拽从主球迁到把手

**拖拽事件绑在 `.st-capsule-handle`**：

```javascript
handle.addEventListener('mousedown', onMouseDown);  // 把手负责拖拽
// ball 不再绑 mousedown — 只负责点击展开
```

复用现有 `onMouseDown / onMouseMove / onMouseUp` + Y 轴移动 + 左右吸边 + `companionOrbPos` 持久化。

### 4. 展开方向自适应

```javascript
function updateCapsuleDirection() {
    const ballRect = ball.getBoundingClientRect();
    const expandLeft = ballRect.left > window.innerWidth / 2;
    container.classList.toggle('expand-left', expandLeft);
    container.classList.toggle('expand-right', !expandLeft);
}
```

在 `dockToEdge` 和展开时调用。

### 5. 胶囊展开动画（`max-width + opacity`）

**文件：`content/content.css`**

```css
.st-capsule {
    display: flex;
    align-items: center;
    gap: 4px;
    max-width: 0;
    opacity: 0;
    overflow: hidden;
    transition: max-width 0.3s ease, opacity 0.25s ease;
    pointer-events: none;
}

#st-floating-ball-container.capsule-open .st-capsule {
    max-width: 300px;    /* 固定上限，不用 auto */
    opacity: 1;
    pointer-events: auto;
}
```

**不用 `width: auto`**。`max-width: 0 → 300px` 可插值动画。

**展开方向 CSS**：

```css
/* 右停靠：胶囊在球左侧展开 */
#st-floating-ball-container.expand-left {
    flex-direction: row-reverse;
}

/* 左停靠：胶囊在球右侧展开 */
#st-floating-ball-container.expand-right {
    flex-direction: row;
}
```

### 6. 按钮样式（半透明磨砂暗底）

```css
.st-capsule-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 10px;
    border-radius: 8px;
    border: none;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    color: rgba(255, 255, 255, 0.9);
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    transition: background 0.2s ease;
}

.st-capsule-btn:hover {
    background: rgba(0, 0, 0, 0.7);
}

.st-capsule-btn svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
}

.st-capsule-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 34px;
    cursor: grab;
    color: rgba(255, 255, 255, 0.5);
    flex-shrink: 0;
}

.st-capsule-handle:active {
    cursor: grabbing;
}
```

### 7. 进度环 — 联动 `utils.js` 共享 progress helper

**文件：`content/modules/utils.js`**

在 `ST.updateProgress` 中同步进度环：

```javascript
ST.updateProgress = function (percent) {
    if (ST.ui.progress) {
        ST.ui.progress.style.width = `${percent}%`;
    }
    // 进度环同步
    const circle = document.querySelector('.st-orb-progress circle');
    if (circle) {
        const circumference = 125.6;
        circle.style.strokeDashoffset = circumference * (1 - percent / 100);
    }
};
```

在 `ST.showProgress` 中显示进度环：

```javascript
ST.showProgress = function () {
    // ... 现有逻辑 ...
    const progress = document.querySelector('.st-orb-progress');
    if (progress) progress.style.opacity = '1';
};
```

在 `ST.hideProgress` 中隐藏进度环：

```javascript
ST.hideProgress = function () {
    // ... 现有逻辑 ...
    const progress = document.querySelector('.st-orb-progress');
    if (progress) {
        setTimeout(() => { progress.style.opacity = '0'; }, 500);
    }
};
```

进度环 CSS：

```css
.st-orb-progress {
    position: absolute;
    width: 44px;
    height: 44px;
    top: -2px;
    left: -2px;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
}

.st-orb-progress circle {
    transition: stroke-dashoffset 0.3s ease;
}
```

### 8. 清理 104 遗留

移除 104 的菜单相关代码：
- JS：删除 `menuData` 的 `st-orb-menu-item` 创建、`updateMenuPositions`（径向和垂直版本）、tooltip 相关
- CSS：删除 `.st-orb-menu`、`.st-orb-menu-item`、`.st-orb-label` 等 104 新增的规则

### 9. token scope

`#st-floating-ball-container` 已在 content.css 的基础和 dark token scope 中。新增的 `.st-capsule` 等子元素通过继承获取变量。无需额外添加。

---

## 约束

1. **不做极简态**（`floatingBallMinimal` 留后续）
2. **拖拽从主球迁到把手**（主球只负责点击展开）
3. **进度环接到 `utils.js` 的共享 progress helper**（不散贴到 immersive.js）
4. **胶囊展开用 `max-width: 0 → 300px`**（不用 `width: auto`）
5. **进度环不做失败态颜色变化**
6. **不碰** immersive.js 的翻译逻辑、popup.js、options.*、storage.js

---

## 测试

**文件：`tests/106-floating-capsule.test.mjs`**

### 静态断言

1. JS **不包含** `Math.cos` / `Math.sin`（径向扇形已清理）
2. JS **不包含** `st-orb-menu-item`（104 菜单已清理）
3. JS 包含 `st-capsule-handle`（拖拽把手）
4. JS 包含 `st-capsule-btn`（胶囊按钮）
5. JS 包含 `capsule-open`（展开状态 class）
6. CSS 包含 `.st-capsule` 规则
7. CSS `.st-capsule` 包含 `max-width`（不用 `width: auto`）
8. CSS **不包含** `.st-orb-menu-item`（104 规则已清理）
9. `utils.js` 的 `updateProgress` 包含 `st-orb-progress`（进度环联动）

全量 `node --test tests/*.test.mjs` 必须通过。

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `content/modules/floating-ball.js` | 完全重写：胶囊 DOM + 展开/收起 + 拖拽迁移 + 清理 104 |
| `content/content.css` | 胶囊样式 + 进度环 CSS + 清理 104 菜单 CSS |
| `content/modules/utils.js` | `showProgress/updateProgress/hideProgress` 联动进度环 |
| `tests/106-floating-capsule.test.mjs` | 静态断言 |
