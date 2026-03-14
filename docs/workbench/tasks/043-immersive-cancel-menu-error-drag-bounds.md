---
status: done
priority: P2
created: 2026-03-13
---

# 043 — 沉浸式翻译取消后残留行为 & 右键菜单 sendMessage 无错误处理 & 小窗拖拽无视口约束

- 来源讨论: [discussions/043-immersive-cancel-menu-error-drag-bounds.md](../discussions/043-immersive-cancel-menu-error-drag-bounds.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/043-immersive-cancel-menu-error-drag-bounds.md](../discussions/043-immersive-cancel-menu-error-drag-bounds.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | A：per-run immersiveRunId + loop/post-loop 校验 |
| `background/modules/menus.js` | B：sendMessage 加 await + try/catch |
| `content/modules/float-window.js` | C：drag handler 加视口边界约束 |
| `tests/immersive-menu-drag.test.mjs` | A + B + C |

## 任务清单

### 必做

#### A. 沉浸式翻译取消后残留行为（per-run immersiveRunId）

取消沉浸式翻译后，第一次调用的 post-loop 仍会显示"翻译完成" toast 并重启 observer。

**不能用局部 `wasCancelled` flag** — 存在 cancel→reopen 竞态：run1 在 await 里挂起时，cancel + reopen 把 `isImmersiveEnabled` 先设 false 再设 true，run1 恢复后在 loop 顶部读到 `true`，`wasCancelled` 永远不会被触发。

**必须用 `immersiveRunId`**：每次开启路径递增全局 runId，本次调用 capture 到局部 `myRunId`，loop 和 post-loop 都校验 `ST.state.immersiveRunId === myRunId`。

- [x] `content/modules/immersive.js` — `toggleImmersive()` 开启路径（当前 line 21），在 `isImmersiveEnabled = true` 之后递增 runId 并 capture：
  ```javascript
  // 改前（line 21-22）
  ST.state.isImmersiveEnabled = true;
  ST.showToast('正在启动沉浸式翻译...');

  // 改后
  ST.state.isImmersiveEnabled = true;
  ST.state.immersiveRunId = (ST.state.immersiveRunId || 0) + 1;
  const myRunId = ST.state.immersiveRunId;
  ST.showToast('正在启动沉浸式翻译...');
  ```

- [x] `content/modules/immersive.js` — batch loop 顶部（当前 line 101-102），加 runId 校验：
  ```javascript
  // 改前（line 101-102）
  for (let i = 0; i < paragraphs.length; i += batchSize) {
      if (!ST.state.isImmersiveEnabled) break;

  // 改后
  for (let i = 0; i < paragraphs.length; i += batchSize) {
      if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== myRunId) break;
  ```

- [x] `content/modules/immersive.js` — post-loop（当前 line 139-147），用双重校验包裹完成逻辑：
  ```javascript
  // 改前（line 139-147）
  ST.hideProgress();

  if (errorCount > 0) {
      ST.showToast(`翻译完成，${errorCount} 个段落失败`);
  } else {
      ST.showToast(`翻译完成！共 ${translatedCount} 个段落`);
  }

  ST.startMutationObserver();

  // 改后
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

  覆盖矩阵：

  | 场景 | loop 检查 | post-loop 检查 | 结果 |
  |------|-----------|----------------|------|
  | 仅取消 | `!isImmersiveEnabled` → break | `isImmersiveEnabled === false` → 跳过 | 正确 |
  | 取消+重开，run1 及时看到 false | `!isImmersiveEnabled` → break | `runId !== myRunId` → 跳过 | 正确 |
  | 取消+重开，run1 在 await 中没看到 false | `runId !== myRunId` → break | `runId !== myRunId` → 跳过 | 正确 |

**不要做的事**：
- 不要用局部 `wasCancelled` flag 代替 `immersiveRunId` — wasCancelled 覆盖不了 cancel→reopen 竞态
- 不要用全局 `isImmersiveEnabled` 单独做 post-loop 判断
- 不要改取消路径（line 11-18）的逻辑 — 取消路径不碰 `immersiveRunId`
- 不要改 `startMutationObserver` / `stopMutationObserver` 的实现
- 不要在 `hideProgress()` 上加条件 — 无论取消还是完成都应该隐藏进度条
- 不要用 `Symbol()` 或 `Date.now()` 或 `crypto.randomUUID()` — 简单递增整数足够

### 推荐

#### B. 右键菜单 sendMessage 加错误处理

右键菜单的 `chrome.tabs.sendMessage()` 无 await、无 catch。在 chrome:// 页面、PDF、扩展页面会产生 unhandled rejection。

- [x] `background/modules/menus.js` — `translate-selection` case（当前 line 37-44），加 `tab?.id` 前置检查 + await + try/catch：
  ```javascript
  // 改前（line 37-44）
  case 'translate-selection':
      if (info.selectionText) {
          chrome.tabs.sendMessage(tab.id, {
              action: 'showTranslation',
              text: info.selectionText,
          });
      }
      break;

  // 改后
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
  ```

- [x] `background/modules/menus.js` — `translate-page` case（当前 line 47-51），同样加保护：
  ```javascript
  // 改前（line 47-51）
  case 'translate-page':
      chrome.tabs.sendMessage(tab.id, {
          action: 'toggleImmersive',
      });
      break;

  // 改后
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

**不要做的事**：
- 不要给 catch 加用户可见提示（toast / notification）— service worker 无法显示 toast，console.warn 足够
- 不要改 `open-settings` case — `chrome.runtime.openOptionsPage()` 不需要 tab
- 不要改 `createContextMenus()` 函数
- 不要改 listener 的 `async` 签名（已经是 async）

### 推荐

#### C. Float-window 拖拽视口边界约束

拖拽小窗可完全移出视口"消失"，无恢复机制。加 clamp 约束，保证标题栏始终可抓回。

- [x] `content/modules/float-window.js` — `handleDragMove`（当前 line 225-232），加视口 clamp：
  ```javascript
  // 改前（line 225-232）
  const handleDragMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      ST.ui.floatWindow.style.left = `${initialX + dx}px`;
      ST.ui.floatWindow.style.top = `${initialY + dy}px`;
      ST.ui.floatWindow.style.right = 'auto';
  };

  // 改后
  const handleDragMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const w = ST.ui.floatWindow.offsetWidth;
      const minVisible = 50;
      const newLeft = Math.max(minVisible - w, Math.min(window.innerWidth - minVisible, initialX + dx));
      const newTop = Math.max(0, Math.min(window.innerHeight - header.offsetHeight, initialY + dy));
      ST.ui.floatWindow.style.left = `${newLeft}px`;
      ST.ui.floatWindow.style.top = `${newTop}px`;
      ST.ui.floatWindow.style.right = 'auto';
  };
  ```

  约束逻辑：
  - 左边界：`minVisible - w`（至少露出右侧 50px，可以拽回来）
  - 右边界：`window.innerWidth - minVisible`（至少露出左侧 50px）
  - 上边界：`0`（不能超出顶部）
  - 下边界：`window.innerHeight - header.offsetHeight`（标题栏始终可见可抓回）

  `header` 变量已在 `createFloatWindow()` 的 line 73 缓存（`const header = ST.ui.floatWindow.querySelector('.st-float-header');`），drag handler 在同一函数作用域内可直接访问。`header.offsetHeight` 动态取值，不依赖 CSS padding 硬编码。

**不要做的事**：
- 不要用硬编码的 `40` 作为下边界 — 用 `header.offsetHeight` 动态取值
- 不要加回弹动画或磁吸边缘效果 — 只做基础边界约束
- 不要改初始定位（CSS `top: 100px; right: 50px`）— 那是 041-D3 的范围
- 不要改 `handleDragEnd` 或 `header.onmousedown`
- 不要改 `position: fixed` 或 z-index

## 不做的事

- **不做** 沉浸式翻译的进度取消按钮 UI — 现有的快捷键/悬浮球/popup 取消路径已足够
- **不做** `wasCancelled` 局部 flag — 已被 `immersiveRunId` 替代（wasCancelled 无法覆盖 cancel→reopen 竞态）
- **不做** 右键菜单的用户可见错误提示 — service worker 无法显示 toast
- **不做** 小窗拖拽回弹动画 / 磁吸边缘
- **不做** 041-D3 小窗初始定位小屏适配
- **不碰** manifest、selection.js、sidebar.js、popup.js、popup.html、popup.css、options.js、options.html、storage.js、translator.js、content.js、content.css、floating-ball.js、ad-blocker.js、service-worker.js、message-router.js

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check content/modules/immersive.js` 通过
- [x] `node --check background/modules/menus.js` 通过
- [x] `node --check content/modules/float-window.js` 通过
- [x] `git diff --check` 无输出
