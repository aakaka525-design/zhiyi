---
task: "096"
status: done
priority: P1
created: 2026-03-15
scope: "loading placeholder 重新设计 — CSS ::before 文字 + 呼吸动画"
---

# 096 — 加载占位符重新设计

## 范围

将不可见的 bar-pulse loading 替换为可见的"翻译中..."文字 + 呼吸动画。文字通过 CSS `::before` 伪元素实现，不污染 `innerText`。

---

## 改动

### 1. `injectLoadingPlaceholder` DOM 变更

**文件：`content/modules/immersive.js`**

改前：

```javascript
function injectLoadingPlaceholder(el) {
    if (el.querySelector('.st-immersive-loading')) return;
    const loader = document.createElement('span');
    loader.className = 'st-immersive-loading';
    loader.innerHTML = '<span></span><span></span><span></span>';
    el.appendChild(loader);
}
```

改后：

```javascript
function injectLoadingPlaceholder(el) {
    if (el.querySelector('.st-immersive-loading')) return;
    const loader = document.createElement('div');
    loader.className = 'st-immersive-loading';
    el.appendChild(loader);
}
```

- `span` → `div`（block 级别，与翻译结果一致）
- 移除 `innerHTML = '<span>...</span>'`（不再需要子元素）
- **无 `textContent`**（空元素，`innerText` 不受影响）

`removeLoadingPlaceholder` 不变（仍然查 `.st-immersive-loading` 然后 `remove()`）。

### 2. CSS 完全重写

**文件：`content/content.css`**

**移除**以下所有规则：

```css
/* 全部移除 */
.st-immersive-loading { ... }
.st-immersive-loading span { ... }
.st-immersive-loading span:nth-child(1) { ... }
.st-immersive-loading span:nth-child(2) { ... }
.st-immersive-loading span:nth-child(3) { ... }
@keyframes st-bar-pulse { ... }
```

**替换为**：

```css
.st-immersive-loading {
    display: block;
    padding: 0 0 0 10px;
    margin: 2px 0;
    border-left: 2px solid var(--accent);
    animation: st-loading-breathe 1.5s infinite ease-in-out;
}

.st-immersive-loading::before {
    content: '翻译中...';
    color: var(--accent);
    font-size: 0.85rem;
    line-height: 1.6;
}

@keyframes st-loading-breathe {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.85; }
}
```

**保留** `@keyframes st-bounce`（popup 的 `.st-loading-dots` 仍在使用）。

### 3. 087 替换模式兼容

现有 CSS 规则 `body.st-replace-mode .st-translated-inline > *:not(.st-immersive-translation):not(.st-immersive-loading)` 中的 `:not(.st-immersive-loading)` 排除不受 DOM 标签变更影响。无需改动。

---

## 约束

1. **`innerText` 不受影响**：loading 元素无 `textContent`，可见文字仅由 CSS `::before` 提供
2. **不改** `removeLoadingPlaceholder`
3. **不改** 三条批量路径的调用逻辑
4. **不改** 085 的全量预注入逻辑
5. **不改** own-artifact helper
6. **保留** `@keyframes st-bounce`
7. **不碰** popup.js、options.*、storage.js

---

## 测试

**文件：`tests/096-loading-redesign.test.mjs`**

### 静态断言

1. CSS 包含 `.st-immersive-loading::before` 规则
2. CSS `::before` 包含 `content:` 属性
3. CSS 包含 `@keyframes st-loading-breathe`
4. CSS **不包含** `@keyframes st-bar-pulse`（已移除）
5. CSS **不包含** `.st-immersive-loading span`（子 span 规则已移除）

### Runtime harness

6. **loading 元素无文本内容**：调用 `injectLoadingPlaceholder` → 断言 loader 元素的 `textContent` 为空字符串
7. **loading 不改变父元素 `innerText`**：构造含文本的元素 → `injectLoadingPlaceholder` → 断言 `el.innerText` 不含 "翻译中"
8. **loading 元素是 `DIV`**：断言 loader 的 `tagName` 为 `'DIV'`
9. **关闭清理**：构造含 `.st-immersive-loading` 的元素 → `toggleImmersive()` 关闭 → 断言已移除

### 旧测试基线同步

以下测试可能断言了旧的 loading DOM 结构（3 个子 span），需同步更新：

- `tests/084-immersive-ux.test.mjs`
- `tests/085-loading-visibility.test.mjs`
- `tests/086-immersive-ux-polish.test.mjs`

全量 `node --test tests/*.test.mjs` 必须通过。

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `content/modules/immersive.js` | `injectLoadingPlaceholder` DOM 简化 |
| `content/content.css` | loading CSS 完全重写 |
| `tests/096-loading-redesign.test.mjs` | 新增测试 |
| `tests/084-immersive-ux.test.mjs` | 旧测试基线同步 |
| `tests/085-loading-visibility.test.mjs` | 旧测试基线同步 |
| `tests/086-immersive-ux-polish.test.mjs` | 旧测试基线同步 |

## 验证

- `/opt/homebrew/bin/node --test tests/096-loading-redesign.test.mjs`
- `/opt/homebrew/bin/node --test tests/*.test.mjs`
- `/opt/homebrew/bin/node --check content/modules/immersive.js tests/096-loading-redesign.test.mjs`
- `git diff --check`
