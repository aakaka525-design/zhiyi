---
task: "087"
status: done
priority: P2
created: 2026-03-15
scope: "showOriginal 替换/对照模式（CSS class toggle + Options UI）"
---

# 087 — 沉浸式翻译替换/对照模式设置

## 范围

接线已有的 `showOriginal` 设置，通过 CSS body class toggle 实现非破坏性替换模式。不做 runtime 实时切换，启动时读取设置、关闭时清理。

---

## 改动

### 1. injectTranslation 添加容器标记 class

**文件：`content/modules/immersive.js` — `injectTranslation` 函数**

在三条注入路径中，注入翻译后给容器添加标记 class：

```javascript
if (isFlexItem || isGridItem || isInline) {
    container.classList.add('st-translated-inline');  // ← 新增
    container.appendChild(transEl);
} else if (container.matches('td, th, li, figcaption, dt, dd, caption')) {
    const blockTransEl = document.createElement('div');
    blockTransEl.className = 'st-immersive-translation';
    blockTransEl.innerText = translation;
    container.classList.add('st-translated-inline');  // ← 新增
    container.appendChild(blockTransEl);
} else {
    // ... 现有 block wrapper 逻辑 ...
    container.classList.add('st-translated');  // ← 新增（在 insertBefore 之前）
    if (container.parentNode) {
        container.parentNode.insertBefore(wrapper, container.nextSibling);
    }
}
```

**只添加 class，不修改/移动/删除任何 DOM 内容。**

### 2. toggleImmersive 模式切换

**文件：`content/modules/immersive.js` — `toggleImmersive` 函数**

**开启路径**（在 `ST.showToast('正在启动沉浸式翻译...')` 之后）：

```javascript
const showOriginal = ST.state.settings?.showOriginal !== false;
if (!showOriginal) {
    document.body.classList.add('st-replace-mode');
}
```

**关闭路径**（在现有的 `querySelectorAll(...).forEach(el => el.remove())` 之后）：

```javascript
document.body.classList.remove('st-replace-mode');
document.querySelectorAll('.st-translated, .st-translated-inline').forEach(el => {
    el.classList.remove('st-translated', 'st-translated-inline');
});
```

### 3. CSS 替换模式规则

**文件：`content/content.css`**

在 086 的 `span.st-immersive-translation` 覆盖规则之后、`.st-immersive-loading` 之前添加：

```css
/* ========================================
   替换模式（showOriginal: false）
   ======================================== */

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

/* Inline / cell-internal 路径 — 隐藏原始文本节点 */
body.st-replace-mode .st-translated-inline {
    font-size: 0 !important;
    line-height: 0 !important;
    color: transparent !important;
}

/* 隐藏除翻译和 loading 外的子元素 — visually-hidden，不用 display:none */
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
    pointer-events: none !important;
}

/* 恢复翻译子节点的正常显示（rem 不受父 font-size: 0 影响） */
body.st-replace-mode .st-translated-inline > .st-immersive-translation {
    font-size: 0.9rem !important;
    line-height: 1.7 !important;
    color: var(--accent) !important;
}
```

### CSS 约束（经过四轮 Codex 审阅收敛）

1. **全局禁止 `display: none` 和 `visibility: hidden`**：所有隐藏均使用 visually-hidden 技术。原因：
   - `display: none` → 被 rescan 的 `getComputedStyle` 过滤掉（083 冲突）
   - `display: none` → 从 live `innerText` 中移除元素文本（源文不完整）
   - `visibility: hidden` → 同样被 rescan 过滤 + 影响 `innerText`
2. **翻译字号用 `0.9rem`**：不用 `em`（会被父 `font-size: 0` 归零）
3. **`:not()` 排除 `.st-immersive-translation` 和 `.st-immersive-loading`**：翻译正常显示，stale 重翻译时 loading 反馈可见
4. **子元素加 `pointer-events: none`**：防止隐藏的原始链接/按钮残留点击面

### 4. Options UI

**文件：`options/options.html`**

在快捷键支持的 `setting-group` 之后添加：

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

**文件：`options/options.js`**

4 处改动：

**a. `elements` 对象**：

```javascript
showOriginal: document.getElementById('show-original'),
```

**b. `loadSettings` 函数**：

```javascript
elements.showOriginal.checked = settings.showOriginal !== false;
```

**c. `collectCurrentSettings` 函数**：

```javascript
showOriginal: elements.showOriginal.checked,
```

**d. `bindEvents` 函数**（与深色模式/调试模式同模式，使用 `saveImmediateToggle` 自动保存）：

```javascript
elements.showOriginal.addEventListener('change', (e) => {
    saveImmediateToggle({ showOriginal: e.target.checked });
});
```

### 5. storage.js

**无需改动**。`showOriginal: true` 默认值已存在（`storage.js:86`）。

---

## 约束

1. **非破坏性**：不使用 `innerHTML = ''`、不移动子节点、不删除原始内容
2. **全局禁止 `display: none` / `visibility: hidden` 隐藏原始内容**：所有隐藏均用 visually-hidden
3. **翻译字号用 `rem`**：`0.9rem`
4. **loading 保持可见**：`:not()` 排除
5. **子元素加 `pointer-events: none`**：防止隐藏链接残留点击面
6. **不做 runtime 实时切换**：启动时读取设置，关闭时清理
7. **不改** `hasOwnTranslationArtifacts` / `getOwnCleanSourceText` / `removeOwnTranslationArtifacts`
8. **不改** rescan 过滤逻辑
9. **不改** 083 stale hash 语义
10. **不改** 086 的 inline CSS / loading CSS

---

## 测试

**文件：`tests/087-replace-bilingual-mode.test.mjs`**

两层测试结构：

### 第一层 — 静态断言

1. **CSS `body.st-replace-mode .st-translated` 规则**：断言包含 `clip-path` 和 `position:\s*absolute`（visually-hidden），**不包含** `display:\s*none`。
2. **CSS `body.st-replace-mode .st-translated-inline` 规则**：断言包含 `font-size:\s*0`。
3. **CSS 子元素隐藏不用 `display: none`**：断言 `.st-translated-inline > *:not(` 规则中包含 `clip-path`，**不包含** `display:\s*none`。
4. **CSS 子元素含 `pointer-events: none`**：断言相关规则包含 `pointer-events:\s*none`。
5. **CSS loading 排除**：断言包含 `:not(.st-immersive-loading)`。
6. **CSS 翻译字号用 rem**：断言包含 `font-size:\s*0\.9rem`。
7. **JS injectTranslation 添加标记 class**：断言源码包含 `st-translated-inline` 和 `st-translated`。
8. **JS toggleImmersive 包含 body class 切换**：断言源码包含 `st-replace-mode`。
9. **options.html 存在 show-original toggle**：断言包含 `id="show-original"`。
10. **options.js 读写 showOriginal**：断言包含 `showOriginal`。

### 第二层 — Runtime harness

11. **block wrapper 路径添加 `st-translated` class**：构造 `<p>` → `injectTranslation` → 断言 container 有 `st-translated` class。
12. **inline 路径添加 `st-translated-inline` class**：构造 inline 容器 → `injectTranslation` → 断言 container 有 `st-translated-inline` class。
13. **cell-internal 路径添加 `st-translated-inline` class**：构造 `<td>` → `injectTranslation` → 断言 container 有 `st-translated-inline` class。
14. **toggleImmersive 关闭时清理标记 class**：构造含 `st-translated` / `st-translated-inline` class 的元素 → 调用 `toggleImmersive()` 关闭 → 断言 class 已移除。
15. **replace mode class 接线正确 + JS 不主动移除子元素**：构造 `<td>` 含 `<strong>Price</strong> details` 子结构 → `injectTranslation` → 断言 container 有 `st-translated-inline` class，且原始 `<strong>` 子节点仍在 DOM 中（JS 代码未将其移除）。配合静态断言 #3（CSS 不含 `display: none`）共同保证 `innerText` 在真实浏览器中不变。
16. **loading 节点在 replace mode 路径下未被 JS 移除**：构造 inline 容器 → `injectLoadingPlaceholder` → `injectTranslation` → 断言 `.st-immersive-loading` 节点仍在容器的子节点中。配合静态断言 #5（CSS `:not(.st-immersive-loading)` 排除）共同保证 loader 在真实浏览器中可见。

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `content/modules/immersive.js` | injectTranslation 标记 class + toggleImmersive 模式切换/清理 |
| `content/content.css` | 替换模式 CSS 规则 |
| `options/options.html` | showOriginal toggle UI |
| `options/options.js` | showOriginal 设置读写 + 自动保存 |
| `tests/087-replace-bilingual-mode.test.mjs` | 静态 + runtime harness 两层测试 |

## 不做的事

- **不改** `src/core/storage.js`（`showOriginal` 默认值已存在）
- **不改** `injectTranslation` 的三路径判定逻辑
- **不改** own-artifact helper / stale hash 语义
- **不改** rescan 过滤逻辑
- **不改** 086 的 inline CSS / loading CSS
- **不做** runtime 实时切换
- **不做** 破坏性 DOM 操作
- **不碰** popup.js、sidebar.js、float-window.js、tts.js、message-router.js、translator.js、service-worker.js、offscreen.js、manifest.json
