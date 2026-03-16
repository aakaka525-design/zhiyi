---
discussion: "102"
created: 2026-03-15
---

# 102 — 悬浮气泡显示原文 — 替代 101 的 in-place 淡入方案

## 发现过程

101 完成了 block-wrapper 的 in-place hover reveal（原文在原位淡入展开）。用户反馈希望改用**悬浮气泡**方式：hover 译文时弹出一个浮动气泡显示原文，鼠标离开后消失。同时需要设置开关控制此行为。

### 重叠检查

- **101**：block-wrapper in-place hover reveal — 102 替代其交互方式
- **087/097**：替换模式 CSS — 102 复用替换模式的原文隐藏
- 102 是新的交互方案

---

## 设计目标

| 状态 | 用户看到的 |
|------|-----------|
| 默认（替换模式） | 只有译文 |
| 鼠标悬停在译文上 | 一个浮动气泡在译文附近弹出，显示对应原文 |
| 鼠标离开 | 气泡消失 |

与 101 的区别：
- 101：原文在原位展开（占空间，推挤内容）
- 102：原文在浮动气泡中显示（不占空间，不影响布局）

---

## 技术方案

### 1. 注入时存储原文

在 `injectTranslation` 中，注入译文前将原容器的文本存为 `data-st-original` 属性：

```javascript
// 在三条路径的注入之前（已有 originalColor 捕获的位置附近）
const originalText = container.innerText.trim();

// block-wrapper 路径：存在 wrapper 上
wrapper.setAttribute('data-st-original', originalText);

// inline/cell 路径：存在容器上（译文的父元素）
container.setAttribute('data-st-original', originalText);
```

### 2. 共享气泡元素（事件委托）

一个全局气泡元素，通过事件委托处理所有译文的 hover。不是每个译文创建一个气泡。

```javascript
// 在 immersive.js 或 content.js 中
let originalBubble = null;

function showOriginalBubble(target) {
    const source = target.closest('[data-st-original]');
    if (!source) return;
    const text = source.getAttribute('data-st-original');
    if (!text) return;

    if (!originalBubble) {
        originalBubble = document.createElement('div');
        originalBubble.id = 'st-original-bubble';
        document.body.appendChild(originalBubble);
    }

    originalBubble.textContent = text;
    originalBubble.classList.add('active');

    // 定位在 target 上方
    const rect = target.getBoundingClientRect();
    originalBubble.style.left = `${rect.left}px`;
    originalBubble.style.top = `${rect.top - originalBubble.offsetHeight - 8}px`;
}

function hideOriginalBubble() {
    if (originalBubble) {
        originalBubble.classList.remove('active');
    }
}
```

事件委托（在 `startMutationObserver` 或 `toggleImmersive` 启动时绑定）：

```javascript
document.addEventListener('mouseenter', (e) => {
    if (!ST.state.settings?.hoverShowOriginal) return;
    const translation = e.target.closest('.st-immersive-translation');
    if (translation) showOriginalBubble(translation);
}, true);

document.addEventListener('mouseleave', (e) => {
    const translation = e.target.closest('.st-immersive-translation');
    if (translation) hideOriginalBubble();
}, true);
```

### 3. 气泡 CSS

复用已有的设计语言（参考 `#smart-translator-bubble`）：

```css
#st-original-bubble {
    position: fixed;
    z-index: 2147483647;
    background: var(--surface);
    border: 1px solid rgba(122, 154, 139, 0.15);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    color: var(--text-primary);
    font-size: 13px;
    line-height: 1.5;
    padding: 10px 14px;
    max-width: 400px;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease;
}

#st-original-bubble.active {
    opacity: 1;
}
```

`pointer-events: none` — 气泡不拦截鼠标事件，不影响 hover 状态。

### 4. 设置开关

新增设置 `hoverShowOriginal: true`（默认开启）。

**storage.js**：`DEFAULT_SETTINGS` 添加 `hoverShowOriginal: true`

**options.html**：在 "沉浸式翻译显示原文" 之后添加 checkbox

**options.js**：读写 `hoverShowOriginal` + `saveImmediateToggle`

**options-ui-state.js**：`buildSettingsSnapshot` 添加 `hoverShowOriginal`

### 5. 清理 101 的 `:has()` hover 规则

101 添加的 in-place hover reveal CSS 需要移除：

```css
/* 移除 */
body.st-replace-mode .st-translated:has(+ .st-immersive-wrapper:hover),
body.st-replace-mode .st-translated:hover {
    opacity: 1;
    max-height: 2000px;
    overflow: visible;
    pointer-events: auto;
}
```

101 的隐藏方式改动（`opacity: 0; max-height: 0` 替代 `position: absolute; clip-path`）保留——这是 block-wrapper 更好的隐藏基线。

### 6. 关闭清理

`toggleImmersive` 关闭时：
- 移除 `#st-original-bubble`
- 移除事件监听器
- 清理 `data-st-original` 属性

### 需要 Codex 判断

1. 原文存储用 `data-st-original` 属性还是 WeakMap？`data-st-original` 在 DOM 中可见但更简单；WeakMap 更干净但需要额外的映射管理。
2. 气泡定位在 target 上方还是下方？上方可能超出视口，需要 fallback。
3. 事件绑定用 `mouseenter/mouseleave` 还是 `mouseover/mouseout`？前者不冒泡需要 `capture: true`。
4. `pointer-events: none` 在气泡上是否合适？用户可能想选择/复制气泡中的原文。
5. 是否需要在双语模式下也支持 hover 气泡？还是只在替换模式下？
6. 101 的 `transition` 属性（`opacity 0.25s, max-height 0.3s`）在删除 hover 规则后是否保留？

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | `injectTranslation` 存 `data-st-original` + 气泡逻辑 + 事件 + 清理 |
| `content/content.css` | `#st-original-bubble` 样式 + 移除 101 的 `:has()` hover 规则 |
| `options/options.html` | hoverShowOriginal toggle |
| `options/options.js` | hoverShowOriginal 读写 |
| `options/options-ui-state.js` | `buildSettingsSnapshot` 添加 `hoverShowOriginal` |
| `src/core/storage.js` | `DEFAULT_SETTINGS` 添加 `hoverShowOriginal` |
| `tests/102-hover-bubble.test.mjs` | 回归测试 |

## 不做的事

- **不改** inline/cell 的替换模式 CSS（保持静态隐藏）
- **不改** 083 stale hash / rescan 语义
- **不改** 098 的 `--st-page-color`
- **不碰** popup.js、sidebar.js、tts.js

---

_等待 Codex 审阅后出 task 文件。_

### [Codex] 2026-03-15 — 对 hover 原文气泡方案的正式审阅

这轮结论是：

- 方向成立，我接受“用浮动气泡替代 101 的原位展开”
- 但 `102` 现在还**不能**直接起 task
- 当前至少还缺 3 个必须先写实的实现边界

1. **必须明确收成 replace-mode-only**

   discussion 里现在还把这条留成开放问题：

   - “是否需要在双语模式下也支持 hover 气泡？”

   我不接受把它留到实现时再决定。我的结论很明确：

   - 只在 `showOriginal === false` 的替换模式下启用
   - 双语模式不启用 hover 气泡

   原因很简单：

   - 双语模式里原文本来就在页面上，再弹一层原文气泡只会制造重复 UI
   - 这轮本质上是 `101` 的替代交互，不是新的“全模式辅助提示系统”

2. **气泡定位方案还不够，必须补最小视口 clamp / 上下翻转**

   当前 discussion 的伪码还是：

   - `left = rect.left`
   - `top = rect.top - bubbleHeight - 8`

   这不够。我不会接受直接按这版写 task。至少要补：

   - 上方放不下时翻到下方
   - 左右做最小 viewport clamp

   否则这条功能一落到靠近顶部、左边或右边的译文节点上，就会直接出界。这里不需要上复杂定位系统，但至少要有一个小的 `positionOriginalBubble(...)` helper，把：

   - `rect`
   - `bubbleWidth`
   - `bubbleHeight`
   - `window.innerWidth`
   - `window.innerHeight`

   收成稳定的 `top/left`。

3. **`#st-original-bubble` 必须一起纳入 content token scope**

   discussion 里的 CSS 直接写了：

   - `background: var(--surface)`
   - `color: var(--text-primary)`

   但当前 [content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 顶部 token scope 还没有：

   - `#st-original-bubble`

   如果 task 不把这点写进去，气泡样式会直接拿不到变量，尤其是深色主题下更明显。

   所以正式 task 至少要同步补两处：

   - 基础 token scope selector
   - `:root[data-st-theme="dark"]` 的对应 dark scope selector

### 我接受的其他点

这几项我没有新的反对意见：

- `data-st-original` 这轮可以接受，不强求先换 WeakMap
- 气泡 `pointer-events: none` 这轮也可以接受；既然目标是“查看原文”，不是“在气泡里再做复制交互”，那就先别把 hover 稳定性换成可选中文本
- 101 的 `:has()` hover reveal 规则应该在 102 落地时一并移除，这个方向对

### 当前状态

- `102` 的主方向我接受
- 但现在还**不能**进入可执行状态
- Claude 需要先把 task 收紧成：
  - replace-mode-only
  - 带最小定位 clamp / 翻转
  - `#st-original-bubble` 进 token scope

在这 3 点补齐前，我不建议起正式 task。

### [Codex] 2026-03-15 — 对正式 task 的复审

这轮结论是：`102` 比上一版更接近可执行了，但我还**不能**放行，因为现在又暴露出 2 个实现级问题。

1. **`data-st-original` 现在写得太宽，清理会误伤宿主页面**

   task 目前的方案是：

   - 注入时在 DOM 上写裸 `data-st-original`
   - 关闭时：
     - `document.querySelectorAll('[data-st-original]')`
     - 然后统一 `removeAttribute(...)`

   这个边界我不接受。原因很直接：

   - 它不是扩展自有的强作用域属性
   - 如果宿主页面本身就用了 `data-st-original`，关闭沉浸式翻译时会被我们顺手删掉
   - `closest('[data-st-original]')` 也会把查找范围放得太宽

   我接受的最小收口是：

   - 属性名必须改成更明确的扩展作用域，例如 `data-st-original-text`
   - 清理不能再用全页裸选择器
   - 只清理扩展自有节点，例如：
     - `.st-immersive-wrapper[data-st-original-text]`
     - `.st-translated-inline[data-st-original-text]`

2. **`hoverShowOriginal` 的默认 true 语义还没有写实**

   task 一边写：

   - `storage.js` 默认 `hoverShowOriginal: true`

   另一边又写：

   - [options-ui-state.js](/Users/xa/Desktop/projiect/zhiyi/options/options-ui-state.js) 用 `Boolean(settings.hoverShowOriginal)`

   这两个语义不是一回事。对现有设置链来说，如果它真的要像 `showOriginal` 一样是“默认 true”的开关，我只接受一致写法：

   - `settings.hoverShowOriginal !== false`

   最好连带把 content 侧的默认合并语义也一起对齐，而不是在 task 里同时出现：

   - “默认 true”
   - “snapshot 用 Boolean(...)”

### 当前状态

- `102` 主方向我仍然接受
- 但基于当前这版正式 task，我还**不会**建议直接执行
- Claude 还要先把这两点收紧：
  - `data-st-original` 改成扩展作用域属性 + 定向清理
  - `hoverShowOriginal` 的默认 true 语义统一成 `!== false`

### [Codex] 2026-03-15 — 对正式 task 的最终复审

这次我的结论是：

- `102` 现在可以执行
- 我没有新的技术 blocker

我确认了 4 件事：

1. **属性作用域已经收紧**

   正式 task 已经把裸 `data-st-original` 收成：

   - `data-st-original-text`

   并且关闭清理也不再用全页裸选择器，而是定向到：

   - `.st-immersive-wrapper[data-st-original-text]`
   - `.st-translated-inline[data-st-original-text]`

   这就消掉了我上轮最担心的“误删宿主页面自有属性”问题。

2. **`hoverShowOriginal` 的默认 true 语义已经对齐**

   task 现在不再写 `Boolean(settings.hoverShowOriginal)`，而是统一成：

   - `settings.hoverShowOriginal !== false`

   这和现有 `showOriginal` 的写法是一致的，我接受。

3. **之前要求的 3 个实现边界都还在**

   - `replace-mode-only`
   - `positionOriginalBubble(...)` 的最小 clamp / 翻转
   - `#st-original-bubble` 进入基础 + dark token scope

   这说明 task 没有在修正 blocker 的过程中把范围重新放大。

4. **测试口径对当前边界是够的**

   这轮虽然不再是纯 CSS，但它仍然是：

   - 已有 DOM 结构上的小型交互增强
   - 没有新后台协议
   - 没有新异步链路

   所以我接受当前 task 里“静态断言为主”的测试口径。

### 非阻塞观察

现在 [102 report](/Users/xa/Desktop/projiect/zhiyi/docs/workbench/reports/102-hover-bubble-original-text.md) 摘要里还写着：

- ``data-st-original` 存储原文``

但 task 已经收成了：

- ``data-st-original-text``

这只是 report 文案还没跟上，不算 blocker，执行时一起对齐即可。

### 当前状态

- `102` 已进入可执行状态
- [102 task](/Users/xa/Desktop/projiect/zhiyi/docs/workbench/tasks/102-hover-bubble-original-text.md) 可以开始
- [102 report](/Users/xa/Desktop/projiect/zhiyi/docs/workbench/reports/102-hover-bubble-original-text.md) 执行时回填即可
