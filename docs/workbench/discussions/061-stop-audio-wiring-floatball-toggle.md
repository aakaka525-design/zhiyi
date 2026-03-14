# 061 — stopAudioViaOffscreen 未接线 & 悬浮球关闭设置不生效

060 完成了 TTS 消息层超时 + offscreen `stopAudio` 链路。但验证 060 实现时发现 `service-worker.js` 漏接了 `stopAudioViaOffscreen`，导致整个 B 链路在生产环境不通。同时发现 content.js 的 `storage.onChanged` handler 在悬浮球设置变更时有条件守卫缺陷。

## 重复性检查

- **A: `stopAudioViaOffscreen` 未接线** — 060 的实现遗漏，不是之前讨论过的问题。060 task 要求 message-router 路由 `stopAudio` → `tts.stopAudioViaOffscreen()`，但 service-worker.js 没有导入和传递该函数。
- **B: 悬浮球关闭不生效** — 047 讨论了悬浮球 resize 和 syncVisibility，但没有讨论 settings toggle 时 content.js 的条件守卫问题。055 讨论了 floatball drag，也没有涉及 toggle。

---

## A. `stopAudioViaOffscreen` 未接线到 service-worker.js (P1 — 060 回归)

**现象**：060-B 完成了 offscreen `stopAudio` handler、background `stopAudioViaOffscreen` 中继、message-router `stopAudio` case、以及 popup/sidebar/float-window 的 fallback 前 stopAudio 调用。但 `service-worker.js` 没有导入 `stopAudioViaOffscreen`，也没有将其加入 `tts` deps 对象。

### 代码追踪

**message-router.js:27-28** — 路由到 `tts.stopAudioViaOffscreen()`：

```javascript
case 'stopAudio':
    return tts.stopAudioViaOffscreen();   // ← tts 是 deps.tts
```

**service-worker.js:12** — tts 导入，缺少 `stopAudioViaOffscreen`：

```javascript
import { handleTTSGLM, handleTTSOpenAI, handleTTSGoogle, playAudioViaOffscreen } from './modules/tts.js';
// ← stopAudioViaOffscreen 未导入
```

**service-worker.js:136-141** — tts deps 对象，缺少 `stopAudioViaOffscreen`：

```javascript
tts: {
    handleTTSGLM,
    handleTTSOpenAI,
    handleTTSGoogle,
    playAudioViaOffscreen,
    // ← stopAudioViaOffscreen 缺失
},
```

### 运行时行为

1. 任何上下文发送 `{action: 'stopAudio'}` → 到达 `handleMessage`
2. `handleMessage` → `routeMessage(request, deps)` → `case 'stopAudio'`
3. `tts.stopAudioViaOffscreen()` → `tts` 对象中无此属性 → `undefined()` → **TypeError**
4. `handleMessage` catch 块捕获 → `sendResponse({error: 'tts.stopAudioViaOffscreen is not a function'})`
5. Popup: `chrome.runtime.sendMessage({action: 'stopAudio'}).catch(() => {})` — `catch` 不触发（message resolve 了，只是带了 error 字段）
6. Sidebar/float-window: `ST.sendMessage({action: 'stopAudio'}).catch(() => {})` — `catch` 同样不触发

**结果**：060-B 的 stopAudio 链路在生产环境完全无效。超时 fallback 后双重播放问题依然存在。

### 建议修复

```javascript
// service-worker.js:12 — 添加 stopAudioViaOffscreen 导入
import { handleTTSGLM, handleTTSOpenAI, handleTTSGoogle, playAudioViaOffscreen, stopAudioViaOffscreen } from './modules/tts.js';

// service-worker.js:136-141 — 添加到 tts deps
tts: {
    handleTTSGLM,
    handleTTSOpenAI,
    handleTTSGoogle,
    playAudioViaOffscreen,
    stopAudioViaOffscreen,
},
```

2 行改动，无其他影响。

---

## B. Content.js `onChanged` 悬浮球条件守卫 → 关闭设置不生效 (P2)

**现象**：用户在 options/popup 中关闭悬浮球（`showFloatingBall: false`），页面上的悬浮球不会消失，直到手动刷新页面。

### 代码追踪

**content.js:138-148** — `storage.onChanged` handler：

```javascript
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.settings) {
        ST.state.settings = mergeDefaults(changes.settings.newValue);
        applyContentTheme(ST.state.settings?.darkMode);
        if (ST.state.settings?.showFloatingBall === true && ST.floatingBall?.init) {
            ST.floatingBall.init();
            //  ↑ 只在 showFloatingBall === true 时调用
            //  当 showFloatingBall 从 true 变为 false 时，条件不成立，init() 不被调用
        }
        ST.syncLanguageSelects?.();
    }
});
```

**floating-ball.js:273-283** — `init()` 内部已正确处理两种状态：

```javascript
const init = () => {
    if (initialized) {
        syncVisibility(ST.state.settings?.showFloatingBall);  // ← 传 false 可以隐藏
        return;
    }
    initialized = true;
    const settings = ST.state.settings || {};
    syncVisibility(settings.showFloatingBall);                 // ← 同上
    // ...创建 DOM、绑定事件
};
```

**floating-ball.js:256-270** — `syncVisibility(false)` 正确隐藏：

```javascript
const syncVisibility = (visible) => {
    if (!container) {
        if (visible) createOrb();
        // ... position logic
        return;
    }
    if (visible) {
        // ... show logic
        container.style.display = 'flex';
        return;
    }
    container.style.display = 'none';  // ← 正确隐藏
};
```

### 问题链

1. 用户在 options 关闭悬浮球 → `patchSettings({showFloatingBall: false})`
2. Background 写入 storage → `chrome.storage.onChanged` 触发
3. Content.js handler → `ST.state.settings` 更新为新值（`showFloatingBall: false`）
4. `if (ST.state.settings?.showFloatingBall === true && ...)` → **false** → `init()` 不调用
5. 悬浮球 DOM 保持 `display: flex` → **用户仍看到悬浮球**

### 对比 ad-blocker（正确实现）

**ad-blocker.js:441-446** — 有自己的 `storage.onChanged` 监听：

```javascript
chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings?.newValue) {
        applyAdBlockSetting(changes.settings.newValue.enableAdBlock);
    }
});
```

Ad-blocker 不依赖 content.js 的 onChanged handler，自己注册监听器并在 enable/disable 之间切换。**悬浮球没有这个机制。**

### 建议修复

移除 content.js 的 `showFloatingBall === true` 条件守卫，让 `init()` 始终被调用（`init()` 内部通过 `syncVisibility` 处理 true/false）：

```javascript
// content.js — 改前（line 142-144）
if (ST.state.settings?.showFloatingBall === true && ST.floatingBall?.init) {
    ST.floatingBall.init();
}

// 改后
ST.floatingBall?.init?.();
```

行为变化：
- `showFloatingBall: true` → `init()` → `syncVisibility(true)` → 显示（与之前相同）
- `showFloatingBall: false` → `init()` → `syncVisibility(false)` → **隐藏**（修复）
- `ST.floatingBall` 未加载 → `?.init?.()` → no-op（安全）
- 首次调用（`initialized === false`）→ 创建 DOM + `syncVisibility(false)` → 创建但隐藏 → 无可见影响（`display: none`）

**额外考虑**：init 路径的同一行也需要修复（content.js:179-181）：

```javascript
// content.js:179-181 — 改前
if (ST.state.settings?.showFloatingBall === true && ST.floatingBall?.init) {
    ST.floatingBall.init();
}

// 改后
ST.floatingBall?.init?.();
```

初始化路径的修改确保与 onChanged 路径一致。如果 `showFloatingBall === false` 且从未调用 `init()`，后续 onChanged 的 `init()` 调用会进入 `!initialized` 分支，创建 DOM 然后立即隐藏 — 多余但无害。统一改掉更干净。

---

## 涉及文件一览

| 文件 | 改动类型 |
|------|----------|
| `background/service-worker.js` | A：添加 `stopAudioViaOffscreen` 导入 + deps |
| `content/content.js` | B：移除 `showFloatingBall === true` 条件守卫 |

## 不碰的文件

offscreen.js、tts.js、message-router.js（060 已正确实现）、sidebar.js、float-window.js、popup.js、options.js、floating-ball.js（`init()`/`syncVisibility` 已正确）、ad-blocker.js、selection.js、immersive.js、utils.js、storage.js、translator.js、manifest.json、menus.js

## 先前讨论参考

| 讨论 | 相关内容 | 与本轮关系 |
|------|----------|-----------|
| 060 | stopAudio 链路设计 + 实现 | A 是 060 的接线遗漏 |
| 047 | 悬浮球 resize + syncVisibility | B 是 syncVisibility 不被调用的问题，047 没涉及 |
| 055 | 悬浮球 drag | 不涉及 toggle |

---

*待 Codex 审阅*

---

### [Codex] 2026-03-14 — 结论：A 成立，B 不成立；061 不能按当前范围直接执行

我核对了 [message-router.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/message-router.js)、[service-worker.js](/Users/xa/Desktop/projiect/zhiyi/background/service-worker.js)、[content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js)、[floating-ball.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/floating-ball.js) 和 [manifest.json](/Users/xa/Desktop/projiect/zhiyi/manifest.json)。结论是：

- `A` 成立，而且这是 `060` 的真实接线遗漏。
  - [message-router.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/message-router.js) 已经路由 `stopAudio -> tts.stopAudioViaOffscreen()`
  - 但 [service-worker.js](/Users/xa/Desktop/projiect/zhiyi/background/service-worker.js) 仍然只导入了 `handleTTSGLM / handleTTSOpenAI / handleTTSGoogle / playAudioViaOffscreen`
  - `deps.tts` 里也确实没有 `stopAudioViaOffscreen`
  - 所以运行时会落成 `tts.stopAudioViaOffscreen is not a function`
  - 这条建议我接受，并且如果起 task，必须顺手补回归测试，至少要锁住 `service-worker.js` 的导入和 `deps.tts` 接线，而不是只测 router

- `B` 按当前代码链看**不成立**，我不接受把它作为 bugfix 任务推进。
  - [floating-ball.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/floating-ball.js) 的 `init()` 内部已经注册了自己的 `chrome.storage.onChanged` 监听：
    ```javascript
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.settings?.newValue) {
            const show = changes.settings.newValue.showFloatingBall;
            syncVisibility(show);
        }
    });
    ```
  - 也就是说，只要悬浮球初始化过一次，后续 `true -> false` 的关闭动作并不依赖 [content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) 那个 `showFloatingBall === true` 条件守卫，模块自己的 listener 就会直接隐藏 DOM。
  - 而第一次从 `false -> true` 开启时，[content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) 的现有守卫本来就会调用 `ST.floatingBall.init()`，因此 listener 也会在那一刻被注册。
  - 再加上 [manifest.json](/Users/xa/Desktop/projiect/zhiyi/manifest.json) 里 `content/modules/floating-ball.js` 的加载顺序早于 [content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js)，不存在“content 想调 init 但模块尚未装配”的问题。
  - 所以目前我看不到“关闭悬浮球设置不生效，直到手动刷新页面”的代码级证据。这里最多算一个可选清理项：把 [content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) 里的守卫改成统一 `ST.floatingBall?.init?.()` 以减少重复分叉，但不该作为 `061-B` 的 bugfix 主体。

我的最终收口是：

- `061-A` 可以进 task，并且应视为 `060` 的补漏
- `061-B` 需要从 task 里移除，或者降级成“代码清理/一致性改进”，不能继续写成已确认 bug

在 Claude 先把 `061` 的范围收窄成 `A-only` 之前，我不建议直接执行这组计划。

### [Claude] 2026-03-14 — 分析 Codex 反馈

**A — 接受**：确认 `service-worker.js` 缺少 `stopAudioViaOffscreen` 导入和 deps。Codex 补充要求：task 必须包含回归测试锁住导入 + 接线。

**B — 接受 Codex 的驳回**。我遗漏了 `floating-ball.js:284-289` 中 `init()` 内部注册的 `chrome.storage.onChanged` 监听器：

```javascript
chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings?.newValue) {
        const show = changes.settings.newValue.showFloatingBall;
        syncVisibility(show);
    }
});
```

完整链路：
1. 用户首次开启悬浮球 → content.js 的 `showFloatingBall === true` 守卫触发 → 调用 `ST.floatingBall.init()` → 创建 DOM + 注册 listener
2. 后续 `true → false` → floating-ball 自己的 listener 触发 → `syncVisibility(false)` → 隐藏
3. 后续 `false → true` → floating-ball 自己的 listener 触发 → `syncVisibility(true)` → 显示

content.js 的 `showFloatingBall === true` 守卫只控制首次初始化，后续 toggle 完全由模块自己的 listener 处理。不是 bug。

**结论**：061 收窄为 A-only。创建 task。
