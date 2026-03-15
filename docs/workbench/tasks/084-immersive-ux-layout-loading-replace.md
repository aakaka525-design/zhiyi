---
task: "084"
status: done
priority: P2
created: 2026-03-15
scope: "A (inline path block-化) + B (loading placeholder)"
---

# 084 — 沉浸式翻译 UX：inline 路径排版修复 + 翻译加载动画

## 范围

只做 **A + B**。C（替换/对照模式）已拆出，不在本任务范围内。

## 执行结果

- [x] A 已完成：`injectTranslation()` 的 inline/flex/grid 路径现在直接追加 `span.st-immersive-translation`，不再创建 `→ separator`，也不再写 `transEl.style.cssText`。
- [x] B 已完成：新增 `injectLoadingPlaceholder(...)` / `removeLoadingPlaceholder(...)`，并接入初始扫描、observer、scroll rescan 三条批量路径。
- [x] 关闭沉浸式翻译时会统一清理 `.st-immersive-loading`。
- [x] 新增专项回归测试 `tests/084-immersive-ux.test.mjs`，并同步修正受 084 合法结构变化影响的旧沉浸式测试基线。
- [x] fresh verification 已通过：
  - `node --test tests/084-immersive-ux.test.mjs`
  - `node --test tests/*.test.mjs` (`293/293`)
  - `node --check content/modules/immersive.js`
  - `git diff --check`

---

## A — inline 路径 block-化修复

### 问题

`injectTranslation()` 的 inline 路径（`isFlexItem || isGridItem || isInline`）使用 `→` 分隔符 + `display: inline` 译文。长文本下原文和译文在同一行连续排列，可读性极差。影响所有走 inline 路径的元素，包括但不限于 Telegram `.translatable-message`、flex/grid 布局中的段落。

### 改动

**文件：`content/modules/immersive.js` — `injectTranslation` 函数**

改前（当前 inline 路径）：

```javascript
if (isFlexItem || isGridItem || isInline) {
    const separator = document.createElement('span');
    separator.className = 'st-translation-separator';
    separator.innerHTML = ' &nbsp;→&nbsp; ';
    separator.style.cssText = 'color: var(--accent); opacity: 0.6;';

    transEl.style.cssText = 'display: inline; font-style: normal; color: var(--accent); margin-left: 4px; background: transparent; border-left: none; padding: 0; border-radius: 0; box-shadow: none; margin-top: 0; margin-bottom: 0; font-size: inherit; line-height: inherit;';

    container.appendChild(separator);
    container.appendChild(transEl);
}
```

改后：

```javascript
if (isFlexItem || isGridItem || isInline) {
    container.appendChild(transEl);
}
```

### 约束

1. **只改 inline 路径**。cell-internal（`td, th, li, figcaption, dt, dd, caption`）和 block wrapper 两条路径完全不动。
2. **不创建 separator**，不设 `transEl.style.cssText`。`transEl` 是 `<span class="st-immersive-translation">`，CSS 类已有 `display: block` + 完整视觉样式（`content.css:241-254`）。移除 inline style override 后 CSS 类自动生效。
3. **`hasOwnTranslationArtifacts` 等 helper 不改**。它们仍然检查 `st-translation-separator`（向后兼容已有翻译产物）。新注入不再产生 separator，旧的在 `toggleImmersive()` 关闭时被清理。
4. **Residual risk（已知，不阻塞）**：h1-h6 在 inline/flex/grid 路径下不会像 block wrapper 路径那样同步 `fontSize`/`fontWeight`。这是现有行为的延续，不是新引入的问题。

---

## B — 翻译加载动画（per-element loading placeholder）

### 问题

沉浸式翻译进行中时，没有 per-element 的视觉反馈。用户不知道哪些内容正在翻译。

### 改动

#### B1. 添加 helper 函数

**文件：`content/modules/immersive.js`**

在 `removeOwnTranslationArtifacts` 函数之后、`toggleImmersive` 之前，添加：

```javascript
function injectLoadingPlaceholder(el) {
    if (el.querySelector('.st-immersive-loading')) return;
    const loader = document.createElement('span');
    loader.className = 'st-immersive-loading';
    loader.innerHTML = '<span></span><span></span><span></span>';
    el.appendChild(loader);
}

function removeLoadingPlaceholder(el) {
    const loader = el.querySelector('.st-immersive-loading');
    if (loader) loader.remove();
}
```

#### B2. 修改三条批量翻译路径

**所有三条路径的改动模式一致**：

```
发送前：batch.forEach(el => injectLoadingPlaceholder(el));
finally 中：batch.forEach(el => removeLoadingPlaceholder(el));
```

**路径 1 — 初始扫描（`toggleImmersive` 批量循环）**：

```javascript
const batch = paragraphs.slice(i, i + IMMERSIVE_BATCH_SIZE);
const texts = batch.map(p => p.innerText.trim());

batch.forEach(p => injectLoadingPlaceholder(p));  // ← 新增

try {
    const response = await ST.sendMessage({ ... });

    // ... 现有的 response 处理逻辑 ...
} catch (err) {
    // ... 现有的 error 处理 ...
} finally {
    batch.forEach(p => removeLoadingPlaceholder(p));  // ← 新增
}
```

注意：初始扫描当前没有 `try/finally` 结构，需要将现有的 `try/catch` 扩展为 `try/catch/finally`。

**路径 2 — Observer（`startMutationObserver` 批量循环）**：

同样模式。Observer 的批量循环当前有 `try/catch/finally`（`finally` 中有 `pendingTranslations.delete`）。在 `finally` 中追加 `removeLoadingPlaceholder`，在 `sendMessage` 之前追加 `injectLoadingPlaceholder`。

**路径 3 — Scroll rescan（`rescanUntranslatedElements` 批量循环）**：

同样模式。rescan 的批量循环当前有 `try/catch/finally`（`finally` 中有 `pendingTranslations.delete`）。同上。

#### B3. 关闭时清理

**文件：`content/modules/immersive.js` — `toggleImmersive` 关闭路径**

改前：

```javascript
document.querySelectorAll('.st-immersive-translation, .st-immersive-wrapper, .st-translation-separator').forEach(el => el.remove());
```

改后：

```javascript
document.querySelectorAll('.st-immersive-translation, .st-immersive-wrapper, .st-translation-separator, .st-immersive-loading').forEach(el => el.remove());
```

#### B4. CSS

**文件：`content/content.css`**

在 `.st-immersive-translation` 的 cell-internal 规则之后（当前 `caption > .st-immersive-translation` 规则之后）添加：

```css
.st-immersive-loading {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: 8px;
    vertical-align: middle;
}

.st-immersive-loading span {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--accent);
    opacity: 0.6;
    animation: st-bounce 1.2s infinite ease-in-out;
}

.st-immersive-loading span:nth-child(2) {
    animation-delay: 0.15s;
}

.st-immersive-loading span:nth-child(3) {
    animation-delay: 0.3s;
}
```

复用已有的 `@keyframes st-bounce`（`content.css:196-208`），不重复定义。

### 约束

1. **loading placeholder 不混入 own-artifact helper**。`hasOwnTranslationArtifacts`、`getOwnCleanSourceText`、`removeOwnTranslationArtifacts` 不检查也不处理 `.st-immersive-loading`。loading 是独立 class，独立生命周期。
2. **cleanup 必须在 `finally` 中**，不能只在成功分支 remove。失败、超时、关闭沉浸式翻译时都不能残留。
3. **`injectLoadingPlaceholder` 调用点在 `batch.forEach(p => p.innerText.trim())` 之后**，确保 `innerText` 取值不被 loading placeholder 的内容污染。

---

## 测试

**文件：`tests/084-immersive-ux.test.mjs`**

### A 的测试

1. inline 路径不再创建 `st-translation-separator` 元素
2. inline 路径不再在 `transEl` 上设置 `style.cssText` inline override
3. inline 路径的 `transEl` 是 `container` 的直接子节点（`container.appendChild`）
4. cell-internal 路径行为不变（仍然创建 `<div>`）
5. block wrapper 路径行为不变

### B 的测试

6. `injectLoadingPlaceholder` 在元素内追加 `.st-immersive-loading` 节点
7. `removeLoadingPlaceholder` 移除 `.st-immersive-loading` 节点
8. `injectLoadingPlaceholder` 重复调用不创建多个 loading 节点
9. `toggleImmersive` 关闭时清理 `.st-immersive-loading`

---

## 不做的事

- **不改** cell-internal 路径（td/th/li/figcaption/dt/dd/caption）
- **不改** block wrapper 路径
- **不改** `hasOwnTranslationArtifacts` / `getOwnCleanSourceText` / `removeOwnTranslationArtifacts`
- **不改** `rescanUntranslatedElements` 的过滤逻辑
- **不改** Observer 选择器
- **不改** 初始扫描选择器
- **不做** C（替换/对照模式）— 拆到后续独立任务
- **不碰** popup.js、sidebar.js、float-window.js、tts.js、message-router.js、translator.js、service-worker.js、offscreen.js、manifest.json、options.html、options.js、storage.js
