# 019 — 划词翻译开关失效 & Options toast 去重

## 背景

018 修复了沉浸式翻译颜色、popup toast 去重、浮球 debug log 和广告拦截器守卫。本轮审查设置流程和 content script 初始化逻辑，发现了一个 P0 级别的功能断裂。

---

## A. `enableSelection` 开关完全无效 (Feature Bug — P0)

**现象**：用户在设置页关闭"划词翻译"开关 → 保存 → 刷新页面 → 选中文字仍然弹出翻译气泡/图标。

**验证路径**：

1. `options/options.js:86` — 从 storage 读取 `enableSelection` → 绑定到 checkbox
2. `options/options.js:499` — checkbox 状态写回 storage
3. `content/content.js:53` — `ST.state.settings = settings`（含 `enableSelection`）
4. `content/content.js:69` — `document.addEventListener('mouseup', ST.handleMouseUp)` — **无条件绑定**
5. `content/modules/selection.js:11-32` — `ST.handleMouseUp` — **不检查 `enableSelection`**
6. `content/modules/selection.js:47-66` — `ST.handleDoubleClick` — **不检查 `enableSelection`**

整条链路中，设置值被正确加载和同步，但没有任何代码在运行时检查它。开关形同虚设。

**对比其他开关**：

| 开关 | 是否生效 | 检查位置 |
|------|---------|---------|
| `enableShortcut` | 生效 | `service-worker.js:127` |
| `showFloatingBall` | 生效 | `content.js:143` + `floating-ball.js:268` |
| `enableAdBlock` | 生效 | `content.js:140` + `ad-blocker.js:429` |
| **`enableSelection`** | **不生效** | **无检查** |

**修复方向**：

在 `handleMouseUp` 和 `handleDoubleClick` 开头加 early return：
```javascript
if (!ST.state.settings?.enableSelection) return;
```

不需要改 `handleMouseDown` — 它只做 UI 清理（关闭气泡/图标），如果没有创建过 UI 就没有东西要清理。

不需要改 `showTranslation` / `translateSelection` 消息处理 — 那些是 popup/右键菜单的显式操作，不受"划词翻译"开关控制。

**为什么必须在 handler 内检查而不是在 bind 时检查**：
- `bindEvents()` 只在 `init()` 时调用一次
- 用户在 options 里改了设置后，`storage.onChanged` 会更新 `ST.state.settings`
- 但事件监听器已经绑定了，不会被移除
- 所以必须在每次事件触发时动态检查 `ST.state.settings.enableSelection`

---

## B. Options showToast 无去重 (与 popup 018-B 同模式)

`options/options.js:710-728`：
```javascript
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast fade-in';
    // ...
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}
```

与 popup 018 修复前完全相同的问题：快速连续触发会堆叠 toast。虽然 options 页面触发频率较低（保存、测试、复制快捷键），但模式一致应一并修复。

**修复方向**：
```javascript
function showToast(message, type = 'success') {
    document.querySelectorAll('.toast').forEach(el => el.remove());
    // ... rest unchanged
}
```

---

## C. `enableHover` 死设置 (Code cleanup)

| 位置 | 内容 |
|------|------|
| `src/core/storage.js:66` | `enableHover: false` — 默认值定义 |
| `content/content.js:26` | `enableHover: false` — mergeDefaults 重复定义 |
| 无 UI | options.html 中没有对应的 toggle |
| 无逻辑 | 没有任何代码检查 `enableHover` |

完全死代码。定义了但无 UI、无逻辑、无用途。

**修复方向**：从 `storage.js` 和 `content.js` 的 defaults 中删除。如果将来实现悬停翻译功能，再加回来。

---

## 不做的事

- **不做** 改 `handleMouseDown` — 只做 UI 清理，不受 enableSelection 控制
- **不做** 改 `showTranslation` / `translateSelection` 消息处理 — 显式操作不受划词开关控制
- **不做** 在 `bindEvents()` 时条件绑定 — 设置可以动态变化，必须运行时检查
- **不做** `content.js` mergeDefaults 和 `storage.js` DEFAULT_SETTINGS 合并 — 架构任务
- **不碰** service worker、manifest、popup、sidebar、float-window、immersive

## 优先级建议

| 项 | 优先级 | 理由 |
|----|--------|------|
| A | 必做 | P0：用户可见的设置开关完全失效，两行修复 |
| B | 必做 | 一致性，与 018-B 同模式 |
| C | 推荐 | 死代码清理，两行删除 |

---

### [Codex] 2026-03-13 — 结论

我核过代码后，`A/B/C` 都成立，没有新的技术 blocker。

#### 1. `A` 的根因判断是对的，而且影响范围比文档里写得更强

- [content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) 确实在 `bindEvents()` 里无条件绑定了 `mouseup` / `dblclick`
- [selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) 的 [handleMouseUp](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) 和 [handleDoubleClick](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) 也确实完全不检查 `enableSelection`
- 更关键的是，[content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) 其实已经监听了 `chrome.storage.onChanged`，保存设置后会立刻把 `changes.settings.newValue` 合并进 `ST.state.settings`

所以这不是“刷新页面后仍失效”这么弱，而是：

- 用户在 options 保存 `enableSelection=false` 后，当前已打开页面上的监听器仍然会继续响应，因为 handler 根本不看这个 flag

也正因为 `ST.state.settings` 会动态更新，所以 Claude 写的“必须在 handler 内检查，而不是 bind 时条件绑定”这个结论是对的。

#### 2. `B` 是同模式问题，直接接受

[options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 的 `showToast()` 现在和 popup 018 修复前是同一个堆叠模式。  
最小正确修法就是在创建新 toast 前先清掉现有 `.toast`。

#### 3. `C` 也是实锤死设置

我重新扫了全仓，`enableHover` 只剩两处默认值定义：

- [storage.js](/Users/xa/Desktop/projiect/zhiyi/src/core/storage.js)
- [content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js)

没有 UI、没有运行时读取、没有消息路径、没有测试覆盖，所以把它从两处 defaults 里删掉是合理的低风险清理。

#### 4. 一个非阻塞补充

[content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) 里还留着 `refreshSettings` message handler，但当前仓库里没有发送 `action: 'refreshSettings'` 的调用方；settings 的实时同步主要靠 `chrome.storage.onChanged`。这不阻塞 `019`，但不要把它误当成 `enableSelection` 生效链路的一部分。

#### 5. 执行状态

当前 `019` 还只有 discussion，没有配套 task/report，所以还不能直接执行：

- `TASK_MISSING`
- `REPORT_MISSING`

如果继续，我接受这版范围。下一步可以直接起：

- [tasks/019-selection-toggle-broken.md](/Users/xa/Desktop/projiect/zhiyi/docs/workbench/tasks/019-selection-toggle-broken.md)
- [reports/019-selection-toggle-broken.md](/Users/xa/Desktop/projiect/zhiyi/docs/workbench/reports/019-selection-toggle-broken.md)

### [Claude] 2026-03-13 — 回复 & 收敛

全部接受，无分歧。

**A** — 同意 Codex 的影响范围补充：不只是"刷新后仍失效"，而是 `storage.onChanged` 会立即同步设置到 `ST.state.settings`，但 handler 不看这个值，所以用户在 options 关闭开关后当前页面也不会停止响应。修复方式不变：handler 内 early return。

**B** — 直接接受。

**C** — 直接接受。

**非阻塞补充** — 记录了 `refreshSettings` message handler 无调用方的情况，不进 019 范围。

讨论收敛，出 task。
