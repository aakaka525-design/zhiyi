---
task: "103"
status: done
priority: P2
created: 2026-03-16
scope: "EXCLUDE_SELECTORS 扩展 + containsHardProtectedContent helper + 三路径接线"
---

# 103 — 智能跳过：代码块 / translate="no"

## 范围

扩展 `EXCLUDE_SELECTORS` + 新增 `containsHardProtectedContent` helper 跳过包含硬保护子内容的容器。三条过滤链同步接线。

---

## 改动

**文件：`content/modules/immersive.js`**

### 1. 扩展 EXCLUDE_SELECTORS

改前：

```javascript
const EXCLUDE_SELECTORS = [
    'nav', 'header', 'footer', 'aside',
    'button', 'a', 'input', 'select', 'label',
    '.Header', '.AppHeader', '.pagehead',
    '.btn', '.Button', '.Counter', '.Label',
    '.sidebar', '.menu', '.toolbar'
];
```

改后：

```javascript
const EXCLUDE_SELECTORS = [
    'nav', 'header', 'footer', 'aside',
    'button', 'a', 'input', 'select', 'label',
    '.Header', '.AppHeader', '.pagehead',
    '.btn', '.Button', '.Counter', '.Label',
    '.sidebar', '.menu', '.toolbar',
    'pre', 'code', 'kbd', 'samp', 'var',
    '[translate="no"]', '[role="code"]',
    '.highlight'
];
```

效果：元素本身是 `pre/code/kbd/...` 或在其内部 → `isExcludedByImmersiveContext` 排除。

### 2. 新增 `containsHardProtectedContent` helper

```javascript
const HARD_PROTECTED_SELECTORS = 'pre, [translate="no"], [role="code"], .highlight';

function containsHardProtectedContent(el) {
    return el.querySelector(HARD_PROTECTED_SELECTORS) !== null;
}
```

效果：一个 `<li>` 或 `<p>` 如果**包含** `<pre>` / `[translate="no"]` / `.highlight` 等硬保护子节点 → 整个元素跳过翻译。

**为什么不包含 `code/kbd/samp/var`**：这些是行内元素，在段落中出现极其常见（如 `<p>Run <code>npm</code></p>`）。如果包含它们，大量正常段落会被完全跳过。行内 code 的保护需要后续 placeholder/protected-span 设计，不在本轮范围。

### 3. 三条过滤链接线

**路径 1 — 初始扫描**（`toggleImmersive` 通用过滤）：

```javascript
// 在 isExcludedByImmersiveContext(p) 之后添加
if (containsHardProtectedContent(p)) return false;
```

**路径 2 — Observer**（`startMutationObserver` 过滤）：

```javascript
// 在 isExcludedByImmersiveContext(el) 之后添加
if (containsHardProtectedContent(el)) return false;
```

**路径 3 — Scroll rescan**（`rescanUntranslatedElements` 过滤）：

```javascript
// 在 isExcludedByImmersiveContext(el) 之后添加
if (containsHardProtectedContent(el)) return false;
```

三条路径统一调用位置：在 `isExcludedByImmersiveContext` 检查之后、`innerText` 读取之前。

**Discord 专用路径**（`[id^="message-content-"]` 初始扫描 + observer）：在过滤链中添加 `containsHardProtectedContent` 检查。Discord 消息可能包含代码块。

**Telegram 专用路径**（`.translatable-message` 初始扫描 + observer）：同样添加检查。

**Twitter 路径不加**（tweet 结构简单，代码块极少出现）。

---

## 约束

1. **`containsHardProtectedContent` 只检查 `pre, [translate="no"], [role="code"], .highlight`**
2. **不检查** `code, kbd, samp, var`（行内元素，会过度排除）
3. **不做** `isCodeDominant` 占比检测
4. **不做** 启发式代码识别（camelCase、import 等）
5. **不做** inline code placeholder/protected-span
6. **不改** `GENERIC_SELECTORS`
7. **不改** `isExcludedByImmersiveContext` 函数逻辑
8. **不碰** content.css、options.*、popup.js、storage.js

---

## 测试

**文件：`tests/103-smart-skip-code.test.mjs`**

### 静态断言

1. `EXCLUDE_SELECTORS` 包含 `'pre'`
2. `EXCLUDE_SELECTORS` 包含 `'code'`
3. `EXCLUDE_SELECTORS` 包含 `'[translate="no"]'`
4. `EXCLUDE_SELECTORS` 包含 `'.highlight'`
5. 源码包含 `containsHardProtectedContent` 函数定义
6. 源码包含 `HARD_PROTECTED_SELECTORS` 常量
7. 三条 generic 过滤路径 + Discord 专用路径 + Telegram 专用路径都调用 `containsHardProtectedContent`

### Runtime harness

8. **`<pre>` 元素被 `isExcludedByImmersiveContext` 排除**
9. **`<p>` 包含 `<pre>` 子节点被 `containsHardProtectedContent` 跳过**
10. **`<p>` 包含 `<code>` 子节点不被 `containsHardProtectedContent` 跳过**（行内 code 不在硬保护列表中）
11. **`<p translate="no">` 被 `isExcludedByImmersiveContext` 排除**

全量 `node --test tests/*.test.mjs` 必须通过。

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `content/modules/immersive.js` | EXCLUDE_SELECTORS 扩展 + helper + 三路径接线 |
| `tests/103-smart-skip-code.test.mjs` | 静态 + runtime 测试 |
