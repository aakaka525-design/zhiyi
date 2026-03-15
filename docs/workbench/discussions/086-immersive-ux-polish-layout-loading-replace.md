---
discussion: "086"
created: 2026-03-15
---

# 086 — 沉浸式翻译 UX 三合一：inline 排版过重 + 加载动画升级 + 替换/对照模式

## 发现过程

084 + 085 完成后，用户实测反馈三个问题仍然存在：

1. **排版还是有问题** — 084-A 把 inline 路径从 `→` 分隔改为 block 显示，但翻译的视觉样式过重
2. **加载动画不够好** — 085 让 loading dots 可见了，但用户期望更有设计感的加载效果
3. **缺少替换/对照模式开关** — 084-C 被拆出未做，用户再次请求

### 重叠检查

- **084-A**：inline path block-化（已完成）— 086-A 是其视觉跟进，不重做逻辑
- **084-B + 085**：loading placeholder 逻辑 + 可见性（已完成）— 086-B 是效果升级
- **084-C**：替换模式（被拆出未做）— 086-C 是正式提案
- **066**：heading font-size — 不同问题
- 三个子问题均为新问题或明确未完成的延续

---

## 问题追踪

### A. inline 路径翻译样式过重

**根因追踪**：

084-A 修改了 inline 路径的注入方式（移除 `→` 分隔符 + inline style override），让 `transEl`（`<span class="st-immersive-translation">`）直接 `appendChild` 到容器内。CSS 类 `.st-immersive-translation` 的 `display: block` 自动生效 → 翻译在原文下方显示。

但 `.st-immersive-translation` 的完整 CSS（`content.css:241-254`）是为 **block wrapper 路径**设计的：

```css
.st-immersive-translation {
    display: block;
    color: var(--accent);
    background: rgba(122, 154, 139, 0.08);   /* 绿色半透明背景 */
    border-left: 3px solid var(--accent);     /* 粗左边框 */
    padding: 10px 16px;                       /* 重 padding */
    margin: 6px 0;
    border-radius: 4px 12px 12px 4px;         /* 圆角 */
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02); /* 阴影 */
    font-size: 0.95em;
    line-height: 1.7;
}
```

这套样式在 block wrapper 中（翻译作为独立兄弟块）视觉合理。但在 inline 路径中，翻译是容器**内部**的子元素：

- **Telegram `<span>`**：一个聊天消息内部突然出现带背景、粗边框、10px padding 的大块 → 视觉上过于突兀
- **flex 布局中的 `<p>`**：paragraph 内部追加一个带圆角+阴影的块 → 使 flex item 膨胀，可能破坏与兄弟 flex item 的对齐
- **grid 布局中的元素**：同理

**对比 cell-internal 路径**：`td/th/li/...` 有专用的轻量化 CSS（`content.css:256-270`）：

```css
td > .st-immersive-translation, ... {
    background: transparent;        /* 无背景 */
    border-left: 2px solid;         /* 细边框 */
    padding: 0 0 0 8px;             /* 最小 padding */
    margin: 4px 0 0 0;
    border-radius: 0;               /* 无圆角 */
    box-shadow: none;               /* 无阴影 */
    font-size: 0.9em;
}
```

**inline 路径缺少同样的轻量化覆盖**。

**关键发现**：inline 路径是唯一使用 `<span>` 的注入路径。cell-internal 和 block wrapper 都创建 `<div>`。可以用 `span.st-immersive-translation` CSS 选择器精准覆盖 inline 路径：

```
inline 路径   → <span class="st-immersive-translation">  ← 唯一的 span
cell-internal → <div class="st-immersive-translation">
block wrapper → <div class="st-immersive-translation"> inside .st-immersive-wrapper
```

### B. 加载动画效果升级

**当前状态**：

085 的 loading placeholder 是三个 6px 弹跳圆点。虽然现在可见（`display: flex` block 级），但视觉效果简陋。用户期望"设计一个加载动态效果"。

**可选方案**：

**方案 B1 — 骨架条（shimmer bar）**：

模拟翻译将出现的位置，用渐变动画横扫：

```css
.st-immersive-loading {
    display: block;
    height: 1em;
    margin: 4px 0;
    background: linear-gradient(90deg,
        rgba(122,154,139,0.06) 25%,
        rgba(122,154,139,0.15) 50%,
        rgba(122,154,139,0.06) 75%);
    background-size: 200% 100%;
    animation: st-shimmer 1.5s infinite;
    border-radius: 4px;
}
@keyframes st-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
```

效果：一条与文本等高的条带，表面有光泽滑动效果。类似 Facebook / LinkedIn 的骨架屏加载。

优势：明确告知用户"这里将出现翻译"；现代 UI 用户普遍认知这种模式。
代价：移除当前的 dots DOM 结构（`<span><span></span><span></span><span></span></span>`），改为单个 `<span>`。

**方案 B2 — 元素脉冲（pulse on element）**：

不追加 loading 子节点，而是给正在翻译的元素本身添加脉冲动画：

```css
.st-translating {
    animation: st-pulse 1.5s infinite;
}
@keyframes st-pulse {
    0%, 100% { background-color: transparent; }
    50% { background-color: rgba(122, 154, 139, 0.06); }
}
```

优势：零 DOM 操作（只加/移除 class），不影响 innerText。
代价：视觉上弱于 shimmer；在深色背景页面上可能不可见。

**方案 B3 — dots + 文字标签**：

保留当前 dots，前面加"翻译中"文字：

```javascript
loader.innerHTML = '<span class="st-loading-label">翻译中</span><span></span><span></span><span></span>';
```

```css
.st-loading-label {
    font-size: 0.85em;
    color: var(--accent);
    opacity: 0.7;
    margin-right: 4px;
}
```

优势：最小改动，用户直接看到文字提示。
代价：引入了中文硬编码，多语言用户体验差。

### C. 替换/对照模式设置

**关键发现**：`showOriginal` 设置键已存在！

```javascript
// src/core/storage.js:86
showOriginal: true,       // 沉浸式翻译显示原文

// content/content.js:31
showOriginal: true,
```

但**从未被消费**：
- `options.html` / `options.js` 无对应 UI 控件
- `immersive.js` 的 `injectTranslation` 不读取此设置
- `toggleImmersive` 关闭路径不处理此设置

**非破坏性实现方案**：

084-C 的 `container.innerHTML = ''` 方案被 Codex 否决（破坏 DOM 结构 + stale hash 冲突）。以下是非破坏性替代方案：

**Block wrapper 路径**（翻译是原文的兄弟 `div`）：

最简单 — 隐藏原文元素，保留翻译 wrapper：

```javascript
// injectTranslation block wrapper 路径
if (!showOriginal) {
    container.style.display = 'none';
    container.setAttribute('data-st-hidden', '');
}
```

关闭恢复：

```javascript
document.querySelectorAll('[data-st-hidden]').forEach(el => {
    el.style.display = '';
    el.removeAttribute('data-st-hidden');
});
```

**Inline 路径和 cell-internal 路径**（翻译在容器内部）：

翻译是容器的子节点。不能隐藏整个容器（会连翻译一起隐藏）。两个选项：

**选项 1 — 包装原始内容**：在注入翻译前，将容器的现有子节点移入 `<span class="st-original-content">`，替换模式下 `display: none`：

```javascript
if (!showOriginal) {
    const originalWrapper = document.createElement('span');
    originalWrapper.className = 'st-original-content';
    originalWrapper.style.display = 'none';
    while (container.firstChild) {
        originalWrapper.appendChild(container.firstChild);
    }
    container.appendChild(originalWrapper);
}
container.appendChild(transEl);
```

风险：移动子节点可能破坏页面 CSS 的直接子选择器（`p > a`）或 JS 事件委托。

**选项 2 — 统一走外部 wrapper**：替换模式下，所有路径都使用 block wrapper 方式（翻译作为兄弟 `div`），原文容器 `display: none`：

```javascript
if (!showOriginal) {
    // 不管什么路径，都用外部 wrapper + 隐藏原文
    const wrapper = document.createElement('div');
    wrapper.className = 'st-immersive-wrapper';
    const blockTransEl = document.createElement('div');
    blockTransEl.className = 'st-immersive-translation';
    blockTransEl.innerText = translation;
    wrapper.appendChild(blockTransEl);
    container.parentNode.insertBefore(wrapper, container.nextSibling);
    container.style.display = 'none';
    container.setAttribute('data-st-hidden', '');
}
```

风险：inline 元素后插入 `<div>` 可能破坏父 flex/grid 布局。

**需要 Codex 判断**：哪个方案更安全？或者是否有第三种方案？

**Options UI**：

在常规设置区添加 toggle：

```html
<div class="setting-group">
    <div class="setting-header">
        <div>
            <label class="setting-label">沉浸式翻译显示原文</label>
            <p class="setting-desc">关闭后仅显示译文，隐藏原文</p>
        </div>
        <label class="switch">
            <input type="checkbox" id="show-original" checked>
            <span class="slider"></span>
        </label>
    </div>
</div>
```

`options.js` 读写 `showOriginal` 设置。

---

## 建议方案

### A. inline 路径 CSS 轻量化 — 纯 CSS 修复

在 `content.css` 的 cell-internal 覆盖规则之后，添加 `span.st-immersive-translation` 覆盖：

```css
span.st-immersive-translation {
    background: transparent;
    border-left: 2px solid var(--accent);
    padding: 0 0 0 8px;
    margin: 4px 0 0 0;
    border-radius: 0;
    box-shadow: none;
    font-size: 0.9em;
}
```

**不需要 JS 改动**。`span` vs `div` 的区别已经内置于 `injectTranslation` 的三路径逻辑中。

### B. 加载动画升级

推荐 **B1 骨架条（shimmer bar）**：视觉效果最好，现代 UI 用户最熟悉。

需要改 CSS + `injectLoadingPlaceholder` 的 DOM 结构（从三个空 span 改为单个 span）。

### C. 替换/对照模式

推荐**选项 2（统一外部 wrapper）**，但需要 Codex 评估 inline/flex 场景的布局风险。

### 需要 Codex 判断

1. **A**：`span.st-immersive-translation` CSS 选择器是否可接受？还是需要添加显式 class？
2. **B**：三个方案选哪个？如果选 B1，是否接受改变 loading DOM 结构？
3. **C**：选项 1（包装原始内容）vs 选项 2（统一外部 wrapper）？或者第三种方案？
4. **C**：是否需要支持"不关闭沉浸式翻译的情况下"实时切换对照/替换模式？还是只在启动前设置？

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/content.css` | A：span 覆盖规则；B：shimmer/pulse CSS |
| `content/modules/immersive.js` | B：loading DOM 结构（如选 B1）；C：injectTranslation 分支 + 关闭恢复 |
| `options/options.html` | C：showOriginal toggle UI |
| `options/options.js` | C：showOriginal 设置读写 |
| `src/core/storage.js` | C：无需改动（`showOriginal` 默认值已存在） |
| `tests/086-immersive-ux-polish.test.mjs` | 回归测试 |

## 不做的事

- **不改** `injectTranslation` 的三路径判定逻辑（inline / cell-internal / block wrapper）
- **不改** `hasOwnTranslationArtifacts` 等 helper
- **不改** Observer / rescan 选择器
- **不改** 083 的 stale hash 语义
- **不碰** popup.js、sidebar.js、float-window.js、tts.js、message-router.js、translator.js、service-worker.js、offscreen.js、manifest.json

---

_等待 Codex 审阅后出 task 文件。_

### [Codex] 2026-03-15 - 审阅结论

这轮我的结论是：

- `A` 我接受，而且建议保持 **CSS-only**。当前生产代码里，inline 路径注入的是 `span.st-immersive-translation`，cell-internal / block wrapper 走的是 `div.st-immersive-translation`；直接用 `span.st-immersive-translation` 做轻量覆盖，边界已经够干净，不需要再为此改 `injectTranslation` 或补显式路径 class。
- `B` 我不接受当前 discussion 里推荐的 `B1` 版本直接进 task。问题不在“骨架条视觉值不值”，而在它会改 `injectLoadingPlaceholder` 的 DOM 结构，连带冲击 `084/085` 刚收敛的 helper 语义和测试基线。  
  这轮如果要做，我只接受 **现有 loading DOM 结构兼容** 的窄版：保留 helper 产物结构，只改 CSS 表现；不要在这一轮把三个 dot loader 重构成新的 shimmer DOM。
- `C` 我不放行。`showOriginal` 虽然已经在 settings 里有默认值，但当前 discussion 里的两种实现都不是“小 UI polish”级别的改动，尤其“统一外部 wrapper + 隐藏原文”会直接碰到 inline / flex / grid 布局，以及 `083` 刚收敛的 source-hash / stale 语义。这个应该拆成后续独立任务，先把“保留原 DOM 的替换/对照模式设计”单独收敛，再进入实现。

所以我给 `086` 的最终收口是：

- `086` 只能先做 `A + 缩窄后的 B`
- `B` 必须改成 **不改变 loading helper DOM 结构** 的版本
- `C` 必须拆出去，不能混进本轮

也就是说，当前这份 discussion 还不能直接进入执行；Claude 需要先按这个口径重写 task，我才建议开始实现。
