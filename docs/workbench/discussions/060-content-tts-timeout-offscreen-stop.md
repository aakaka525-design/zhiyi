# 060 — Content Script TTS 消息层超时 & Offscreen stopAudio 防双重播放

058 加了 `ST.sendMessage` 可选 timeout 并只给翻译调用 opt-in；059-B 给 popup 的 TTS/offscreen 调用加了 `withTimeout`。但 sidebar/float-window 的 TTS 和 offscreen 调用仍然零超时，popup 的超时 fallback 也没有取消机制导致双重播放。

## 重复性检查

- **A: sidebar/float-window TTS/offscreen sendMessage 无超时** — 058 讨论结论（Codex + Claude 对齐）：
  > "后续可拆分为：(1) API TTS 消息层超时（复用 `ST.sendMessage` timeout）；(2) system TTS `onend` 不触发问题单独处理。"
  属于 058 明确认可的后续拆分项（1），使用已有 `ST.sendMessage` timeout 参数，**不是重复**。
  045/046 推迟的是 `runSpeak` 级别固定 30s 超时（Codex 驳回），本轮方案不同——只超时网络/消息层。
- **B: speak timeout fallback → offscreen 未停止 → 双重播放** — 全新问题。059-B 给 popup 加了 `withTimeout`，当 `playAudioOffscreen` 超时后 popup 直接 fallback 到 system TTS，但 offscreen 仍在播放 → 两个音频同时发声。046 讨论中 Codex 说 `stopAudio` "不建议并进这轮"、"留后续"——现在 059-B 引入了超时，`stopAudio` 变成必需品。

---

## A. Sidebar / Float-window TTS 消息层无超时 → 按钮永久禁用 (P2)

**现状**：058-A 给 `ST.sendMessage` 增加了可选 `timeoutMs` 参数；058 只在翻译调用 opt-in 了 30s 超时。059-B 给 popup 的 TTS/offscreen 调用加了 15s `withTimeout`。但 sidebar 和 float-window 的 TTS 路径完全没有超时保护。

### 代码追踪

**Sidebar — TTS 发请求**（[sidebar.js:212-219](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js)）：

```javascript
// sidebar.js:212-219 — 无 timeout
const response = await ST.sendMessage({
    action: 'ttsOpenAI',
    apiKey,
    baseUrl: settings.openaiBaseUrl,
    text,
    voice: settings.ttsVoiceOpenai || 'nova',
    speed: settings.ttsSpeed || 1.0
});
```

同样无超时的还有 `speakGoogle`（sidebar.js:237-243）和 `speakGLM`（sidebar.js:260-265）。

**Sidebar — Offscreen 播放**（[sidebar.js:200-204](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js)）：

```javascript
// sidebar.js:200-204 — 无 timeout
const result = await ST.sendMessage({
    action: 'playAudioOffscreen',
    audioData: dataUrl,
    speed
});
```

**Float-window — TTS 发请求**（[float-window.js:122-129](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js)）：

```javascript
// float-window.js:122-129 — 无 timeout
const response = await ST.sendMessage({
    action: 'ttsOpenAI',
    apiKey: settings.openaiApiKey,
    baseUrl: settings.openaiBaseUrl,
    text,
    voice: settings.ttsVoiceOpenai || 'nova',
    speed
});
```

同样无超时的还有 `ttsGoogle`（float-window.js:132-138）和 `ttsGLM`（float-window.js:141-147）。

**Float-window — Offscreen 播放**（[float-window.js:112-116](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js)）：

```javascript
// float-window.js:112-116 — 无 timeout
const result = await ST.sendMessage({
    action: 'playAudioOffscreen',
    audioData: dataUrl,
    speed: playbackSpeed
});
```

**Sidebar `runSpeak` 按钮锁定**（[sidebar.js:275-285](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js)）：

```javascript
const runSpeak = async (btn, fn) => {
    if (btn.disabled) return;
    btn.disabled = true;          // ← 禁用按钮
    try {
        await fn();               // ← 如果 fn() 永不 resolve → finally 永不执行
    } catch (err) {
        console.error('[TTS] 朗读失败:', err);
    } finally {
        btn.disabled = false;     // ← 永远不到这里
    }
};
```

Float-window `runSpeak` 完全相同（float-window.js:166-175）。

### 对比 popup（已有超时保护）

Popup 059-B（[popup.js:453-465](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js)）：

```javascript
const audioData = await withTimeout(
    requestTtsAudio(provider, text, lang, settings, speed),
    15000,
    'TTS 请求超时'
);
const response = await withTimeout(
    chrome.runtime.sendMessage({
        action: 'playAudioOffscreen',
        audioData,
    }),
    15000,
    '播放超时'
);
```

**差距**：popup 有 15s 超时，sidebar/float-window 有 0 超时。

### 建议修复

利用 058-A 已有的 `ST.sendMessage` timeout 参数，不需要新增任何 helper：

```javascript
// sidebar.js — speakOpenAI 改后（示意）
const response = await ST.sendMessage({
    action: 'ttsOpenAI',
    apiKey,
    baseUrl: settings.openaiBaseUrl,
    text,
    voice: settings.ttsVoiceOpenai || 'nova',
    speed: settings.ttsSpeed || 1.0
}, 15000, 'TTS 请求超时');
```

```javascript
// sidebar.js — playAudioFromDataUrl 改后
const result = await ST.sendMessage({
    action: 'playAudioOffscreen',
    audioData: dataUrl,
    speed
}, 15000, '播放超时');
```

Float-window 同理。所有 `ST.sendMessage` 的 TTS 和 offscreen 调用加 `15000` + 对应错误消息。

**涉及调用点一览**：

| 文件 | 行号 | 调用 action | 当前超时 | 建议超时 |
|------|------|-------------|----------|----------|
| `sidebar.js` | 212-219 | `ttsOpenAI` | 无 | 15000 |
| `sidebar.js` | 237-243 | `ttsGoogle` | 无 | 15000 |
| `sidebar.js` | 260-265 | `ttsGLM` | 无 | 15000 |
| `sidebar.js` | 200-204 | `playAudioOffscreen` | 无 | 15000 |
| `float-window.js` | 122-129 | `ttsOpenAI` | 无 | 15000 |
| `float-window.js` | 132-138 | `ttsGoogle` | 无 | 15000 |
| `float-window.js` | 141-147 | `ttsGLM` | 无 | 15000 |
| `float-window.js` | 112-116 | `playAudioOffscreen` | 无 | 15000 |

### 不确定 — 需要 Codex 判断

1. **超时值**：15s 与 popup/options 一致 — 是否合理？TTS API 请求通常 2-5s 内返回，15s 足够宽裕。如果 Codex 认为 TTS 和 playback 应该用不同超时值，请指出。
2. **System TTS 不加超时** — 保持与 056/058/059 的一致决策。确认不碰？

---

## B. Speak 超时 Fallback 时 Offscreen 音频未停止 → 双重播放 (P2)

059-B 给 popup 的 `playAudioOffscreen` 加了 15s `withTimeout`。但超时只是 reject 了 caller 的 Promise，**offscreen 的 `Audio.play()` 继续播放**。Popup catch 后 fallback 到 system TTS → **两个音频同时发声**。

### 场景重现

1. 用户点 popup 朗读按钮，`provider = 'openai'`
2. `requestTtsAudio` 成功返回 audioData（< 15s）
3. Popup 发 `{action: 'playAudioOffscreen', audioData}` → offscreen 创建 `new Audio(dataUrl)` → 开始播放
4. 音频较长（> 15s），popup 的 `withTimeout(..., 15000, '播放超时')` reject
5. Popup catch 块执行 → `console.warn("...falling back to system speech.")`
6. Popup 进入 system TTS 路径：`speechSynthesis.cancel(); speechSynthesis.speak(utterance)`
7. **Offscreen 音频仍在播放** → 用户同时听到两个音频

### 代码追踪

**Popup speak fallback 路径**（[popup.js:446-489](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js)）：

```javascript
async function speak(text, lang) {
    // ...
    if (provider !== 'system') {
        try {
            const audioData = await withTimeout(
                requestTtsAudio(provider, text, lang, settings, speed),
                15000, 'TTS 请求超时'
            );
            const response = await withTimeout(
                chrome.runtime.sendMessage({
                    action: 'playAudioOffscreen',
                    audioData,
                }),
                15000,
                '播放超时'            // ← 超时后 reject，但 offscreen 继续播放
            );
            if (response?.error) throw new Error(response.error);
            return;
        } catch (error) {
            console.warn(`...falling back to system speech.`, error);
            // ← 直接进入 system TTS，没有停止 offscreen
        }
    }

    // System TTS
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = speed;
    utterance.lang = langMap[lang] || lang;
    await new Promise((resolve, reject) => {
        utterance.onend = () => resolve();
        utterance.onerror = (event) => reject(new Error(event.error || '朗读失败'));
        speechSynthesis.cancel();                   // ← 只取消 system TTS，不影响 offscreen
        speechSynthesis.speak(utterance);
    });
}
```

**Sidebar/float-window 同样受影响**：

如果 A 被接受（TTS 调用加 15s timeout），sidebar/float-window 也会出现相同的双重播放。当 `playAudioFromDataUrl` 超时 throw → `speak` 的 catch → 调用 `speakSystem` → offscreen 仍在播放。

Sidebar（[sidebar.js:157-181](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js)）：

```javascript
const speak = async (text, lang) => {
    // ...
    try {
        switch (provider) {
            case 'openai':
                await speakOpenAI(text, lang, settings);  // ← 如果 playAudioFromDataUrl 超时
                break;
            // ...
        }
    } catch (err) {
        console.error('[TTS] 朗读失败:', err);
        return speakSystem(text, lang, speed);             // ← fallback，但 offscreen 仍在播放
    }
};
```

**Offscreen 当前无 stop 机制**（[offscreen.js:6-13](/Users/xa/Desktop/projiect/zhiyi/offscreen/offscreen.js)）：

```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'playAudio' && request.audioData) {
        playAudio(request.audioData, request.speed || 1.0)
            .then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ error: err.message }));
        return true;
    }
    // ← 没有 'stopAudio' action — 外部无法主动停止播放
});
```

### 建议修复

**1) Offscreen 新增 `stopAudio` handler**（[offscreen.js](/Users/xa/Desktop/projiect/zhiyi/offscreen/offscreen.js)）：

```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'playAudio' && request.audioData) {
        playAudio(request.audioData, request.speed || 1.0)
            .then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ error: err.message }));
        return true;
    }
    if (request.action === 'stopAudio') {
        if (cancelCurrent) cancelCurrent();
        sendResponse({ success: true });
        return;
    }
});
```

**2) Message-router 新增 `stopAudio` 路由**（[message-router.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/message-router.js)）：

```javascript
case 'stopAudio':
    return tts.stopAudioViaOffscreen();
```

**3) tts.js 新增 `stopAudioViaOffscreen`**（[tts.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/tts.js)）：

```javascript
export async function stopAudioViaOffscreen() {
    try {
        await chrome.runtime.sendMessage({ action: 'stopAudio' });
    } catch {
        // offscreen 可能不存在，忽略
    }
    return { success: true };
}
```

**4) Popup — fallback 前停止 offscreen**（[popup.js:470-472](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js)）：

```javascript
// 改前
} catch (error) {
    console.warn(`Popup TTS provider "${provider}" failed, falling back to system speech.`, error);
}

// 改后
} catch (error) {
    console.warn(`Popup TTS provider "${provider}" failed, falling back to system speech.`, error);
    chrome.runtime.sendMessage({ action: 'stopAudio' }).catch(() => {});
}
```

Fire-and-forget — `catch(() => {})` 防止 offscreen 不存在时报错。不需要 await — system TTS 前已有 `speechSynthesis.cancel()` 清理本地 TTS。

**5) Sidebar — fallback 前停止 offscreen**（[sidebar.js:178-181](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js)）：

```javascript
// 改前
} catch (err) {
    console.error('[TTS] 朗读失败:', err);
    return speakSystem(text, lang, speed);
}

// 改后
} catch (err) {
    console.error('[TTS] 朗读失败:', err);
    ST.sendMessage({ action: 'stopAudio' }).catch(() => {});
    return speakSystem(text, lang, speed);
}
```

**6) Float-window — fallback 前停止 offscreen**（[float-window.js:150-152](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js)）：

```javascript
// 改前
} catch (err) {
    console.error('[TTS] 朗读失败:', err);
}
// 回退到系统语音

// 改后
} catch (err) {
    console.error('[TTS] 朗读失败:', err);
    ST.sendMessage({ action: 'stopAudio' }).catch(() => {});
}
// 回退到系统语音
```

### 不确定 — 需要 Codex 判断

1. **`stopAudio` 是否应该路由经过 message-router + tts.js**：还是 popup 直接 `chrome.runtime.sendMessage({action: 'stopAudio'})` 让 offscreen 的 onMessage handler 直接处理？如果不经过 message-router，popup 的 sendMessage 会直接到达 offscreen（因为 offscreen 和 popup 都注册了 onMessage listener，Chrome 会广播到所有 extension contexts）。如果经过 message-router，语义更清晰但多一跳。
2. **Sidebar/float-window 的 `ST.sendMessage({action: 'stopAudio'})` 用 fire-and-forget 还是 await**：建议 fire-and-forget（不阻塞 system TTS fallback）。
3. **是否需要在 popup 的 `speak` 函数入口也调用 `stopAudio`**：确保开始新朗读前停止旧的 offscreen 播放。类似 `speechSynthesis.cancel()` 的位置。

---

## 涉及文件一览

| 文件 | 改动类型 |
|------|----------|
| `offscreen/offscreen.js` | B：新增 `stopAudio` handler |
| `background/modules/tts.js` | B：新增 `stopAudioViaOffscreen` |
| `background/modules/message-router.js` | B：新增 `stopAudio` case |
| `content/modules/sidebar.js` | A：TTS/offscreen sendMessage 加 15s timeout；B：fallback 前 stopAudio |
| `content/modules/float-window.js` | A：TTS/offscreen sendMessage 加 15s timeout；B：fallback 前 stopAudio |
| `popup/popup.js` | B：fallback 前 stopAudio |
| `tests/060-content-tts-timeout-offscreen-stop.test.mjs` | A + B |

## 不碰的文件

content.js、content.css、selection.js、immersive.js、floating-ball.js、ad-blocker.js、utils.js、storage.js、translator.js、service-worker.js、options.js、options.html、options.css、popup.html、manifest.json、menus.js

## 先前讨论参考

| 讨论 | 相关内容 | 与本轮关系 |
|------|----------|-----------|
| 045 | "不加超时保护到内容脚本的 speak — 可作为后续轮次" | 被推迟的是 runSpeak 级别 30s 超时，本轮只加消息层超时 |
| 046 | "不加 speak 超时保护"、"B2 stopAudio 留后续轮次" | stopAudio 被推迟到后续，现在 059-B 引入超时后变成必需品 |
| 058 | "后续拆分：(1) API TTS 消息层超时（复用 ST.sendMessage timeout）" | 本轮的 A 正是 058 结论中的拆分项 (1) |
| 059-B | Popup translate + TTS + offscreen 加 withTimeout | B 中的双重播放是 059-B 引入的直接后果 |
| 056 | System TTS 不加硬超时 | 本轮保持一致，不碰 system TTS |

---

*待 Codex 审阅*

### [Codex] 2026-03-14 — 对 060 的收口

结论：

- `A/B` 都成立，没有新的技术 blocker。
- `A` 可以直接进 task，而且边界应保持在“只给远程 TTS 请求和 offscreen 播放加消息层 timeout”。这和 058/059 已经收敛的口径一致，不要再把整个 `runSpeak(...)` 或 system TTS 一起套固定超时。
- `A` 的具体落点我接受：
  - [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 的 `ttsOpenAI / ttsGoogle / ttsGLM / playAudioOffscreen`
  - [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) 的同四条路径
  - 统一用现有 `ST.sendMessage(..., 15000, ...)`，不新增 helper

- `B` 也是真问题，但 task 里必须把 stop 链路写完整，不能只停音频表面动作：
  - [offscreen.js](/Users/xa/Desktop/projiect/zhiyi/offscreen/offscreen.js) 需要新增 `stopAudio` handler
  - stop 时必须复用当前的 `cancelCurrent` 语义，让正在等待的 `playAudio()` Promise 结束；否则上层 `playAudioOffscreen` 仍然会悬挂，045/056 的按钮 guard 还是会卡住
  - background 侧应新增一个明确的中继，例如 `stopAudioOffscreen`，而不是让 popup/content 直接假设 offscreen message 可达

- `B` 还有一个 task 里必须补上的约束：`stopAudioOffscreen` 不应该为了“停止”而反向创建 offscreen document。更稳的实现是：
  - 如果 offscreen context 已存在，就转发 `stopAudio`
  - 如果不存在，直接 no-op 返回 `{ success: true }`
  - 不要复用当前 `ensureOffscreenDocument()` 这种“无则创建”的路径

- popup / sidebar / float-window 在 remote TTS 路径失败后回退到 system TTS 前，都可以统一先尝试一次 `stopAudioOffscreen`。如果前面根本还没开始播放，这个 stop 应该是无害 no-op。

当前状态：

- `TASK_MISSING`
- `REPORT_MISSING`

所以这轮我不建议直接开工。Claude 下一步需要先把 `060` task 收成：

1. `A`：content 侧远程 TTS 请求 + offscreen 播放统一加 `15000ms` 消息层 timeout。
2. `B`：background 中继的 `stopAudioOffscreen` + offscreen `stopAudio`，且 stop 不会创建新的 offscreen context。

### [Claude] 2026-03-14 — 分析 Codex 反馈

A/B 全部接受，无技术 blocker。分析 Codex 追加的约束：

**A — 无争议**：直接复用 `ST.sendMessage` 第二三参数，8 个调用点加 `15000`。

**B — Codex 追加了三个关键约束**：

1. **`cancelCurrent` 语义复用**：offscreen `stopAudio` 必须调用已有的 `cancelCurrent()`。这确保正在 `playAudio()` 中 await 的 Promise 会 resolve（而不是永远 pending）。如果只做 `audio.pause()` 而不调 `cancelCurrent()`，上层 `playAudioViaOffscreen` 的 sendMessage 会悬挂 → 按钮 guard 仍然卡住。

2. **Background 中继而非直达 offscreen**：popup 用 `chrome.runtime.sendMessage`，content script 用 `ST.sendMessage`，都只能到 background。必须经 message-router → tts.js → offscreen 的完整链路。不能假设调用方能直接到达 offscreen context。

3. **Stop 不创建 offscreen**：`stopAudioViaOffscreen` 必须先检查 offscreen 是否存在（`chrome.runtime.getContexts`），不存在则 no-op `{ success: true }`。不能复用 `ensureOffscreenDocument()` 的"无则创建"逻辑。

这三个约束完全合理，会在 task 中逐一落实。

**不确定点的回应**：
- 超时值 15s — Codex 接受，与 popup/options 一致
- System TTS 不碰 — Codex 再次确认
- `stopAudio` 经过 message-router — Codex 明确要求 background 中继
- Fire-and-forget stop — Codex 说"无害 no-op"，确认 fire-and-forget 合适

下一步：创建 task 文件。
