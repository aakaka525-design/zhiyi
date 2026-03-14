---
status: done
priority: P2
created: 2026-03-13
---

# 054 — TTS 双重倍速修复 & 右键菜单 scheme 级 URL 过滤

- 来源讨论: [discussions/054-tts-double-speed-contextmenu-url-guard.md](../discussions/054-tts-double-speed-contextmenu-url-guard.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/054-tts-double-speed-contextmenu-url-guard.md](../discussions/054-tts-double-speed-contextmenu-url-guard.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `popup/popup.js` | A：删除 `playAudioOffscreen` 消息中的 `speed` 字段 |
| `options/options.js` | A：删除 `playAudioOffscreen` 消息中的 `speed` 字段 |
| `background/modules/menus.js` | B：四个 `contextMenus.create` 调用加 `documentUrlPatterns` |
| `tests/tts-double-speed-contextmenu.test.mjs` | A + B |

## 任务清单

### 必做

#### A. TTS API 朗读倍速叠加修复

API TTS 服务（OpenAI/Google/GLM）在音频生成阶段已应用 `speed`，但 popup 和 options 又把 `speed` 传给 offscreen 播放，导致 `audio.playbackRate = speed` 再次加速。有效倍速 = speed²。

- [x] `popup/popup.js` — 删除 `playAudioOffscreen` 消息中的 `speed` 字段（当前 line 437-441）：
  ```javascript
  // 改前（line 437-441）
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

  行为说明：
  - API TTS 音频已在生成阶段含倍速 → offscreen 收到时 `speed` 为 `undefined` → `playAudioViaOffscreen` 默认 `1.0` → `audio.playbackRate = 1.0` → 有效倍速 = speed × 1
  - System TTS 回退（line 457-461）用 `utterance.rate = speed`，不经过 offscreen → 不受影响
  - 对照组 sidebar.js、float-window.js 已经是这个模式（不传 speed 给 playback）

- [x] `options/options.js` — 删除 `playAudioOffscreen` 消息中的 `speed` 字段（当前 line 356-361）：
  ```javascript
  // 改前（line 356-361）
  const playbackResponse = await withTimeout(
      chrome.runtime.sendMessage({
          action: 'playAudioOffscreen',
          audioData,
          speed,
      }),
      15000,
      '播放超时',
  );

  // 改后
  const playbackResponse = await withTimeout(
      chrome.runtime.sendMessage({
          action: 'playAudioOffscreen',
          audioData,
      }),
      15000,
      '播放超时',
  );
  ```

  行为说明：
  - `requestTtsTestAudio(provider, testText, speed)` 已把 speed 传给 API → 音频生成阶段含倍速
  - 去掉播放消息中的 `speed` → offscreen 默认 `1.0` → 有效倍速 = speed × 1
  - `playSystemTtsTest`（line 377）用 `utterance.rate = speed` → 不经 offscreen → 不受影响

**不要做的事**：
- 不要改 `offscreen.js` — `playbackRate` 参数保留，其默认值 `1.0` 在不传 speed 时自动生效
- 不要改 `background/modules/tts.js` — API 生成阶段传 speed 是正确的
- 不要改 `tts.playAudioViaOffscreen` — 它只是透传，签名 `(audioData, speed = 1.0)` 默认值正确
- 不要改 `message-router.js` — 路由逻辑正确
- 不要改 sidebar.js、float-window.js — 它们已经是正确模式

### 必做

#### B. 右键菜单 scheme 级 URL 过滤

`menus.js` 创建右键菜单时没有 `documentUrlPatterns`，菜单在 `chrome://`、`about:`、`file://` 等非 http/https scheme 页面上也显示，点击后静默失败。

**目标范围**：过滤非 http/https scheme 的页面。Chrome Web Store 等 https 受限页面不在此次修复范围内（click handler 的 try-catch 已兜底）。

- [x] `background/modules/menus.js` — 四个 `contextMenus.create` 调用都加 `documentUrlPatterns`（当前 line 5-31）：
  ```javascript
  // 改前（line 5-31）
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

  行为说明：
  - `chrome://`、`about:`、`edge://`、`file://` 等非 http/https scheme → 菜单项不显示 → 无"点了没反应"的困惑
  - `http://` / `https://` 页面 → 菜单正常显示 → content script 可达
  - Chrome Web Store（`https://chromewebstore.google.com`）→ 菜单仍显示 → 点击由 click handler 的 try-catch 兜底（`console.warn`），不崩溃
  - `open-settings` 不需要 content script（直接 `chrome.runtime.openOptionsPage()`），但加 `documentUrlPatterns` 保持菜单组视觉一致性

**不要做的事**：
- 不要改 `setupMenuListeners` — click handler 逻辑正确（try-catch 兜底仍需）
- 不要删 click handler 中的 try-catch — Chrome Web Store 等 https 受限页面仍需兜底
- 不要改 service-worker.js 中的 keyboard shortcut handler — 独立场景
- 不要改 popup.js 中的 `isSupportedPageUrl` — 它解决 popup 场景，与菜单无关
- 不要尝试动态过滤 Chrome Web Store — 超出本任务范围

## 不做的事

- **不做** `offscreen.js` 改动 — `playbackRate` 参数和默认值正确
- **不做** `background/modules/tts.js` 改动 — API 生成阶段传 speed 正确
- **不做** `tts.playAudioViaOffscreen` 改动 — 透传 + 默认值正确
- **不做** `message-router.js` 改动 — 路由逻辑正确
- **不做** sidebar.js / float-window.js 改动 — 已是正确模式
- **不做** `setupMenuListeners` click handler 改动 — try-catch 兜底仍需
- **不做** Chrome Web Store 动态过滤 — 超出范围
- **不碰** content.js、selection.js、floating-ball.js、ad-blocker.js、immersive.js、options.html、popup.html、options-ui-state.js、service-worker.js、storage.js、translator.js、manifest.json

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check popup/popup.js` 通过
- [x] `node --check options/options.js` 通过
- [x] `node --check background/modules/menus.js` 通过
- [x] `git diff --check` 无输出
