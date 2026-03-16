---
task: "102"
status: done
priority: P2
created: 2026-03-15
scope: "悬浮气泡显示原文（replace-mode-only + 定位 clamp + token scope）"
---

# 102 — 悬浮气泡显示原文

## 范围

替换模式下 hover 译文时弹出浮动气泡显示原文。双语模式不启用。移除 101 的 `:has()` in-place hover 规则。

---

## 改动

### 1. `injectTranslation` 存储原文

**文件：`content/modules/immersive.js`**

在三条路径注入译文前，将原文存为 `data-st-original-text`：

```javascript
const originalText = container.innerText.trim();

// block-wrapper 路径
wrapper.setAttribute('data-st-original-text', originalText);

// inline 路径
container.setAttribute('data-st-original-text', originalText);

// cell-internal 路径
container.setAttribute('data-st-original-text', originalText);
```

### 2. 气泡逻辑 — 事件委托 + 定位 helper

**文件：`content/modules/immersive.js`**

#### 全局气泡 + 事件绑定

在 `startMutationObserver` 或 `toggleImmersive` 启动路径中绑定（仅 replace mode）：

```javascript
let originalBubble = null;

function ensureOriginalBubble() {
    if (originalBubble) return originalBubble;
    originalBubble = document.createElement('div');
    originalBubble.id = 'st-original-bubble';
    document.body.appendChild(originalBubble);
    return originalBubble;
}

function showOriginalBubble(translationEl) {
    const source = translationEl.closest('[data-st-original-text]');
    if (!source) return;
    const text = source.getAttribute('data-st-original-text');
    if (!text) return;

    const bubble = ensureOriginalBubble();
    bubble.textContent = text;
    bubble.classList.add('active');

    const rect = translationEl.getBoundingClientRect();
    const pos = positionOriginalBubble(rect, bubble.offsetWidth, bubble.offsetHeight,
        window.innerWidth, window.innerHeight);
    bubble.style.left = `${pos.left}px`;
    bubble.style.top = `${pos.top}px`;
}

function hideOriginalBubble() {
    if (originalBubble) {
        originalBubble.classList.remove('active');
    }
}
```

#### 定位 helper — 上下翻转 + 视口 clamp

```javascript
function positionOriginalBubble(rect, bubbleWidth, bubbleHeight, viewportW, viewportH) {
    const padding = 8;
    const safeW = Number.isFinite(bubbleWidth) && bubbleWidth > 0 ? bubbleWidth : 300;
    const safeH = Number.isFinite(bubbleHeight) && bubbleHeight > 0 ? bubbleHeight : 60;

    // 水平：左对齐，clamp 到视口
    const maxLeft = Math.max(padding, viewportW - safeW - padding);
    const left = Math.min(Math.max(padding, rect.left), maxLeft);

    // 垂直：优先上方，放不下翻到下方
    const preferTop = rect.top - safeH - padding;
    const preferBottom = rect.bottom + padding;
    const top = preferTop >= padding ? preferTop
        : preferBottom + safeH <= viewportH - padding ? preferBottom
        : padding;

    return { top, left };
}
```

#### 事件委托

```javascript
function handleBubbleMouseOver(e) {
    if (ST.state.settings?.showOriginal !== false) return;  // 仅 replace mode
    if (ST.state.settings?.hoverShowOriginal === false) return;  // 设置开关
    const translation = e.target.closest('.st-immersive-translation');
    if (translation) showOriginalBubble(translation);
}

function handleBubbleMouseOut(e) {
    const translation = e.target.closest('.st-immersive-translation');
    if (translation) hideOriginalBubble();
}

// 在 toggleImmersive 启动路径中绑定
document.addEventListener('mouseover', handleBubbleMouseOver);
document.addEventListener('mouseout', handleBubbleMouseOut);
```

### 3. 关闭清理

**`toggleImmersive` 关闭路径**：

```javascript
// 移除气泡
if (originalBubble) {
    originalBubble.remove();
    originalBubble = null;
}
// 移除事件监听
document.removeEventListener('mouseover', handleBubbleMouseOver);
document.removeEventListener('mouseout', handleBubbleMouseOut);
// 清理 data-st-original-text（只清理扩展自有节点）
document.querySelectorAll('.st-immersive-wrapper[data-st-original-text], .st-translated-inline[data-st-original-text]').forEach(el => {
    el.removeAttribute('data-st-original-text');
});
```

### 4. 移除 101 的 `:has()` hover 规则

**文件：`content/content.css`**

删除：

```css
/* 删除 */
body.st-replace-mode .st-translated:has(+ .st-immersive-wrapper:hover),
body.st-replace-mode .st-translated:hover {
    opacity: 1;
    max-height: 2000px;
    overflow: visible;
    pointer-events: auto;
}
```

101 的隐藏方式改动保留（`opacity: 0; max-height: 0` 替代旧的 `position: absolute; clip-path`）。

### 5. 气泡 CSS + token scope

**文件：`content/content.css`**

**token scope** — 在基础 scope selector（line 6-16）和 dark scope selector（line 32-42）中添加 `#st-original-bubble`：

```css
/* 基础 token scope — 添加 #st-original-bubble */
#smart-translator-bubble,
.st-immersive-wrapper,
/* ... 现有选择器 ... */
#st-toast,
#st-original-bubble {          /* ← 新增 */
    --accent: #7A9A8B;
    /* ... */
}

/* 深色 token scope — 添加 :root[data-st-theme="dark"] #st-original-bubble */
:root[data-st-theme="dark"] #smart-translator-bubble,
/* ... 现有选择器 ... */
:root[data-st-theme="dark"] #st-toast,
:root[data-st-theme="dark"] #st-original-bubble {   /* ← 新增 */
    --accent: #8FB3A4;
    /* ... */
}
```

**气泡样式**：

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

### 6. 设置开关

**storage.js**：`DEFAULT_SETTINGS` 添加 `hoverShowOriginal: true`

**options.html**：在 showOriginal 之后添加 checkbox：

```html
<div class="setting-group">
    <div class="setting-header">
        <div>
            <label class="setting-label">悬停显示原文</label>
            <p class="setting-desc">替换模式下悬停译文时显示原文气泡</p>
        </div>
        <label class="switch">
            <input type="checkbox" id="hover-show-original" checked>
            <span class="slider"></span>
        </label>
    </div>
</div>
```

**options.js**：`elements` 添加 `hoverShowOriginal`、`loadSettings` 读取、`bindEvents` 用 `saveImmediateToggle`、`collectCurrentSettings` 包含

**options-ui-state.js**：`buildSettingsSnapshot` 添加 `hoverShowOriginal: settings.hoverShowOriginal !== false`

---

## 约束

1. **replace-mode-only**：`showOriginal === false` 时才启用，双语模式不启用
2. **定位 clamp**：上方放不下翻下方，左右 clamp 到视口
3. **`#st-original-bubble` 进 token scope**：基础 + dark
4. **`pointer-events: none`**：气泡不拦截鼠标
5. **101 的 `:has()` hover 规则移除**，隐藏方式改动保留
6. **不改** inline/cell 替换模式 CSS
7. **不改** 083 stale hash / rescan

---

## 测试

**文件：`tests/102-hover-bubble.test.mjs`**

### 静态断言

1. CSS 包含 `#st-original-bubble` 样式规则
2. CSS token scope 基础选择器包含 `#st-original-bubble`
3. CSS dark scope 选择器包含 `#st-original-bubble`
4. CSS **不包含** 101 的 `:has(+ .st-immersive-wrapper:hover)` 规则
5. JS `injectTranslation` 包含 `data-st-original-text`
6. JS 包含 `positionOriginalBubble` 函数
7. JS `toggleImmersive` 关闭路径包含 `data-st-original-text` 清理
8. `options.html` 包含 `hover-show-original`
9. `options-ui-state.js` 的 `buildSettingsSnapshot` 包含 `hoverShowOriginal !== false`（不是 `Boolean()`）

全量 `node --test tests/*.test.mjs` 必须通过。

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `content/modules/immersive.js` | 存原文 + 气泡逻辑 + 定位 + 事件 + 清理 |
| `content/content.css` | 气泡样式 + token scope + 删 101 hover 规则 |
| `content/content.js` | mergeDefaults 增加 `hoverShowOriginal` 默认值 |
| `options/options.html` | hoverShowOriginal toggle |
| `options/options.js` | hoverShowOriginal 读写 |
| `options/options-ui-state.js` | snapshot 添加 hoverShowOriginal |
| `src/core/storage.js` | DEFAULT_SETTINGS 添加 hoverShowOriginal |
| `tests/102-hover-bubble.test.mjs` | 回归测试 |
