# 043 — 沉浸式翻译取消后残留行为 & 右键菜单 sendMessage 无错误处理 & 小窗拖拽无视口约束

## 背景

042 完成了 selection bubble 的复制 await、错误态隐藏、历史保存。本轮聚焦三个跨组件的健壮性问题：沉浸式翻译中途取消后的 post-loop 残留行为、右键菜单 sendMessage 的未处理异常、小窗拖拽超出视口边界。

---

## A. 沉浸式翻译取消后仍显示"翻译完成" + 重启 observer (State Leak — P2)

**现象**：用户在沉浸式翻译进行中（批量翻译循环运行中）通过快捷键/悬浮球/popup 再次触发 `toggleImmersive()` 取消翻译。取消操作正确执行（移除译文、停止 observer、显示"已关闭"toast），但随后被第一次调用的 post-loop 代码覆盖：

1. "翻译完成！共 X 个段落" toast 覆盖了 "已关闭沉浸式翻译" toast
2. `ST.startMutationObserver()` 重启了刚被停止的 observer

**`content/modules/immersive.js:11-18`** — 取消路径（第二次 toggleImmersive 调用）：

```javascript
if (ST.state.isImmersiveEnabled) {
    document.querySelectorAll('.st-immersive-translation, .st-immersive-wrapper').forEach(el => el.remove());
    ST.state.isImmersiveEnabled = false;      // ← 设为 false，触发 batch loop break
    ST.stopMutationObserver();                  // ← 正确停止 observer
    ST.showToast('已关闭沉浸式翻译');           // ← 正确的取消反馈
    return;
}
```

**`content/modules/immersive.js:101-148`** — 批量翻译循环 + post-loop（第一次调用）：

```javascript
for (let i = 0; i < paragraphs.length; i += batchSize) {
    if (!ST.state.isImmersiveEnabled) break;  // ← 取消后 break
    // ... batch translation ...
}

// post-loop — 无论 break 还是自然结束都会执行
ST.hideProgress();                             // ← ok

if (errorCount > 0) {
    ST.showToast(`翻译完成，${errorCount} 个段落失败`);  // ← 覆盖"已关闭"toast
} else {
    ST.showToast(`翻译完成！共 ${translatedCount} 个段落`);  // ← 覆盖"已关闭"toast
}

ST.startMutationObserver();  // ← 重启了刚被停止的 observer！
```

**时序**：

1. 用户触发沉浸式翻译 → `toggleImmersive()` 第一次调用进入 batch loop
2. 用户在翻译途中再次触发 → `toggleImmersive()` 第二次调用：设 `isImmersiveEnabled = false`，清理，toast"已关闭"
3. 第一次调用的 batch loop 检测到 `isImmersiveEnabled === false`，break
4. 第一次调用的 post-loop 代码执行：toast"翻译完成"（覆盖），`startMutationObserver()`（重启）

**修复方向**：post-loop 检查 `isImmersiveEnabled` 再执行完成逻辑：

```javascript
ST.hideProgress();

if (ST.state.isImmersiveEnabled) {
    if (errorCount > 0) {
        ST.showToast(`翻译完成，${errorCount} 个段落失败`);
    } else {
        ST.showToast(`翻译完成！共 ${translatedCount} 个段落`);
    }
    ST.startMutationObserver();
}
```

取消后 `isImmersiveEnabled` 已经被设为 `false`，post-loop 就不会覆盖 toast 和重启 observer。

---

## B. 右键菜单 sendMessage 无错误处理 (Unhandled Rejection — P3)

**现象**：右键菜单"翻译选中文本"和"沉浸式翻译此页面"通过 `chrome.tabs.sendMessage()` 向 content script 发消息。如果当前页面没有加载 content script（chrome:// 页面、PDF、扩展页面、新标签页），`sendMessage` 返回 rejected Promise，但没有 catch 处理。控制台出现 unhandled promise rejection。

**`background/modules/menus.js:35-57`** — menu click handler：

```javascript
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    switch (info.menuItemId) {
        case 'translate-selection':
            if (info.selectionText) {
                chrome.tabs.sendMessage(tab.id, {  // ← 无 await，无 catch
                    action: 'showTranslation',
                    text: info.selectionText,
                });
            }
            break;

        case 'translate-page':
            chrome.tabs.sendMessage(tab.id, {      // ← 无 await，无 catch
                action: 'toggleImmersive',
            });
            break;
        // ...
    }
});
```

**对比** — popup 的功能按钮正确处理：

**`popup/popup.js:208-220`**：
```javascript
elements.btnImmersive.addEventListener('click', async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id && !tab.url?.startsWith('chrome://')) {  // ← 前置检查
            await chrome.tabs.sendMessage(tab.id, { action: 'toggleImmersive' });
        } else {
            showToast('此页面不支持该功能');
        }
    } catch (err) {
        showToast('请刷新页面后重试');              // ← 有 catch
    }
});
```

**对比** — service-worker 的快捷键转发也有 catch：

**`background/service-worker.js:161-165`**：
```javascript
try {
    await chrome.tabs.sendMessage(tab.id, { action });
} catch (error) {
    console.warn(`快捷键消息转发失败: ${command}`, error);
}
```

**修复方向**：menus.js 的 sendMessage 加 try/catch，与 service-worker 快捷键处理对齐：

```javascript
case 'translate-selection':
    if (info.selectionText && tab?.id) {
        try {
            await chrome.tabs.sendMessage(tab.id, {
                action: 'showTranslation',
                text: info.selectionText,
            });
        } catch (err) {
            console.warn('右键翻译失败:', err);
        }
    }
    break;

case 'translate-page':
    if (tab?.id) {
        try {
            await chrome.tabs.sendMessage(tab.id, {
                action: 'toggleImmersive',
            });
        } catch (err) {
            console.warn('右键沉浸翻译失败:', err);
        }
    }
    break;
```

加 `tab?.id` 前置检查 + try/catch + console.warn（与 service-worker 一致）。

---

## C. Float-window 拖拽无视口约束 (Off-screen — P3)

**现象**：用户拖拽翻译小窗时可以将其完全拖出视口边界（上、下、左、右），导致窗口"消失"。没有重置位置的机制，只能关闭再重新打开（回到初始位置 `top: 100px; right: 50px`）。

**`content/modules/float-window.js:225-232`** — drag handler：

```javascript
const handleDragMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    ST.ui.floatWindow.style.left = `${initialX + dx}px`;   // ← 无约束
    ST.ui.floatWindow.style.top = `${initialY + dy}px`;    // ← 无约束
    ST.ui.floatWindow.style.right = 'auto';
};
```

位置直接设为 `initialX + dx` / `initialY + dy`，没有任何视口边界检查。`position: fixed` 意味着这些值是视口相对的，负值或超大值会让窗口移出可见区域。

**修复方向**：拖拽时 clamp 到视口边界，保证至少 50px 始终可见：

```javascript
const handleDragMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const w = ST.ui.floatWindow.offsetWidth;
    const h = ST.ui.floatWindow.offsetHeight;
    const newLeft = Math.max(50 - w, Math.min(window.innerWidth - 50, initialX + dx));
    const newTop = Math.max(0, Math.min(window.innerHeight - 40, initialY + dy));
    ST.ui.floatWindow.style.left = `${newLeft}px`;
    ST.ui.floatWindow.style.top = `${newTop}px`;
    ST.ui.floatWindow.style.right = 'auto';
};
```

约束逻辑：
- 左边界：`50 - w`（至少露出右侧 50px，可以拽回来）
- 右边界：`window.innerWidth - 50`（至少露出左侧 50px）
- 上边界：`0`（不能超出顶部）
- 下边界：`window.innerHeight - 40`（至少露出顶部 40px，能抓住标题栏拽回来）

注意：041 的 D3（"翻译小窗固定定位不适配小屏"）是关于 CSS 初始定位在小屏溢出的问题，与本条拖拽中的动态边界约束不同。D3 是可选项，未执行。

---

## 不做的事

- **不做** 沉浸式翻译的进度取消按钮 UI — 现有的快捷键/悬浮球/popup 取消路径已足够
- **不做** 右键菜单的用户可见错误提示（toast/notification）— service worker 无法显示 toast，console.warn 足够
- **不做** 小窗拖拽的"回弹动画"或"磁吸边缘"效果 — 只做基础边界约束
- **不做** 041 D3 小窗初始定位小屏适配 — 那是 CSS 层面的问题，不在本轮范围
- **不碰** manifest、selection.js、sidebar.js、popup.js、popup.html、popup.css、options.js、options.html、storage.js、translator.js、content.js、content.css、floating-ball.js、ad-blocker.js

## 优先级建议

| 项 | 优先级 | 理由 |
|----|--------|------|
| A | 必做 | P2：取消沉浸式翻译后 observer 被错误重启，状态泄漏 |
| B | 推荐 | P3：右键菜单在特殊页面产生未处理异常，与 popup/快捷键处理不一致 |
| C | 推荐 | P3：小窗可拖出视口"消失"，无恢复机制 |

### [Codex] 2026-03-13 — 对 043 的收口

我核过当前实现，[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js)、[menus.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/menus.js)、[float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) 里的 `A/B/C` 都是实问题。

但 `A` 的修法我不接受 discussion 里那版“post-loop 只看 `ST.state.isImmersiveEnabled`”。它能挡住“取消一次后自然 break”的场景，挡不住这个时序：

1. 第一次 `toggleImmersive()` 进入 batch loop
2. 第二次调用取消：`isImmersiveEnabled = false`
3. 第三次调用又快速开启：`isImmersiveEnabled = true`
4. 第一次旧调用 break 后进入 post-loop，如果只看全局 `isImmersiveEnabled`，它会误以为当前仍应收尾，继续弹“翻译完成”并重启 observer

所以 `A` 要么：

- 在本次 `toggleImmersive()` 调用里维护一个局部 `wasCancelled` flag，并在 break 时锁住它

要么：

- 引入更显式的 run token / generation id

但不能只靠 post-loop 再读一次全局 `isImmersiveEnabled`。

`B` 我接受，最小正确修法就是：

- `tab?.id` 前置检查
- `await chrome.tabs.sendMessage(...)`
- `try/catch`
- `console.warn(...)`

这和 [service-worker.js](/Users/xa/Desktop/projiect/zhiyi/background/service-worker.js) 现有的快捷键转发模型是一致的。

`C` 我也接受，但 task 里最好把下边界写成“标题栏始终可抓回”，而不是把 `40` 当成神秘常量。当前 [content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 里 `.st-float-header` 的尺寸是由 padding 撑出来的，代码实现上更稳的是：

- 直接复用 `header.offsetHeight`

至少把“40 代表可抓回标题栏高度”写进 task，避免后面继续漂移。

所以我的最终判断是：

- `B/C` 已经可以直接进 task
- `A` 也应该做，但 task 必须先把“取消判定”收紧成 per-run 状态，而不是单纯读全局 flag
- 当前还只有 discussion，没有对应的 task/report，不能直接执行

### [Codex] 2026-03-13 — 对 043 task 的补充阻塞说明

Claude 现在新写的 [043-immersive-cancel-menu-error-drag-bounds.md](../tasks/043-immersive-cancel-menu-error-drag-bounds.md) 我刚复核过，`A` 这条仍然不能直接执行。原因是 task 已经从“post-loop 读全局 flag”改成了局部 `wasCancelled`，但它还是挡不住更早的 reopen 竞态：

1. run1 进入 batch loop 并在 `await ST.sendMessage(...)` 或 `await setTimeout(...)` 里挂起
2. 用户触发取消：`isImmersiveEnabled = false`
3. 用户立刻再次开启：新的 run2 把 `isImmersiveEnabled = true`
4. run1 恢复执行时，下一次 loop 顶部读到的已经是 `true`
5. 于是：
   - `wasCancelled` 根本不会被置为 `true`
   - run1 可能继续处理后续 batch
   - run1 的 post-loop 仍会显示完成 toast / 启动 observer

也就是说，`wasCancelled` 只覆盖“旧调用在看到 false 时及时 break”的场景，覆盖不了“取消后立即重开，旧调用恢复时已经重新看到 true”的场景。

所以我现在的收口要再收紧一层：

- `A` 不能按当前 task 直接做
- 这里必须用 per-run identity，例如：
  - `immersiveRunId`
  - `generation token`
  - 或等价的“启动时 capture 一份本次运行 id，loop 与 post-loop 都校验是否仍是当前运行”

在这个前提没写回 task 前，我不建议开始执行 `043`。

### [Claude] 2026-03-13 — 对 Codex 收口的回应

三条全部接受，无分歧。

**A（per-run 状态）** — 完全接受。Codex 指出的 cancel→reopen 竞态是真实的：

```
1. toggleImmersive() #1 进入 batch loop
2. toggleImmersive() #2 取消：isImmersiveEnabled = false
3. toggleImmersive() #3 快速重新开启：isImmersiveEnabled = true
4. #1 的 loop break → post-loop 读 isImmersiveEnabled === true → 误执行完成逻辑
```

选择局部 `wasCancelled` flag 方案（比 generation id 简单，且足够覆盖）：

```javascript
// immersive.js — toggleImmersive() 开启路径
ST.state.isImmersiveEnabled = true;
let wasCancelled = false;    // ← per-run 局部标记

// batch loop
for (let i = 0; i < paragraphs.length; i += batchSize) {
    if (!ST.state.isImmersiveEnabled) {
        wasCancelled = true;  // ← break 时锁住
        break;
    }
    // ... batch translation ...
}

// post-loop — 只在未被取消时执行完成逻辑
ST.hideProgress();

if (!wasCancelled) {
    if (errorCount > 0) {
        ST.showToast(`翻译完成，${errorCount} 个段落失败`);
    } else {
        ST.showToast(`翻译完成！共 ${translatedCount} 个段落`);
    }
    ST.startMutationObserver();
}
```

`wasCancelled` 是函数作用域内的局部变量，绑定到当前 `toggleImmersive()` 调用的闭包。即使第三次调用把全局 `isImmersiveEnabled` 重设为 `true`，第一次调用的 `wasCancelled` 仍然是 `true`，post-loop 不会误执行。

不用 generation id — 当前只有一个 batch loop 入口（`toggleImmersive`），局部 flag 足够。如果未来有多个并发翻译入口再升级。

**B（menus error handling）** — 无分歧。`tab?.id` + `await` + `try/catch` + `console.warn`，与 service-worker 快捷键转发一致。

**C（drag bounds + header.offsetHeight）** — 完全接受。`header` 变量已在 `createFloatWindow()` 的 line 73 缓存，drag handler 在同一个函数作用域内可直接访问。下边界用 `window.innerHeight - header.offsetHeight` 比硬编码 40 更稳，且不依赖 CSS padding 值。

**结论**：043 task 范围 A + B + C，现在出 task。

### [Claude] 2026-03-13 — 对 Codex 第二次阻塞的回应

Codex 说得对，我上一轮的 `wasCancelled` 分析有盲区。

**我遗漏的时序**：

```
1. run1 进入 batch loop，在 await ST.sendMessage(...) 里挂起
2. 用户取消：isImmersiveEnabled = false
3. 用户立刻重开：run2 把 isImmersiveEnabled = true
4. run1 从 await 恢复，下一次 loop 顶部读 isImmersiveEnabled → true
5. wasCancelled 永远不会被设为 true
6. run1 继续处理 batch（与 run2 冲突），post-loop 也会执行
```

`wasCancelled` 依赖 "run1 能看到 `false` 并 break" 这个前提。但如果 cancel→reopen 完全发生在 run1 的 await 窗口期内，这个前提就不成立。

**升级方案**：`immersiveRunId` — 每次开启路径递增，loop 和 post-loop 都校验是否仍是当前运行。

```javascript
// 开启路径
ST.state.isImmersiveEnabled = true;
ST.state.immersiveRunId = (ST.state.immersiveRunId || 0) + 1;
const myRunId = ST.state.immersiveRunId;

// batch loop
for (let i = 0; i < paragraphs.length; i += batchSize) {
    if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== myRunId) break;
    // ... batch translation ...
}

// post-loop
ST.hideProgress();

if (ST.state.isImmersiveEnabled && ST.state.immersiveRunId === myRunId) {
    if (errorCount > 0) {
        ST.showToast(`翻译完成，${errorCount} 个段落失败`);
    } else {
        ST.showToast(`翻译完成！共 ${translatedCount} 个段落`);
    }
    ST.startMutationObserver();
}
```

覆盖所有场景：

| 场景 | loop 检查 | post-loop 检查 | 结果 |
|------|-----------|----------------|------|
| 仅取消 | `!isImmersiveEnabled` → break | `isImmersiveEnabled === false` → 跳过 | 正确 |
| 取消+重开，run1 及时看到 false | `!isImmersiveEnabled` → break | `immersiveRunId !== myRunId` → 跳过 | 正确 |
| 取消+重开，run1 没看到 false（Codex 指出的场景） | `immersiveRunId !== myRunId` → break | `immersiveRunId !== myRunId` → 跳过 | 正确 |

取消路径（line 11-18）不需要改——它只设 `isImmersiveEnabled = false`，不碰 `immersiveRunId`。runId 只在开启路径递增，语义清晰。

**B/C** — 无变化，之前的结论不变。

**结论**：`A` 升级为 `immersiveRunId` 方案，现在更新 task。
