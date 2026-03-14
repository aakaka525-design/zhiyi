# 047 — 保存按钮仅 API 标签可见 & 悬浮球缺少 resize 监听

## 背景

046 完成了划词气泡竞态守卫和 offscreen 单实例音频。本轮聚焦两个独立的 UX 问题：Options 页面的保存按钮在非 API 标签页不可见，以及悬浮球在窗口缩小后可能移出视口。

---

## A. Options 保存按钮仅在 API 标签可见 (P1)

### 现象

用户在 Options 页面的「常规设置」标签修改目标语言、划词翻译开关、快捷键开关、悬浮球开关、广告屏蔽开关后，找不到保存按钮。必须切换到「API 服务」标签才能看到保存按钮并点击保存。

011-B3 已经加了 dirty state 跟踪（`setDirtyState` / `refreshDirtyState`）和 `beforeunload` 离开提示，但保存按钮本身不可见的问题没有解决 — 用户能感知到"有未保存的更改"（离开时弹窗），却不知道在哪里保存。

### 代码定位

**`options/options.html`**：

```html
<!-- line 64 -->
<section id="general" class="tab-content active">
    <!-- ... 常规设置控件 ... -->
</section>

<!-- line 200+ -->
<section id="api" class="tab-content">
    <!-- ... API 配置 ... -->
    <!-- line 394 -->
    <button class="btn btn-primary" style="margin-top: 20px;" id="save-btn">保存并应用配置</button>
</section>    <!-- ← 保存按钮在这里，随 section 一起隐藏 -->
```

**`options/options.css`**：

```css
.tab-content { display: none; }       /* line 99-100 */
.tab-content.active { display: block; } /* line 106-107 */
```

**结果**：当 `#general` 是 active 时，`#api` 是 `display: none`，按钮不可见。同理，History 和 About 标签页也看不到保存按钮。

**受影响的控件**（常规标签，非自动保存）：

| 控件 | ID | 类型 |
|------|-----|------|
| 目标语言 | `default-target-lang` | select |
| 划词翻译 | `enable-selection` | checkbox |
| 快捷键支持 | `enable-shortcut` | checkbox |
| 悬浮翻译球 | `show-floating-ball` | checkbox |
| 广告屏蔽 | `enable-ad-block` | checkbox |

深色模式和调试模式有自动保存（`options.js:149-157`），不受影响。

### 修复思路

把 `<button id="save-btn">` 从 `<section id="api">` 移出来，放到所有 `<section>` 之后、`</main>` 之前。这样无论哪个标签激活，保存按钮都可见。

```html
<!-- 改前 -->
<section id="api" class="tab-content">
    <!-- ... API 配置 ... -->
    <button class="btn btn-primary" style="margin-top: 20px;" id="save-btn">保存并应用配置</button>
</section>

<!-- 改后 -->
<section id="api" class="tab-content">
    <!-- ... API 配置 ... -->
</section>

<!-- 历史、关于 sections ... -->

<button class="btn btn-primary" style="margin-top: 20px;" id="save-btn">保存并应用配置</button>
```

需要确认的一个细节：保存按钮移出 section 后的 CSS 定位。当前按钮用的 `style="margin-top: 20px;"`，可能需要额外调整让它在视觉上合理（比如 sticky 在底部，或者固定在内容区底部）。

另一种选择是在 History/About 标签隐藏保存按钮（因为这两个标签没有需要手动保存的设置），只在 General 和 API 标签显示。但这增加了逻辑复杂度，不如统一显示简单。

---

## B. 悬浮球缺少 window resize 监听 (P3)

### 现象

悬浮球在页面加载或拖拽结束时通过 `dockToEdge()` 定位，将 Y 坐标限制在 `[50, window.innerHeight - 50]` 范围内。但如果用户在悬浮球可见时缩小浏览器窗口（或旋转移动设备），悬浮球可能超出新的视口范围，完全不可见。

### 代码定位

**`content/modules/floating-ball.js`**：

```javascript
// line 126-140 — dockToEdge 只在 init 和 drag 结束时被调用
const dockToEdge = (y, isRight) => {
    const safeY = Math.max(50, Math.min(y, window.innerHeight - 50));
    container.style.top = `${safeY}px`;
    if (isRight) {
        container.style.right = '0px';
        container.style.left = 'auto';
    } else {
        container.style.left = '0px';
        container.style.right = 'auto';
    }
};
```

**调用路径**：
1. `createOrb()` → 读取 `chrome.storage.local` → `dockToEdge(saved.top, saved.isRight)` （line 115-119）
2. `onMouseUp` → 拖拽结束 → `dockToEdge(e.clientY, isRight)` （line 237）

没有 `window.addEventListener('resize', ...)` 来在视口变化时重新 clamp 位置。

### 修复思路

在 `createOrb()` 末尾加 `window.addEventListener('resize', ...)` 监听器，触发时重新调用 `dockToEdge()` 将悬浮球限制在可见范围内。需要读取当前位置信息：

```javascript
// createOrb() 末尾
window.addEventListener('resize', () => {
    if (!container || container.style.display === 'none') return;
    const currentTop = parseInt(container.style.top, 10) || window.innerHeight * 0.8;
    const isRight = container.style.right === '0px';
    dockToEdge(currentTop, isRight);
});
```

`resize` 事件会高频触发，可以考虑加 throttle，但 `dockToEdge()` 只做简单 DOM 赋值，性能影响微乎其微，不加也可以。

---

## 不涉及的范围

- **不改** options.js 的 `saveSettings()` 函数本身
- **不改** options.js 的 dirty state 逻辑（011-B3 的成果）
- **不改** options.js 的 `bindEvents()`、`switchTab()` 逻辑
- **不改** floating-ball 的拖拽逻辑、菜单逻辑、创建逻辑
- **不改** floating-ball 的 `syncVisibility()` / `init()` 函数
- **不碰** popup.js、sidebar.js、float-window.js、selection.js、immersive.js、menus.js、content.js、service-worker.js、tts.js、offscreen.js、storage.js、translator.js、ad-blocker.js、manifest.json

### [Codex] 2026-03-13 — 对 047 的收口

这两个问题我都确认成立，但 task 里还有 2 个实现边界要先写实，不然执行时容易留下半修状态。

- `A` 是真实 UX 问题，根因判断没问题：`#save-btn` 现在跟着 `#api.tab-content` 一起被 `display: none` 隐藏，切到 `general / history / about` 时就看不到保存入口。
- 但 `A` 不能只写成“把按钮移到所有 section 后面”。当前内容区的居中和宽度约束是挂在 `.tab-content { max-width: 900px; margin: 0 auto; }` 上的；如果把裸按钮直接移到 `</main>` 前，它会脱离这层约束，水平对齐会和页面主体错开。更稳的最小修法应该是：
  - 把 `#save-btn` 移出 `#api`
  - 同时给它包一个共享 action 容器，例如 `options-actions`
  - 这个容器复用 `max-width: 900px; margin: 20px auto 0;`
- `A` 我不建议再加“只在 General / API 显示”的额外逻辑。现有 dirty state、`beforeunload` 和 `saveSettings()` 都已经围绕全局 `elements.saveBtn` 收好了；保持按钮全局可见更简单，也不需要动 `switchTab()`。

- `B` 也是真问题，`floating-ball.js` 目前确实只在初始加载和拖拽结束时 `dockToEdge()`。
- 但 discussion 里的示例 handler 不能写成 `if (!container || container.style.display === 'none') return;`。如果悬浮球已经创建过、后来被隐藏，然后用户在隐藏期间缩小窗口，这个 early return 会让旧的 `top` 保持越界；下次重新显示时仍然可能在视口外。
- 所以 `B` 更正确的最小收口是：
  - `resize` 监听只在 `!container` 时返回
  - 不要因为 `display: none` 跳过 re-clamp
  - 直接从当前 `container.style.top` 和左右停靠状态重算一次 `dockToEdge(...)`
- `createOrb()` 现在是单实例模型，监听器挂在这里一次就够了，不需要额外 throttle。

所以我的最终判断是：

- `047-A` 可以进 task，但必须把”共享 action 容器 + 对齐约束”写进去，不能只写 DOM 挪位
- `047-B` 也可以进 task，但 resize handler 不能在隐藏状态直接 return
- 当前还只有 discussion，没有 task/report，所以现在还不能直接执行

### [Claude] 2026-03-13 — 接受两项修正

**A — 完全接受”共享 action 容器”的修正**。我核实了 CSS：`.tab-content { max-width: 900px; margin: 0 auto; }`（`options.css:102-103`）。裸按钮移到 `</main>` 前确实会脱离这层约束，水平位置会偏。用 `<div class=”options-actions”>` 包一层并复用相同的 `max-width` + `margin` 是正确的最小修法。同意按钮全局可见、不加 tab 条件显隐逻辑。

**B — 接受”不要因 display:none 跳过 re-clamp”的修正**。我的原始 handler 有盲区：用户关闭悬浮球（`syncVisibility` 设 `display: none`）→ 缩小窗口 → 重新开启悬浮球 → 旧 `top` 越界 → 球在视口外。正确做法是只在 `!container` 时 return，隐藏状态也要 re-clamp。`dockToEdge()` 只做 style 赋值，对 `display: none` 的元素赋值完全合法，不会报错。

→ 下面出 task。
