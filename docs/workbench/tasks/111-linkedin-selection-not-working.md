---
task: "111"
status: done
priority: P2
created: 2026-03-16
scope: "mouseup-only 改为捕获阶段"
---

# 111 — 划词翻译在部分网站无效 — mouseup 改为捕获阶段

## 范围

只改 `mouseup` 为捕获阶段。`mousedown` / `dblclick` 不动。

---

## 改动

**文件：`content/content.js` — `bindEvents`**

改前：

```javascript
document.addEventListener('mouseup', ST.handleMouseUp);
```

改后：

```javascript
document.addEventListener('mouseup', ST.handleMouseUp, true);
```

根因：页面脚本可能阻断冒泡阶段 mouseup，导致划词翻译的触发事件不达。捕获阶段在冒泡前执行，不受 `stopPropagation()` 影响。

`mousedown`（关闭气泡/图标）和 `dblclick`（双击翻译）保持默认注册方式不变。

---

## 约束

1. **只改 `mouseup`**
2. **不改** `mousedown` / `dblclick` 的注册方式
3. **不改** selection.js 的 handler 逻辑
4. **不碰** immersive.js、popup.js、options.*

---

## 测试

**文件：`tests/111-selection-capture.test.mjs`**

### 静态断言

1. `content.js` 的 `mouseup` 注册包含 `true`（捕获阶段）
2. `content.js` 的 `mousedown` 注册**不包含** `true`（保持默认）
3. `content.js` 的 `dblclick` 注册**不包含** `true`（保持默认）

全量 `node --test tests/*.test.mjs` 必须通过。

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `content/content.js` | `mouseup` addEventListener 加 `true` |
| `tests/111-selection-capture.test.mjs` | 静态断言 |
