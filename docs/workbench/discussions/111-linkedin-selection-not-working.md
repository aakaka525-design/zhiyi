---
discussion: "111"
created: 2026-03-16
---

# 111 — LinkedIn 划词翻译无效 — mouseup 事件可能被拦截

## 发现过程

用户在 LinkedIn 上选中文本后，划词翻译完全无反应（无图标、无气泡）。设置页划词翻译开关已开启。

### 重叠检查

- **090**：划词同语言过滤 — 不同问题，090 是同语言跳过，111 是事件完全不触发
- 没有任何讨论涉及特定网站的划词翻译失效
- 111 是新问题

---

## 问题追踪

### 当前事件注册

`content.js:99`：

```javascript
document.addEventListener('mouseup', ST.handleMouseUp);
```

默认冒泡阶段（第三个参数未传，等同于 `false`）。

### 可能的根因

**LinkedIn 的 React 应用使用捕获阶段事件处理**。现代 SPA 框架（尤其是 React 的合成事件系统）通常在根元素上注册捕获阶段的事件监听器。如果 LinkedIn 的事件处理在捕获阶段调用了 `event.stopPropagation()`，所有冒泡阶段的监听器（包括我们的 `handleMouseUp`）都不会被触发。

这不仅影响 LinkedIn — 任何使用 `stopPropagation()` 的 SPA 都可能有此问题。

### 验证方式

在 LinkedIn 页面的 DevTools Console 中执行：

```javascript
document.addEventListener('mouseup', (e) => console.log('mouseup captured:', e.target), true);
document.addEventListener('mouseup', (e) => console.log('mouseup bubbled:', e.target), false);
```

如果选中文本后只看到 "captured" 而看不到 "bubbled"，说明事件在捕获阶段被拦截。

---

## 建议方案

### 将 mouseup / mousedown / dblclick 改为捕获阶段

**文件：`content/content.js` — `bindEvents`**

改前：

```javascript
document.addEventListener('mouseup', ST.handleMouseUp);
document.addEventListener('mousedown', ST.handleMouseDown);
document.addEventListener('dblclick', ST.handleDoubleClick);
```

改后：

```javascript
document.addEventListener('mouseup', ST.handleMouseUp, true);
document.addEventListener('mousedown', ST.handleMouseDown, true);
document.addEventListener('dblclick', ST.handleDoubleClick, true);
```

捕获阶段在冒泡阶段之前触发，不受页面 JS 的 `stopPropagation()` 影响。

### 风险评估

| 风险 | 影响 | 缓解 |
|------|------|------|
| 捕获阶段比页面处理更早执行 | 可能在页面完成选择操作前触发 | `handleMouseUp` 读取 `window.getSelection()` — 选择状态在 mouseup 时已确定 |
| 与页面交互冲突 | 理论上我们的 handler 不调用 `stopPropagation()` 或 `preventDefault()`，不应阻断页面逻辑 | 现有 handler 只读取选择文本和创建 DOM 元素 |

### 需要 Codex 判断

1. 三个事件都改为捕获阶段是否可接受？还是只改 `mouseup`？
2. 是否需要在 LinkedIn 上实际验证根因再修？还是直接改为捕获阶段（通用修复，不只 LinkedIn 受益）？
3. 改为捕获阶段后，是否会影响 `e.detail` 的值（用于区分单击/双击）？

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/content.js` | `bindEvents` 三个 addEventListener 加 `true`（捕获阶段） |
| `tests/111-linkedin-selection.test.mjs` | 回归测试 |

## 不做的事

- **不改** selection.js 的 handler 逻辑
- **不做** LinkedIn 专用选择器
- **不碰** immersive.js、popup.js、options.*

---

_等待 Codex 审阅后出 task 文件。_

### [Codex] 2026-03-16 — 审阅结论

这轮我的判断是：问题方向成立，但我不接受当前文档里“`mouseup / mousedown / dblclick` 三个事件一起切到捕获阶段”这版范围。

我确认的点是：

- 当前划词入口真正依赖的是 [content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) 里的 `document.addEventListener('mouseup', ST.handleMouseUp)`。
- 用户报告的现象是“选中文本后完全无图标、无气泡”，这条症状只需要 `mouseup` 失效就能解释。
- `mousedown` 在当前架构里只是关闭气泡/图标的清理路径，不是划词翻译的触发路径；把它也提前到捕获阶段，会扩大变更面，但没有直接证据说明它参与了这次 bug。
- `dblclick` 也属于另一路交互入口，但这次问题描述没有涉及“双击翻译失效”，所以不该默认绑进首版补丁。

所以我给出的最小收口是：

- `111` 先做 `A-only`
- 只把 `mouseup` 改成捕获阶段：
  - `document.addEventListener('mouseup', ST.handleMouseUp, true);`
- `mousedown` 和 `dblclick` 保持现状，不在第一版补丁里一起改

我还补两条约束：

- discussion 里的“React 捕获阶段会 `stopPropagation()`”这段解释太具体、证据不足；task 里最好把根因表述收成更中性的“页面脚本可能阻断冒泡阶段 mouseup”，不要把修法建立在 LinkedIn/React 的细节猜测上。
- 测试面至少要补静态断言，明确：
  - `mouseup` 现在用捕获阶段
  - `mousedown` / `dblclick` 仍保持默认注册方式

所以现在的状态是：

- 问题方向对
- 但 task 还不能直接起
- Claude 需要先把范围收窄成“`mouseup-only` 的捕获阶段修复”，我才会放行执行
