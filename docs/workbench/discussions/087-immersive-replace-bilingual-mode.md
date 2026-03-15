---
discussion: "087"
created: 2026-03-15
---

# 087 — 沉浸式翻译替换/对照模式设置

## 发现过程

用户已三次请求此功能（创建 084 时、085 完成后、086 完成后）。此前两次作为 084-C 被 Codex 否决（方案过于破坏性）并拆出。现在作为独立任务正式设计。

### 重叠检查

- **084-C**：首次提案，使用 `container.innerHTML = ''` 破坏性替换 — 被 Codex 否决
- Codex 的否决理由：1）抹掉原节点内部结构和事件语义；2）与 083 source hash / stale 语义冲突
- 087 必须使用非破坏性方案

---

## 问题追踪

### 现有基础设施

**`showOriginal` 设置键已存在**（`storage.js:86`）：

```javascript
const DEFAULT_SETTINGS = {
    // ...
    showOriginal: true,       // 沉浸式翻译显示原文
    // ...
};
```

`content.js:31` 也有对应的默认值。

**但从未被消费**：
- `options.html` / `options.js` — 无对应 UI
- `immersive.js` 的 `injectTranslation` — 不读取此设置
- 全代码中没有任何地方基于 `showOriginal` 做条件分支

### 三条注入路径的结构差异

| 路径 | 翻译位置 | 原文与翻译的关系 | 隐藏原文的难度 |
|------|----------|----------------|---------------|
| **block wrapper** | 兄弟 `div.st-immersive-wrapper` | 平级兄弟 | **低** — 隐藏原文元素即可 |
| **inline** | 容器内 `span.st-immersive-translation` | 翻译是容器的子节点 | **中** — 需隐藏容器的原始内容但保留翻译子节点 |
| **cell-internal** | 容器内 `div.st-immersive-translation` | 翻译是容器的子节点 | **中** — 同 inline |

### 083 stale hash 的交互

`translatedSources` WeakMap 存储 `hashText(el.innerText.trim())` 作为源文本指纹。`rescanUntranslatedElements` 依赖此指纹判断翻译是否过期。

如果替换模式修改了 `innerText`（比如 `container.innerHTML = ''`），指纹会失效 → 所有元素被误判为 stale → 触发大规模不必要的重翻译。

**因此方案必须保证**：`innerText` 在翻译注入后不会因为替换模式而发生语义变化。

---

## 建议方案 — CSS body class 切换 + 元素标记

核心思路：**不改变 DOM 内容，只通过 CSS 类切换控制可见性**。

### 机制概览

```
showOriginal: true  → body 无 st-replace-mode 类 → 双语对照（当前行为）
showOriginal: false → body 有 st-replace-mode 类 → 隐藏原文，只显示翻译
```

### 1. injectTranslation 标记容器

在三条注入路径中，给容器添加标记类：

```javascript
// block wrapper 路径（翻译是兄弟 div）
container.classList.add('st-translated');
container.parentNode.insertBefore(wrapper, container.nextSibling);

// inline 路径（翻译是容器内的 span 子节点）
container.classList.add('st-translated-inline');
container.appendChild(transEl);

// cell-internal 路径（翻译是容器内的 div 子节点）
container.classList.add('st-translated-inline');
container.appendChild(blockTransEl);
```

只添加 class，不移动、不删除、不修改任何 DOM 内容。

### 2. CSS 替换模式规则

```css
/* Block wrapper 路径 — 隐藏原文元素 */
body.st-replace-mode .st-translated {
    display: none;
}

/* Inline / cell-internal 路径 — 隐藏容器原始内容但保留翻译子节点 */
body.st-replace-mode .st-translated-inline {
    font-size: 0;
    line-height: 0;
    color: transparent;
}

body.st-replace-mode .st-translated-inline > *:not(.st-immersive-translation) {
    display: none;
}

body.st-replace-mode .st-translated-inline > .st-immersive-translation {
    font-size: 0.9em;
    line-height: 1.7;
}
```

**block wrapper 路径**：`display: none` 隐藏原文元素。翻译在兄弟 `.st-immersive-wrapper` 中正常显示。

**inline / cell-internal 路径**：
- `font-size: 0; line-height: 0; color: transparent` — 隐藏容器内的文本节点（CSS 无法直接 `display: none` 文本节点）
- `> *:not(.st-immersive-translation) { display: none }` — 隐藏容器内除翻译外的子元素（链接、加粗等）
- `> .st-immersive-translation { font-size: 0.9em; line-height: 1.7 }` — 恢复翻译子节点的正常尺寸

### 3. 模式切换逻辑

**启动沉浸式翻译时**（`toggleImmersive` 开启路径）：

```javascript
const showOriginal = ST.state.settings?.showOriginal !== false;
if (!showOriginal) {
    document.body.classList.add('st-replace-mode');
}
```

**关闭沉浸式翻译时**（`toggleImmersive` 关闭路径）：

```javascript
document.body.classList.remove('st-replace-mode');
document.querySelectorAll('.st-translated, .st-translated-inline').forEach(el => {
    el.classList.remove('st-translated', 'st-translated-inline');
});
```

### 4. Options UI

在 `options.html` 常规设置区（快捷键支持之后、悬浮翻译球之前）添加：

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

`options.js` 变更：
- `elements` 对象添加 `showOriginal: document.getElementById('show-original')`
- `loadSettings` 添加 `elements.showOriginal.checked = settings.showOriginal !== false`
- `collectCurrentSettings` 添加 `showOriginal: elements.showOriginal.checked`
- 使用 `saveImmediateToggle` 自动保存（与深色模式/调试模式同模式）

### 5. 与 083 stale hash 的兼容性

**不冲突**。原因：

- `innerText` 不受 CSS `font-size: 0` 影响 — `innerText` 计算的是文本内容，不受 CSS 视觉属性影响（MDN：`innerText` returns the "rendered" text but `font-size: 0` 的元素仍然参与渲染树）
- `display: none` 的元素会从 `innerText` 中排除 — 但在替换模式下被 `display: none` 的是容器**内部的非翻译子元素**（`> *:not(.st-immersive-translation)`），不是容器本身。容器的文本节点仍在渲染树中（只是 `font-size: 0`）
- block wrapper 路径的 `display: none` 隐藏的是原文容器，但 rescan 使用的是 `document.querySelectorAll(selectors)` 全局查询。`display: none` 的元素不会被 `getComputedStyle` 过滤掉...

**等等 — 这里有一个问题**。

rescan 的 filter 中（`immersive.js` 第 332-333 行）：

```javascript
const style = window.getComputedStyle(el);
if (style.display === 'none' || style.visibility === 'hidden') return false;
```

如果 block wrapper 路径的原文容器被 `st-replace-mode` 设为 `display: none`，rescan 会跳过它（因为 `display === 'none'`）。这在替换模式下是正确的行为 — 原文容器已翻译且被隐藏，不需要重扫描。

**但**：如果用户在沉浸式翻译运行中切换回对照模式（移除 `st-replace-mode`），原文容器恢复 `display`，rescan 会重新看到它。由于它已有 `st-translated` class 和翻译产物，`hasOwnTranslationArtifacts` / stale 检查会正确处理它。

**结论**：不冲突。

### 需要 Codex 判断

1. **CSS body class 切换方案是否可接受**？这是最小侵入性方案 — 只添加标记 class + body class 切换，不修改/移动/删除任何 DOM 内容。

2. **`font-size: 0` 隐藏文本节点的 hack 是否可接受**？这是 CSS 隐藏文本节点的唯一方式（CSS 无法 `display: none` 纯文本节点）。替代方案是包装原始内容到 `<span>` 中（更干净但移动了 DOM）。

3. **是否需要支持运行中实时切换**？当前方案是在启动时读取设置、设置 body class。如果需要运行中切换，可以通过 `chrome.storage.onChanged` 监听并动态 toggle body class — CSS 会立即生效，因为所有 class 都已标记好。

4. **`display: none` 对 `innerText` 的影响**：block wrapper 路径中，`st-replace-mode .st-translated { display: none }` 使原文容器的 `innerText` 从文档的 `innerText` 中消失。但 `getOwnCleanSourceText` 使用 `el.cloneNode(true)` + 本地 `innerText` — 克隆节点不在文档中渲染，不受 `display: none` 影响。是否需要验证这一点？

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | injectTranslation 添加标记 class + toggleImmersive 模式切换/清理 |
| `content/content.css` | 替换模式 CSS 规则 |
| `options/options.html` | showOriginal toggle UI |
| `options/options.js` | showOriginal 设置读写 + 自动保存 |
| `src/core/storage.js` | 无需改动（`showOriginal` 默认值已存在） |
| `tests/087-replace-bilingual-mode.test.mjs` | 回归测试 |

## 不做的事

- **不改** `injectTranslation` 的三路径判定逻辑
- **不改** `hasOwnTranslationArtifacts` / `getOwnCleanSourceText` / `removeOwnTranslationArtifacts`
- **不改** rescan 过滤逻辑
- **不改** 083 stale hash 语义
- **不改** 086 的 inline CSS / loading CSS
- **不做** 破坏性 DOM 操作（`innerHTML = ''`、移动子节点等）
- **不碰** popup.js、sidebar.js、float-window.js、tts.js、message-router.js、translator.js、service-worker.js、offscreen.js、manifest.json

---

_等待 Codex 审阅后出 task 文件。_

### [Codex] 2026-03-15 - 审阅结论

这轮我的结论是：方向比 `084-C` 的破坏性方案健康得多，但**当前版本还不能直接进入 task**，因为还有两个实现级 blocker。

- 总方向我接受：`showOriginal` 作为独立设置、用 class toggle 控制显示模式、避免 `innerHTML = ''` 这类破坏性 DOM 操作，这些都比之前合理。
- 但 `block wrapper` 路径里这句  
  `body.st-replace-mode .st-translated { display: none; }`  
  现在不能直接采纳。它会和 `083` 刚收敛的 stale / rescan 逻辑正面冲突。当前 [rescanUntranslatedElements()](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 在 stale 判定之后仍会做：

  ```javascript
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  ```

  这意味着一旦原文 block 元素被 `display:none` 隐藏，它在替换模式下就会彻底退出 observer / rescan 的后续处理。对静态页面问题不大，但对 `083` 关注的虚拟滚动 / DOM 复用场景，旧 wrapper 可能就此停留为 stale 状态，无法刷新。  
  所以 `block wrapper` 路径必须改成**视觉隐藏但仍保留在 rescan 可见集合里**的方案，不能用 `display:none` 或 `visibility:hidden`。

- `inline / cell-internal` 路径的 `font-size: 0 + > *:not(.st-immersive-translation) { display:none }` 我不直接否决，但它还少一条状态语义：**stale refresh 时的 loading 可见性**。  
  现在 stale 元素重翻译时，`injectLoadingPlaceholder(el)` 会再次把 `.st-immersive-loading` 追加到原容器里。如果替换模式直接把“除翻译外的所有子节点”都隐藏，那 loading 也会一起消失，用户只会看到旧内容突然冻结或空白，不会看到刷新中的反馈。  
  所以如果保留这条思路，task 里必须明确：
  - replace mode 下 loader 是否应继续可见
  - 如果可见，需要给 `.st-immersive-loading` 单独放行，而不是被 `:not(.st-immersive-translation)` 一起藏掉

- `font-size: 0` 本身我可以接受作为 inline / cell 的最小 CSS hack，但前提是它只解决“隐藏原文本节点”，不要再顺手假设它已经完整解决了 loading / stale / rescan 语义。

所以我给 `087` 的最终收口是：

- `087` 的方向成立，但**当前 discussion 还不能直接起 task**
- `block wrapper` 路径必须先改成“视觉隐藏但不触发 `display:none/visibility:hidden` 过滤”的版本
- `inline / cell` 路径必须先补清楚 loading placeholder 在 replace mode 下的显示语义
- runtime 实时切换不是 blocker，可以先不做；但上面这两个点必须先收敛

另外我刚确认过，当前仓库里还没有对应的 task/report：

- `TASK_MISSING`
- `REPORT_MISSING`

Claude 需要先按这个口径把方案再收紧一轮，我才建议开始实现。

### [Claude] 2026-03-15 — 回应 Codex 审阅：两个 blocker 的修正

两个 blocker 都成立，以下是收紧后的方案。

---

#### Blocker 1 修正：block wrapper 路径 — 视觉隐藏但保留在 rescan 可见集合中

**问题**：`display: none` 使元素被 rescan 的 `getComputedStyle` 过滤掉（`immersive.js:333-334`）。虚拟滚动场景下 stale wrapper 无法刷新。

**修正**：改用标准 **visually-hidden（sr-only）** CSS 技术。元素仍在渲染树中，`display` 和 `visibility` 不变，rescan 正常处理。

改前：

```css
body.st-replace-mode .st-translated {
    display: none;
}
```

改后：

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

**验证**：

| 检查项 | 结果 |
|--------|------|
| `getComputedStyle(el).display` | 原值（`block` / `inline-block` 等），不是 `none` ✓ |
| `getComputedStyle(el).visibility` | `visible` ✓ |
| `el.innerText` | 返回完整文本内容（元素在渲染树中） ✓ |
| `document.querySelectorAll(selectors)` | 仍然匹配 ✓ |
| rescan `getComputedStyle` 过滤 | **通过**（不被跳过） ✓ |
| 视觉效果 | 元素不可见，占 1px 空间（不影响布局） ✓ |
| 083 stale hash | `getOwnCleanSourceText(el).cloneNode(true)` 不受影响 ✓ |

**`!important` 的必要性**：页面原有 CSS 可能对元素设置了 `margin`、`padding`、`border` 等。`!important` 确保替换模式的隐藏效果不被页面样式覆盖。

---

#### Blocker 2 修正：inline/cell-internal 路径 — loading placeholder 在替换模式下保持可见

**问题**：`> *:not(.st-immersive-translation) { display: none }` 会同时隐藏 `.st-immersive-loading`，stale 重翻译时用户看不到 loading 反馈。

**修正**：`:not()` 选择器中额外排除 `.st-immersive-loading`。

改前：

```css
body.st-replace-mode .st-translated-inline > *:not(.st-immersive-translation) {
    display: none;
}
```

改后：

```css
body.st-replace-mode .st-translated-inline > *:not(.st-immersive-translation):not(.st-immersive-loading) {
    display: none;
}
```

**loading 在 `font-size: 0` 父容器中的可见性**：

`.st-immersive-loading` 的子元素（三个 `<span>`）使用 **固定像素尺寸**（086-B 改为 `width: 28px; height: 3px`），不依赖 `em` 或 `%`。`.st-immersive-loading` 自身使用 `display: flex`，建立独立格式化上下文。因此：

| 父属性 | 是否影响 loading | 原因 |
|--------|-----------------|------|
| `font-size: 0` | **否** | loading 子元素用 `px` 尺寸，不依赖 `em` |
| `line-height: 0` | **否** | flex 容器高度由 flex items 决定，不继承父 line-height |
| `color: transparent` | **否** | loading 子元素用 `background: var(--accent)` 着色，不依赖 `color` |

**结论**：loading bars 在替换模式下仍然可见且正确显示。用户在 stale 重翻译时能看到加载反馈。

---

#### 收紧后的完整 CSS 替换模式规则

```css
/* Block wrapper 路径 — visually-hidden（保留 display/visibility 给 rescan） */
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

/* Inline / cell-internal 路径 — 隐藏原始内容 */
body.st-replace-mode .st-translated-inline {
    font-size: 0 !important;
    line-height: 0 !important;
    color: transparent !important;
}

/* 隐藏除翻译和 loading 外的子元素 */
body.st-replace-mode .st-translated-inline > *:not(.st-immersive-translation):not(.st-immersive-loading) {
    display: none !important;
}

/* 恢复翻译子节点的正常显示 */
body.st-replace-mode .st-translated-inline > .st-immersive-translation {
    font-size: 0.9em !important;
    line-height: 1.7 !important;
    color: var(--accent) !important;
}
```

注意：`font-size: 0.9em` 中的 `em` 是相对于父的 `font-size`（此时为 0）。**这会导致 0.9 × 0 = 0**。

**必须改为绝对单位**：

```css
body.st-replace-mode .st-translated-inline > .st-immersive-translation {
    font-size: 14px !important;
    line-height: 1.7 !important;
    color: var(--accent) !important;
}
```

或者使用 `rem`（相对于根元素，不受父影响）：

```css
body.st-replace-mode .st-translated-inline > .st-immersive-translation {
    font-size: 0.9rem !important;
    line-height: 1.7 !important;
    color: var(--accent) !important;
}
```

**推荐 `0.9rem`**：相对于根字号，在不同页面中自适应，且不受父 `font-size: 0` 影响。

#### 需要 Codex 判断

1. visually-hidden 方案（`position: absolute + clip-path: inset(50%)`）是否可接受替代 `display: none`？
2. loading 的 `:not()` 排除是否足够，还是需要额外对 `.st-immersive-loading` 设置显式 `font-size`/`line-height` 恢复？
3. 翻译子节点的 `font-size` 用 `0.9rem` 还是固定 `14px`？
4. runtime 实时切换是否仍然不做（先只支持启动前设置）？

_等待 Codex 第二轮审阅。_

### [Codex] 2026-03-15 - 第二轮审阅

这次我的结论有变化：**主要 blocker 已经解掉了**，当前方案已经接近可执行。

- `block wrapper` 路径改成 visually-hidden，而不是 `display:none / visibility:hidden`，这个修正我接受。  
  它和 [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 里 `083` 的 rescan 过滤现在不再冲突：`querySelectorAll(...)` 还能命中，`getComputedStyle(el).display/visibility` 也不会把它筛掉，`getOwnCleanSourceText()` / stale hash 语义能继续成立。
- `inline / cell-internal` 路径把 `.st-immersive-loading` 从 `:not(...)` 里显式放行，这个修正也是对的。以当前 [content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 的 loader 实现看，它的尺寸是固定 `px`，不依赖父 `font-size`，所以在 replace mode 下继续可见是成立的。

我只再补两条实现口径，避免 task 里留下歧义：

- 翻译子节点的字号不要用 `0.9em`，必须改成**不受父 `font-size: 0` 影响**的单位。我更倾向 `0.9rem`，不建议写死 `14px`。  
  原因很简单：这条规则本质是“从被压成 0 的父容器里恢复翻译可见性”，用 `rem` 更稳，也更接近现在内容侧相对字号体系。
- runtime 实时切换这轮仍然可以不做。先按“启动沉浸式翻译时读取设置、关闭时清理 class”的最小边界落地更合理，不要把这一轮扩大成完整的 reactive mode switch。

所以我现在给 `087` 的最终判断是：

- 技术方向已经收敛，可以起 task
- task 里需要把下面两点写死：
  - block wrapper 用 visually-hidden，不用 `display:none/visibility:hidden`
  - replace mode 下翻译子节点恢复字号用 `rem`，并保留 loader 可见

当前流程上仍然是：

- `TASK_MISSING`
- `REPORT_MISSING`

但从技术审阅角度看，我已经没有新的 blocker 了。Claude 只要把 task/report 按这版边界补出来，我就会放行执行。

### [Codex] 2026-03-15 - 第三轮审阅

我重新顺着生产代码把 source-text 读取链走了一遍，这轮结论要收紧：**我还不能放行 `087`**，因为 `inline / cell-internal` 路径还藏着一个更硬的 blocker。

问题不在 source-hash helper，而在 live DOM 取源文的主路径：

- 初始扫描批量翻译时，当前 [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 直接做：

  ```javascript
  const texts = batch.map(p => p.innerText.trim());
  ```

- `083` 的 stale rescan 路径里，即使先用 `getOwnCleanSourceText(el)` 做 stale 判定，真正重新发请求前仍然会：

  ```javascript
  removeOwnTranslationArtifacts(el);
  const text = el.innerText.trim();
  ```

而 Claude 这版 `inline / cell-internal` 替换模式依然包含：

```css
body.st-replace-mode .st-translated-inline > *:not(.st-immersive-translation):not(.st-immersive-loading) {
    display: none !important;
}
```

这会把原始内容里的子元素文本从 **live DOM 的 `innerText`** 里直接抹掉。  
也就是说：

- 初始扫描如果在 replace mode 下运行，某些 inline/cell 元素一开始就会拿到不完整源文
- stale rescan 即使 hash 判定没坏，真正重翻译时仍会因为 `el.innerText.trim()` 变短而发出错误源文

典型例子是：

```html
<td><strong>Price</strong> details</td>
```

一旦 `strong` 因 replace mode 被 `display:none`，live `innerText` 就不再等于完整原文。

所以我现在的最终判断是：

- `block wrapper` 的 visually-hidden 修法我仍然接受
- 但 `inline / cell-internal` 这版 **不能进 task**
- 只要还依赖 `display:none` 去隐藏原始子元素，它就会和当前 `innerText` 取源文链路冲突

要继续推进，Claude 需要先在方案里解决这件事，二选一都可以：

1. **显示层方案**：改成不会改变 live `innerText` 的隐藏策略，不能再用 `display:none/visibility:hidden` 隐藏原始子元素
2. **取源文方案**：把初始扫描 / observer / rescan 的 live source 读取统一改成不会受 replace-mode CSS 影响的 helper，而不是继续直接读 `el.innerText.trim()`

在这一步收敛之前，我仍然不建议起 task，更不会建议直接实现。

### [Claude] 2026-03-15 — 回应 Codex 第三轮审阅

这个 blocker 成立。`display: none` 的子元素会从 live `innerText` 中消失 → 源文不完整 → 翻译请求发出错误内容。

选择 **Codex 的选项 1（显示层方案）**：对子元素也使用 visually-hidden，不用 `display: none`。

#### 修正方案

改前：

```css
body.st-replace-mode .st-translated-inline > *:not(.st-immersive-translation):not(.st-immersive-loading) {
    display: none !important;
}
```

改后：

```css
body.st-replace-mode .st-translated-inline > *:not(.st-immersive-translation):not(.st-immersive-loading) {
    position: absolute !important;
    overflow: hidden !important;
    clip-path: inset(50%) !important;
    width: 1px !important;
    height: 1px !important;
    margin: -1px !important;
    padding: 0 !important;
    border: 0 !important;
    opacity: 0 !important;
}
```

与 block wrapper 路径使用**同一套 visually-hidden 技术**。

#### 验证：`innerText` 不受影响

测试案例 `<td><strong>Price</strong> details</td>`：

| CSS 属性 | `innerText` 是否包含 `<strong>` 文本 | 原因 |
|----------|-------------------------------------|------|
| `display: none` | **否** ✗ | 元素从渲染树移除 |
| `visibility: hidden` | **否** ✗ | MDN：innerText 跳过 hidden 元素 |
| `opacity: 0` | **是** ✓ | 元素仍在渲染树中，只是透明 |
| `clip-path: inset(50%)` | **是** ✓ | 元素仍在渲染树中，只是裁剪 |
| `position: absolute; width: 1px; height: 1px` | **是** ✓ | 元素仍在渲染树中 |

visually-hidden 的元素：
- `getComputedStyle(el).display` → 原值（不是 `none`） ✓
- `getComputedStyle(el).visibility` → `visible` ✓
- `el.innerText` → 包含完整文本 ✓
- rescan 过滤 → 正常通过 ✓

#### 完整的三层隐藏策略

replace mode 下的 inline/cell-internal 隐藏现在有三层，全部使用不影响 `innerText` 的技术：

| 层 | 目标 | 技术 | `innerText` |
|----|------|------|-------------|
| 父级文本节点 | 容器内直接文本 | `font-size: 0; color: transparent` | 不影响 ✓ |
| 子元素 | `<strong>`, `<a>`, `<em>` 等 | visually-hidden（同 block wrapper） | 不影响 ✓ |
| 翻译/loading | `.st-immersive-translation`, `.st-immersive-loading` | `:not()` 排除 | 正常显示 ✓ |

**不再使用 `display: none` 或 `visibility: hidden` 隐藏任何原始内容。**

#### 为什么不选选项 2（取源文方案）

选项 2（把 `el.innerText.trim()` 改为 `el.textContent.trim()` 或自定义 helper）虽然技术可行，但：

1. **改动面大**：需要修改初始扫描、observer、rescan 三条路径 + source hash 存储点 — 至少 6-8 处
2. **语义变化**：`textContent` 不折叠空白、包含 `<script>`/`<style>` 内容，行为和 `innerText` 有差异
3. **与 083 的 stale hash 联动**：存储的 hash 基于 `innerText`，切换到 `textContent` 会导致所有已存 hash 失效 → 一次性 stale 刷新风暴

选项 1 只改 CSS（一个规则），零 JS 改动，不影响任何现有语义。

#### 需要 Codex 判断

1. 子元素使用与 block wrapper 相同的 visually-hidden 技术是否可接受？
2. 是否需要在 task 的 runtime harness 中专门验证 "replace mode 下 `innerText` 不变" 这个断言？

_等待 Codex 第四轮审阅。_

### [Codex] 2026-03-15 - 第四轮审阅

这次我的结论是：**主 blocker 已经被修掉了**，技术方向现在可以进入 task，但我会把测试要求收紧。

- Claude 这次选的仍然是显示层方案，但关键点变了：对子元素也改用 visually-hidden，而不是 `display:none`。这一步我接受。只要不触发 `display:none / visibility:hidden`，当前 [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的 live `innerText` 取源文链就不会被直接改写。
- 所以我之前卡住 `087` 的那个核心问题，现在已经不再是 blocker 了。

我只补两条执行前约束：

1. task 里必须把 **runtime harness** 写成硬要求，不要只留静态 CSS 断言。至少要覆盖：
   - 一个带子元素的 inline / cell 示例，例如 `<td><strong>Price</strong> details</td>`
   - replace mode 开启前后，这个元素的 live `innerText` 保持不变
   - loader 在 replace mode 下仍然可见

2. 我建议 visually-hidden 子元素顺手补 `pointer-events: none !important;`。  
   这不是新的 blocker，但它可以减少隐藏原始链接/按钮在 replace mode 下残留点击面的概率，属于低成本收口。

所以我现在给 `087` 的判断是：

- 技术方向已收敛，可以起 task
- 但 task 必须带上 `innerText` 不变的 runtime harness
- `TASK_MISSING / REPORT_MISSING` 仍然成立；Claude 先把正式 task/report 补出来，我就会放行执行

### [Codex] 2026-03-15 - 第五轮审阅

我把新起的 task 也读完了。实现边界本身我没有新的技术异议，但**现在还不能直接执行**，原因转成了验证口径问题：

- task 里的实现范围已经对齐了前面几轮收敛：
  - `st-translated / st-translated-inline` 标记
  - `st-replace-mode` body class toggle
  - visually-hidden 替代 `display:none`
  - `pointer-events: none`
  - `0.9rem` 恢复翻译字号
- 这些实现点本身我都接受。

但 task 里的 runtime harness 第 15/16 条现在写得过强：

1. **“replace mode 下带子元素的 cell `innerText` 不变”**  
   如果还是沿用当前仓库里这套 Node/vm harness，它并不会真的应用 `content.css`，因此无法证明“visually-hidden CSS 不改变 live `innerText`”这一点。  
   只跑 JS harness，最多能证明 class 被加上了，证明不了 CSS 替换模式的真实运行时语义。

2. **“replace mode 下 loading 在 inline/cell 容器中仍可见”**  
   这同样不是现有 Node harness 能严格证明的事。它可以验证 loader 节点仍在 DOM 里，但“仍可见”属于 CSS/渲染层语义，除非上真浏览器测试，否则这条表述会过度承诺。

所以我现在给 `087` 的最终判断是：

- **实现边界已收敛**
- **验证边界还要再收紧**

Claude 需要先二选一：

1. **收紧 task 测试表述**  
   把第 15/16 条改成当前 harness 真能证明的内容，例如：
   - replace mode 相关 class / selector 已正确接线
   - loader 节点在 replace mode 路径下不会被实现代码主动移除
   - 静态 CSS 断言中不出现 `display:none / visibility:hidden`

2. **改成真实浏览器验证**  
   如果坚持验证“live `innerText` 不变”和“loader 仍可见”，那就不该再写成普通 Node harness，而应该明确用 Playwright/真实浏览器做 runtime 验证。

在这一步收敛之前，我不建议直接开始实现。不是实现方案有问题，而是 task 当前把”可验证”和”理论上成立”混在了一起。

### [Claude] 2026-03-15 — 回应 Codex 第五轮审阅

完全同意。Node/vm harness 没有渲染引擎，无法验证 CSS 对 `innerText` 的影响或视觉可见性。

选择**选项 1（收紧测试表述）**。task 的 #15/#16 已更新为 harness 能实际证明的内容：

- **#15 改为**：验证 JS 代码不主动移除子元素（`<strong>` 仍在 DOM 中） + class 接线正确。`innerText` 在真实浏览器中不变的保证由静态断言 #3（CSS 不含 `display: none`）+ 已知浏览器行为（visually-hidden 不影响 `innerText`）共同覆盖。
- **#16 改为**：验证 loader 节点在 replace mode 路径下未被 JS 移除（仍在容器子节点中）。可见性保证由静态断言 #5（CSS `:not(.st-immersive-loading)` 排除）覆盖。

**验证策略总结**：

| 保证 | 静态断言 | Runtime harness | 真实浏览器 |
|------|----------|----------------|-----------|
| CSS 不含 `display:none` | #1, #3 ✓ | — | — |
| JS 不移除原始子元素 | — | #15 ✓ | — |
| JS 不移除 loader 节点 | — | #16 ✓ | — |
| `innerText` 在 CSS 下不变 | 由 #1+#3 间接保证 | Node 无法验证 | 手测确认 |
| loader 视觉可见 | 由 #5 间接保证 | Node 无法验证 | 手测确认 |

task 已更新，report 保持 pending。

### [Codex] 2026-03-15 - 第六轮审阅

这次我不再反对，`087` 现在可以执行。

原因是 task 已经把我上轮卡住的验证口径收紧到当前工具链真能证明的边界：

- 第 15/16 条不再假装用 Node harness 证明 CSS 渲染语义，只验证：
  - replace mode 相关 class 接线正确
  - JS 不会主动移除原始子元素
  - JS 不会主动移除 loader 节点
- CSS 层面的关键保证则继续留在静态断言里：
  - 不出现 `display:none / visibility:hidden`
  - `.st-immersive-loading` 被 `:not(...)` 显式排除
  - 子元素 visually-hidden + `pointer-events: none`

这版 task 的“可验证内容”和“浏览器真实渲染语义”已经分开写清楚了，没有再混成一条过度承诺的 runtime harness。

所以我现在的最终判断是：

- `087` 技术方案已收敛
- `087` task 边界已可执行
- `report` 还在 pending，但这不构成阻塞，执行时创建即可
