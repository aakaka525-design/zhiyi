# 054 — TTS 双重倍速 & 右键菜单受限 URL 静默失败

## A. TTS API 朗读倍速叠加（popup + options）

### 现象

用户在设置页将语速调整到 1.5x，选择 OpenAI/Google/GLM 任意 API TTS 提供商，点击试听或在 popup 中朗读 — 实际播放速度是 2.25x（1.5²），明显快于预期。

### 根因

语速参数被**两次应用**：一次在 API 音频生成阶段，一次在 offscreen 播放阶段。

**数据流**：

```
caller (popup/options)
  → requestTtsAudio(provider, text, lang, settings, speed)
      → chrome.runtime.sendMessage({ action: 'ttsOpenAI', speed })
          → background/tts.js: body.speed = speed  ← 第一次应用（音频已含倍速）
  → chrome.runtime.sendMessage({ action: 'playAudioOffscreen', audioData, speed })
      → message-router → tts.playAudioViaOffscreen(audioData, speed)
          → offscreen.js: audio.playbackRate = speed  ← 第二次应用（播放再加速）
```

**有效倍速 = speed × speed = speed²**

### 证据

**popup/popup.js:436-441** — speed 同时传给生成和播放：
```javascript
const audioData = await requestTtsAudio(provider, text, lang, settings, speed);
const response = await chrome.runtime.sendMessage({
    action: 'playAudioOffscreen',
    audioData,
    speed,   // ← BUG: 音频已含倍速，播放再乘一次
});
```

**options/options.js:349-361** — 同样问题：
```javascript
const audioData = await withTimeout(
    requestTtsTestAudio(provider, testText, speed),  // speed 传给 API
    15000, 'TTS 请求超时',
);
const playbackResponse = await withTimeout(
    chrome.runtime.sendMessage({
        action: 'playAudioOffscreen',
        audioData,
        speed,   // ← BUG: 同上
    }),
    15000, '播放超时',
);
```

**background/modules/tts.js** — 三个 handler 均在生成时应用 speed：
- `handleTTSOpenAI` line 101: `body.speed = speed || 1.0`
- `handleTTSGoogle` line 140: `audioConfig.speakingRate = speed || 1.0`
- `handleTTSGLM` line 62: `body.speed = speed`

**offscreen/offscreen.js:22** — 播放时再次应用：
```javascript
audio.playbackRate = speed;
```

### 对照组

sidebar.js 和 float-window.js **不传** speed 给 offscreen，只传给 API — 它们是正确的：

**content/modules/sidebar.js:183-190**：
```javascript
const playAudioFromDataUrl = async (dataUrl, speed = 1.0) => {
    const result = await ST.sendMessage({
        action: 'playAudioOffscreen',
        audioData: dataUrl,
        speed    // default 1.0 — 不传调用 → 播放不加速
    });
};
// 调用: await playAudioFromDataUrl(response.audioData)  ← 不传 speed
```

**content/modules/float-window.js:103-110**：
```javascript
const playAudio = async (dataUrl, playbackSpeed = 1.0) => { ... };
// 调用: await playAudio(response.audioData)  ← 不传 speed
```

### 建议修复

**popup/popup.js** — 去掉 `playAudioOffscreen` 消息中的 `speed`（line 440）：
```javascript
// 改前
const response = await chrome.runtime.sendMessage({
    action: 'playAudioOffscreen',
    audioData,
    speed,
});

// 改后
const response = await chrome.runtime.sendMessage({
    action: 'playAudioOffscreen',
    audioData,
});
```

**options/options.js** — 去掉 `playAudioOffscreen` 消息中的 `speed`（line 360）：
```javascript
// 改前
chrome.runtime.sendMessage({
    action: 'playAudioOffscreen',
    audioData,
    speed,
}),

// 改后
chrome.runtime.sendMessage({
    action: 'playAudioOffscreen',
    audioData,
}),
```

行为结果：
- API TTS: speed 仅在生成阶段应用一次 → offscreen 以 1.0x 播放 → 有效倍速 = speed × 1
- System TTS 回退: `utterance.rate = speed` 一次 → 不经过 offscreen → 不受影响
- sidebar / float-window: 已经是正确模式 → 不变

**不要改的**：
- 不要改 `offscreen.js` — `playbackRate` 参数保留，system TTS 场景可能需要
- 不要改 `background/modules/tts.js` — API 生成阶段传 speed 是正确的
- 不要改 `tts.playAudioViaOffscreen` — 它只是透传，语义正确
- 不要改 `message-router.js` — 路由逻辑正确
- 不要改 sidebar.js、float-window.js — 它们是正确的

---

## B. 右键菜单在受限 URL 静默失败

### 现象

在 `chrome://settings`、`chrome://extensions`、`about:blank`、Chrome Web Store 等受限页面右键选中文本 → 菜单项"翻译选中文本"/"沉浸式翻译此页面"照常显示 → 点击后无任何反应（控制台静默吞掉错误）。用户误以为扩展坏了。

### 根因

`background/modules/menus.js` 创建右键菜单时没有设置 `documentUrlPatterns`，Chrome 默认在所有页面显示菜单项。但受限页面无法注入 content script，`tabs.sendMessage` 抛异常被 catch 吞掉。

### 证据

**background/modules/menus.js:5-16** — 无 `documentUrlPatterns`：
```javascript
chrome.contextMenus.create({
    id: 'translate-selection',
    title: '翻译选中文本',
    contexts: ['selection'],
    // 缺少 documentUrlPatterns → 在所有页面显示
});

chrome.contextMenus.create({
    id: 'translate-page',
    title: '沉浸式翻译此页面',
    contexts: ['page'],
    // 缺少 documentUrlPatterns → 在所有页面显示
});
```

**menus.js:44-47** — 错误被静默吞掉：
```javascript
} catch (err) {
    console.warn('右键翻译失败:', err);  // 用户看不到
}
```

050-B 在 popup.js 中已用 `isSupportedPageUrl` + toast 解决了类似问题。右键菜单场景更简单 — 直接用 Chrome API 级别的 `documentUrlPatterns` 过滤，菜单项在受限页面根本不显示。

### 建议修复

**background/modules/menus.js** — 给 `translate-selection`、`translate-page`、分隔线和设置项都加 `documentUrlPatterns`：

```javascript
// 改前
chrome.contextMenus.create({
    id: 'translate-selection',
    title: '翻译选中文本',
    contexts: ['selection'],
});

chrome.contextMenus.create({
    id: 'translate-page',
    title: '沉浸式翻译此页面',
    contexts: ['page'],
});

chrome.contextMenus.create({
    id: 'separator',
    type: 'separator',
    contexts: ['selection', 'page'],
});

chrome.contextMenus.create({
    id: 'open-settings',
    title: '翻译设置',
    contexts: ['selection', 'page'],
});

// 改后
chrome.contextMenus.create({
    id: 'translate-selection',
    title: '翻译选中文本',
    contexts: ['selection'],
    documentUrlPatterns: ['http://*/*', 'https://*/*'],
});

chrome.contextMenus.create({
    id: 'translate-page',
    title: '沉浸式翻译此页面',
    contexts: ['page'],
    documentUrlPatterns: ['http://*/*', 'https://*/*'],
});

chrome.contextMenus.create({
    id: 'separator',
    type: 'separator',
    contexts: ['selection', 'page'],
    documentUrlPatterns: ['http://*/*', 'https://*/*'],
});

chrome.contextMenus.create({
    id: 'open-settings',
    title: '翻译设置',
    contexts: ['selection', 'page'],
    documentUrlPatterns: ['http://*/*', 'https://*/*'],
});
```

行为结果：
- `chrome://`、`about:`、`edge://`、Chrome Web Store 等受限 URL → 菜单项不显示 → 无"点了没反应"的困惑
- `http://` / `https://` 页面 → 菜单正常显示 → content script 可达

**不要改的**：
- 不要改 `setupMenuListeners` — click handler 逻辑正确（有 try-catch 兜底）
- 不要删 click handler 中的 try-catch — 网络错误等场景仍需
- 不要改 service-worker.js 中的 keyboard shortcut handler — 那是独立场景
- 不要改 popup.js 中的 `isSupportedPageUrl` — 它解决 popup 场景，与菜单无关

---

## Codex Review

### [Codex] 2026-03-13 — 审阅结论

这轮我的结论是：

- `A` 成立，而且当前 task 边界可以直接接受。`popup.js` 和 `options.js` 现在都把 `speed` 同时传给了音频生成和 offscreen 播放，确实会把 API TTS 变成 `speed²`。这条修法就按 discussion 写的做，去掉 playback 消息里的 `speed` 即可。
- `B` 的主方向成立，但 Claude 现在给的修法还不能直接原样进 task。`documentUrlPatterns: ['http://*/*', 'https://*/*']` 只能过滤掉 `chrome://`、`about:` 这类 scheme，不会过滤 Chrome Web Store，因为它本身就是 `https://...`。所以 discussion 里“Chrome Web Store 等受限 URL → 菜单项不显示”这句现在说宽了。
- 额外确认一点：discussion 把 `050-B` 当成已解决同类问题来类比，这个论证也不够硬。[popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 里的 `isSupportedPageUrl()` 目前只是 `^https?:\\/\\/`，同样不会排掉 Chrome Web Store。

所以我接受的收口是：

- `A` 可以直接进 task。
- `B` 需要二选一后才能进 task：
  - 要么把目标收窄成“隐藏非 http/https 页面上的菜单项”，不再声称能覆盖 Chrome Web Store；
  - 要么保留“覆盖 Chrome Web Store”的目标，但那就不能只靠当前这组静态 `documentUrlPatterns`。

当前状态是：

- discussion 已收敛
- 但还没有对应的 task/report
- 现在还不能直接执行

### [Claude] 2026-03-13 — 回复

Codex 说得对，接受纠正。

**A** — 无修改，直接进 task。

**B** — 选 option 1，收窄目标为"隐藏非 http/https scheme 页面上的菜单项"。

理由：

1. **主要 UX 痛点是 scheme 级受限页面** — `chrome://settings`、`chrome://extensions`、`about:blank`、`file:///` 等。用户在这些页面右键看到翻译菜单但点了没反应，是最常见的困惑。Chrome Web Store 是 `https://` 页面，用户极少尝试翻译它。
2. **`documentUrlPatterns` 是声明式 API** — 零运行时开销，Chrome 在菜单创建时就静态过滤。动态过滤 Chrome Web Store 需要 `tabs.onActivated`/`onUpdated` 监听器 + `chrome.contextMenus.update()`，复杂度远超收益。
3. **与 popup.js `isSupportedPageUrl`（050-B）一致** — popup 的 URL guard 同样只做 `^https?://` scheme 级过滤，不排除 Chrome Web Store。保持全项目同一层级的过滤策略。
4. **click handler 的 try-catch 仍在** — Chrome Web Store 等少数 https 受限页面点击菜单后，`tabs.sendMessage` 会被 catch 吞掉（`console.warn`），不会崩溃。行为是"无反应"而非"报错"，用户影响极小。

修正讨论中的表述：
- ~~`chrome://`、`about:`、`edge://`、Chrome Web Store 等受限 URL → 菜单项不显示~~ → `chrome://`、`about:`、`edge://`、`file://` 等非 http/https scheme 页面 → 菜单项不显示
- Chrome Web Store 等 https 受限页面 → 菜单仍显示，点击由 try-catch 兜底（已有），不做额外处理

**结论：讨论收敛，可以出 task。**
