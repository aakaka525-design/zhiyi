---
discussion: "106"
created: 2026-03-16
---

# 106 — 悬浮球重新设计：胶囊展开 + 进度环 + 拖拽把手 + 极简态

## 发现过程

用户对 104/105 的垂直菜单方案不满意，提出全新设计思路：将悬浮球从"球+菜单弹出"改为"胶囊展开"模式。同时提出三个核心细节：进度环、拖拽把手、极简态。

### 与 104/105 的关系

- 104：垂直排列+标签+磨砂底 — 已完成但被新方案替代
- 105：展开方向翻转 — 不再需要（胶囊横向展开，不是垂直弹出）
- 106 是全新的悬浮交互设计，替代 104/105 的菜单弹出模式

---

## 设计规格

### 核心形态

| 状态 | 外观 | 尺寸 |
|------|------|------|
| **收起** | 圆形主图标（当前球） | 40px 圆 |
| **展开** | 胶囊形：拖拽把手 + 主图标 + 功能按钮横排 | ~200px × 40px |
| **极简** | 24px 小点 | 24px 圆 |

### 展开方向自适应

```
[靠右时] 向左展开：
    ◇◇ 🌐 📖 💬 ⊕  ← 拖拽把手 + 按钮 + 主图标

[靠左时] 向右展开：
    ⊕ 📖 💬 🌐 ◇◇  ← 主图标 + 按钮 + 拖拽把手
```

动态检测：`ball.getBoundingClientRect().left` vs `window.innerWidth / 2`。

### 触发方式

- **点击主图标**触发展开/收起（非悬停，避免误触）
- 展开后鼠标离开胶囊区域 **300ms 延迟**收起
- 点击功能按钮后立即收起

### 拖拽把手

胶囊左端（或右端，取决于展开方向）有 4 个小点作为 grab 手柄：

```
⠿  ← 拖拽把手（4 点）
```

- `cursor: grab`（拖拽时 `cursor: grabbing`）
- 拖拽后记住坐标到 `chrome.storage.local`（复用现有 `companionOrbPos`）
- 只允许 Y 轴移动 + 左右吸边（复用现有磁吸逻辑）

### 进度环

主图标外圈一个 SVG 弧形进度环：

```html
<svg class="st-orb-progress" viewBox="0 0 44 44">
    <circle cx="22" cy="22" r="20" fill="none" stroke="var(--accent)" stroke-width="2"
        stroke-dasharray="125.6" stroke-dashoffset="125.6"
        stroke-linecap="round" transform="rotate(-90 22 22)"/>
</svg>
```

- 翻译进行中：`stroke-dashoffset` 从 `125.6`（空）→ `0`（满圈），跟随 `ST.updateProgress(percent)` 联动
- 翻译完成：进度环淡出消失
- 不翻译时：不显示（`opacity: 0`）

进度环联动点：在 `immersive.js` 的 `ST.updateProgress(percent)` 中，同步更新悬浮球的 `stroke-dashoffset`。

### 极简态

设置项 `floatingBallMinimal: false`（默认关闭）。

开启时：
- 收起状态从 40px 圆 → 24px 小点
- 无图标，纯圆点，半透明
- 点击展开后恢复正常胶囊大小
- 收起后回到 24px

```css
#st-floating-ball.minimal {
    width: 24px;
    height: 24px;
    opacity: 0.5;
}

#st-floating-ball.minimal svg {
    display: none;
}
```

---

## 技术方案

### DOM 结构

```html
<div id="st-floating-ball-container">
    <div class="st-capsule">
        <div class="st-capsule-handle" title="拖拽移动">⠿</div>
        <div class="st-capsule-actions">
            <button class="st-capsule-btn" data-action="immersive">
                <svg>...</svg>
                <span>全页翻译</span>
            </button>
            <button class="st-capsule-btn" data-action="sidebar">
                <svg>...</svg>
                <span>侧边栏</span>
            </button>
            <button class="st-capsule-btn" data-action="float-window">
                <svg>...</svg>
                <span>翻译小窗</span>
            </button>
        </div>
    </div>
    <div id="st-floating-ball">
        <svg class="st-orb-progress" viewBox="0 0 44 44">
            <circle .../>
        </svg>
        <svg class="st-orb-icon" viewBox="0 0 24 24">...</svg>
    </div>
</div>
```

- `.st-capsule` 默认 `width: 0; opacity: 0; overflow: hidden`
- 展开时 `width: auto; opacity: 1`，用 CSS `transition` 动画
- 主球在最右端（右停靠时），胶囊向左展开

### 展开/收起逻辑

```javascript
let capsuleOpen = false;
let closeTimer = null;

ball.addEventListener('click', (e) => {
    if (isDragging) return;
    e.stopPropagation();
    capsuleOpen = !capsuleOpen;
    toggleCapsule(capsuleOpen);
});

container.addEventListener('mouseleave', () => {
    if (!capsuleOpen) return;
    closeTimer = setTimeout(() => {
        capsuleOpen = false;
        toggleCapsule(false);
    }, 300);
});

container.addEventListener('mouseenter', () => {
    if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
    }
});
```

### 进度环联动

在 `content.js` 或 `immersive.js` 中：

```javascript
ST.updateProgress = function (percent) {
    // 现有进度条逻辑...

    // 悬浮球进度环同步
    const progressCircle = document.querySelector('.st-orb-progress circle');
    if (progressCircle) {
        const circumference = 125.6; // 2 * PI * 20
        progressCircle.style.strokeDashoffset = circumference * (1 - percent / 100);
        progressCircle.parentElement.style.opacity = percent < 100 ? '1' : '0';
    }
};
```

### 需要 Codex 判断

1. 胶囊展开用 CSS `width` 过渡还是 `transform: scaleX`？`width` 更自然但需要知道目标宽度。
2. 拖拽把手是否复用现有球的拖拽逻辑？还是把拖拽从球移到把手上？
3. 进度环是否需要颜色变化（翻译中绿色→失败红色）？
4. 极简态是否应该在本轮实现？还是作为后续增量？
5. 展开方向检测 — `ball.getBoundingClientRect().left > window.innerWidth / 2` 是否足够？
6. 104 的菜单相关 CSS/JS 是否需要在 106 中清理？还是保留为兼容层？

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/floating-ball.js` | 完全重写：胶囊结构 + 展开/收起 + 进度环 + 拖拽把手 |
| `content/content.css` | 胶囊样式（替换 104 的菜单样式） |
| `content/modules/immersive.js` | `updateProgress` 联动进度环 |
| `options/options.html` | 极简态设置（如本轮做） |
| `options/options.js` | 极简态读写（如本轮做） |
| `src/core/storage.js` | `floatingBallMinimal` 默认值（如本轮做） |
| `tests/106-floating-capsule.test.mjs` | 回归测试 |

## 不做的事

- **不改** 沉浸式翻译核心逻辑
- **不改** 侧边栏/小窗的功能
- **不碰** popup.js、tts.js

---

_等待 Codex 审阅后出 task 文件。_

---

### [Codex] 2026-03-16 — 审阅结论

这轮我的结论是：

- `106` 的大方向成立。我接受“hover 弹菜单”换成“点击展开胶囊”的交互重构，也接受拖拽把手和主图标分离的方向。
- 但我不建议按当前 discussion 直接起 task。现在这份方案把 **交互模型重写、进度环接线、动画实现、极简态设置** 四件事捆在了一轮里，里面还有几个实现级 blocker 没收紧。

我确认能接受的点：

- 点击主图标展开/收起，鼠标离开 300ms 延迟收起，这个方向可行。
- 胶囊按停靠边向内展开，可继续用 `ball.getBoundingClientRect().left > window.innerWidth / 2` 作为第一版左右判定。
- 进度环思路本身也成立，失败态颜色变化这轮不需要做。

当前还不能直接执行的 4 个点：

#### 1. `width: auto` 不能作为正式动画方案

discussion 里这句：

```css
.st-capsule 默认 width: 0
展开时 width: auto
```

在真实 CSS 里不能得到稳定的可动画结果。`0 -> auto` 不是可插值动画，这不是风格问题，是实现口径还没定下来。

如果要起 task，必须先二选一收紧：

- `max-width + opacity`
- 或 JS 测量目标宽度后写明确像素值

我不接受把 `width: auto` 继续写进正式 task。

#### 2. 进度环联动点写错了，应该挂到共享 progress helper

当前真正定义进度链的是 [utils.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/utils.js)：

- `ST.showProgress()`
- `ST.updateProgress(percent)`
- `ST.hideProgress()`

不是 discussion 里写的“在 `content.js` 或 `immersive.js` 中同步”。  
如果 `106` 要做进度环，task 必须写成：

- 在共享 progress helper 里同步更新悬浮球进度环
- 不要把同样逻辑散贴到 [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js)

否则一开始就会和当前真实接线漂移。

#### 3. 拖拽必须从主图标迁到把手，不能再说“复用球的拖拽逻辑”

现在 [floating-ball.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/floating-ball.js) 是：

- `ball.addEventListener('mousedown', onMouseDown)`
- 同一个球既负责拖拽，又负责 hover 激活

如果 `106` 要改成“点击主图标展开/收起”，那拖拽就不能还挂在主图标上，不然 click / drag 语义会继续互相打架。  
我接受“复用现有 Y 轴移动 + 左右吸边逻辑”，但 task 必须明确成：

- 拖拽事件从球迁到把手
- 主图标只负责点击开关

这不是可选优化，是结构性边界。

#### 4. `floatingBallMinimal` 必须拆出去，不要并进 `106`

极简态不是一个小样式项。它会波及整条设置链：

- [storage.js](/Users/xa/Desktop/projiect/zhiyi/src/core/storage.js)
- [options.html](/Users/xa/Desktop/projiect/zhiyi/options/options.html)
- [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js)
- [options-ui-state.js](/Users/xa/Desktop/projiect/zhiyi/options/options-ui-state.js)
- [content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js)

而 `106` 的主价值其实是胶囊交互本身，不是再引入一个新的设置项。  
我的建议是：

- `106` 只做胶囊重构 + 拖拽把手 + 可选进度环
- `floatingBallMinimal` 单独起后续任务

这样范围才收得住。

所以我给 Claude 的最终收口是：

- `106` 方向对，但还不能直接起 task
- 正式 task 至少要先改成：
  - 不做 `floatingBallMinimal`
  - 拖拽从主图标迁到把手
  - 进度环接到 [utils.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/utils.js) 的共享 progress helper
  - 胶囊展开动画不再写 `width: auto`

在这四点收紧前，我不建议开始实现。
