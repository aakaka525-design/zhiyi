# 058 — 翻译请求无超时 & 朗读无超时/取消 & 语言 Select 不响应 Storage 变更

## 上下文

057 完成（侧边栏/小窗语言持久化 + Options TTS Promise 修复）。本轮聚焦三个结构性 UX 问题。

### 重叠验证

- **A: Content Script 翻译 sendMessage 无超时** — 全新问题。044 仅处理 options 页的 API/TTS 测试超时；020 修了错误吞咽但未处理挂起态。内容脚本翻译路径在任何层级都没有超时保护。
- **B: 朗读无超时 / 无用户取消** — 045/046 显式推迟：
  - 045: "不加超时保护到内容脚本的 speak — 可作为后续轮次"
  - 046: "不加 speak 超时保护 — 045 显式推迟，可作为后续轮次"
  - 046-B2 (offscreen stop): "留后续轮次"
- **C: Sidebar/Float-window select 不响应 storage 变更** — 全新问题。057 添加了 `saveLanguageSettings` 写入 storage，但没有模块监听 storage 变更来更新 DOM，导致多 tab 场景下语言不同步。

---

## A. Content Script 翻译无超时保护 → UI 死锁 (P2)

### 现象

用户在侧边栏或翻译小窗点击"翻译" → 如果网络异常或 service worker 无响应 → 所有控件永久 disabled → 用户只能刷新页面。

### 根因 — 完整代码追踪

**Layer 1 — `ST.sendMessage` 无超时**

`content/modules/utils.js:17-26`：
```javascript
ST.sendMessage = function (message) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(response);
            }
        });
    });
};
// 无 timeout — 如果 handler 不 sendResponse，Promise 永不 settle
```

**Layer 2 — sidebar 调用**

`content/modules/sidebar.js:316-321`：
```javascript
const response = await ST.sendMessage({
    action: 'translate',
    text: text,
    from: sourceLangSelect.value,
    to: targetLangSelect.value
});
// await 如果永远不 resolve → finally 永远不执行 → 控件永久 disabled
```

上方 `sidebar.js:307-313` 禁用了所有控件：
```javascript
translateBtn.innerText = '翻译中...';
translateBtn.disabled = true;
input.disabled = true;
sourceLangSelect.disabled = true;
targetLangSelect.disabled = true;
clearBtn.disabled = true;
swapBtn.disabled = true;
```

**Layer 3 — float-window 调用**

`content/modules/float-window.js:217-221`：
```javascript
const response = await ST.sendMessage({
    action: 'translate',
    text: text,
    to: targetLangSelect.value
});
// 同上：挂起 → 控件永久 disabled
```

**Layer 4 — service worker 路由**

`background/modules/message-router.js:5-6`：
```javascript
case 'translate':
    return translator.translate(request.text, request.from, request.to, request.provider);
```

**Layer 5 — translator fallback 链**

`src/core/translator.js:94-95`：
```javascript
const result = await translator.translate(text, from, to);
// provider.translate 内部 fetch(apiUrl) — 无 AbortController、无 timeout
```

且 fallback 链（主 → google → offline）每步都可能各自挂起，最差情况下挂起时间叠加。

### 对比已有超时保护

1. `content/content.js:63-73` — `loadSettings` 有 `setTimeout(() => reject(...), 3000)`
2. `options/options.js:15-22` — 通用 `withTimeout(promise, ms, message)` 模式：
```javascript
function withTimeout(promise, ms, message = '请求超时') {
    let timeoutId;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(message)), ms);
        }),
    ]).finally(() => clearTimeout(timeoutId));
}
```
3. `options/options.js:350-353` — `await withTimeout(requestTtsTestAudio(...), 15000, 'TTS 请求超时')`

### 建议修复方向

**方案 1 — 在 sidebar/float-window 调用侧加 timeout**：
```javascript
// sidebar.js translateBtn.onclick 改后
const response = await Promise.race([
    ST.sendMessage({ action: 'translate', text, from: sourceLangSelect.value, to: targetLangSelect.value }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('翻译请求超时')), 30000)),
]);
```

**方案 2 — 在 `ST.sendMessage` 自身加可选 timeout 参数**：
```javascript
ST.sendMessage = function (message, timeoutMs = 0) {
    const p = new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve(response);
        });
    });
    if (timeoutMs <= 0) return p;
    let timeoutId;
    return Promise.race([
        p,
        new Promise((_, r) => { timeoutId = setTimeout(() => r(new Error('请求超时')), timeoutMs); }),
    ]).finally(() => clearTimeout(timeoutId));
};
```

### 需要 Codex 判断的不确定点

1. **超时时间选择**：30s? 60s?（网络差 + fallback 链 = 较长时间）
2. **方案 1 vs 方案 2** — 方案 2 更通用但改了公共 API 签名，方案 1 更局部
3. **超时后是否需要 abort service worker 中进行中的 fetch** — 当前 fetch 无 AbortController，abort 需要额外改动，是否本轮做

---

## B. Content Script 朗读无超时 + 无用户取消 (P2)

045/046 显式推迟的问题，本轮捡回修复。

### 现象

用户点击朗读按钮 → 如果 TTS 请求挂起或系统 TTS 不触发 onend → 朗读按钮永久 disabled → 再次点击被直接忽略。

### 根因 — 完整代码追踪

**sidebar `runSpeak`**

`content/modules/sidebar.js:279-289`：
```javascript
const runSpeak = async (btn, fn) => {
    if (btn.disabled) return;     // ← 播放中再点击 = 直接忽略
    btn.disabled = true;
    try {
        await fn();               // ← fn() 永不 resolve → 按钮永久 disabled
    } catch (err) {
        console.error('[TTS] 朗读失败:', err);
    } finally {
        btn.disabled = false;
    }
};
```

**float-window `runSpeak`** — 完全相同模式

`content/modules/float-window.js:170-180`：
```javascript
const runSpeak = async (btn, fn) => {
    if (btn.disabled) return;
    btn.disabled = true;
    try {
        await fn();
    } catch (err) {
        console.error('[TTS] 朗读失败:', err);
    } finally {
        btn.disabled = false;
    }
};
```

**TTS 调用链（以 sidebar OpenAI 为例）**

`sidebar.js:212-230`：
```javascript
const speakOpenAI = async (text, lang, settings) => {
    const apiKey = settings.openaiApiKey;
    if (!apiKey) { return speakSystem(text, lang, settings.ttsSpeed || 1.0); }

    const response = await ST.sendMessage({      // ← Layer 1: 无 timeout
        action: 'ttsOpenAI', apiKey, text, voice, speed
    });

    if (response?.audioData) {
        await playAudioFromDataUrl(response.audioData);  // ← Layer 2: offscreen play 无 timeout
    } else {
        throw new Error(response?.error || 'OpenAI TTS failed');
    }
};
```

**系统 TTS 路径**

`sidebar.js:188-200`：
```javascript
const speakSystem = (text, lang, speed) => {
    return new Promise((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = speed;
        utterance.lang = langMap[resolvedLang] || resolvedLang;
        utterance.onend = () => resolve();
        utterance.onerror = (event) => reject(new Error(event.error || '朗读失败'));
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    });
};
// 已知 Chromium bug: 长文本时 onend 可能不触发 → Promise 永不 settle
```

`float-window.js:155-167` — 同理：
```javascript
await new Promise((resolve, reject) => {
    utterance.onend = () => resolve();
    utterance.onerror = (event) => reject(new Error(event.error || '朗读失败'));
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
});
```

### 对比 options 已有保护

- `options.js:350-353`: `await withTimeout(requestTtsTestAudio(...), 15000, 'TTS 请求超时')`
- `options.js:357-363`: `await withTimeout(chrome.runtime.sendMessage({action: 'playAudioOffscreen', ...}), 15000, '播放超时')`

### 建议修复方向

**必做 — 超时保护**（两处 `runSpeak` 统一改）：
```javascript
const runSpeak = async (btn, fn) => {
    if (btn.disabled) return;
    btn.disabled = true;
    try {
        await Promise.race([
            fn(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('朗读超时')), 30000)),
        ]);
    } catch (err) {
        console.error('[TTS] 朗读失败:', err);
    } finally {
        btn.disabled = false;
    }
};
```

**可选增强 — 用户取消**（按钮变 toggle，需 Codex 判断复杂度）：
```javascript
// 概念方案
let currentSpeakAbort = null;
const runSpeak = async (btn, fn) => {
    if (btn.disabled) {
        // 正在播放 → 取消
        currentSpeakAbort?.();
        return;
    }
    btn.disabled = true;
    try {
        await new Promise((resolve, reject) => {
            currentSpeakAbort = () => {
                window.speechSynthesis.cancel();
                reject(new Error('用户取消'));
            };
            fn().then(resolve, reject);
        });
    } catch (err) {
        if (err.message !== '用户取消') console.error('[TTS] 朗读失败:', err);
    } finally {
        btn.disabled = false;
        currentSpeakAbort = null;
    }
};
```

### 需要 Codex 判断的不确定点

1. **超时值**：30s?（系统 TTS 长文本可能正常播放超过 30s — 是否需要更长或根据文本长度动态计算）
2. **取消机制是否本轮做**：必做超时 + 可选取消？还是只做超时？
3. **API TTS 取消范围**：系统 TTS 可通过 `speechSynthesis.cancel()` 取消，但 API TTS 的 offscreen 播放需要发 `stopAudio` 消息 — 范围可能过大，是否拆分到后续轮次

---

## C. Sidebar/Float-window 语言 Select 不响应 Storage 变更 (P2)

### 现象

057 引入 `saveLanguageSettings` 后暴露：Tab A 和 Tab B 同时打开侧边栏 → Tab B 切换语言 → Tab A 的 `ST.state.settings` 已更新但 select DOM 元素仍显示旧值 → 用户在 Tab A 翻译时使用了 select 的旧值而非 storage 的新值。

### 根因 — 完整代码追踪

**写入路径（057 新增）**

`content/modules/sidebar.js:120-126`：
```javascript
const saveLanguageSettings = async (partialSettings) => {
    const result = await chrome.storage.local.get('settings');
    const settings = result.settings || {};
    await chrome.storage.local.set({
        settings: { ...settings, ...partialSettings },
    });
};
```
→ 写入 `chrome.storage.local` → 触发所有 tab 的 `chrome.storage.onChanged`

`content/modules/float-window.js:85-91`：同样的 `saveLanguageSettings` 实现。

**监听路径 — 更新 settings 但不更新 DOM**

`content/content.js:138-147`：
```javascript
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.settings) {
        ST.state.settings = mergeDefaults(changes.settings.newValue);  // ← settings 对象已更新 ✓
        applyContentTheme(ST.state.settings?.darkMode);                // ← 主题已响应 ✓
        if (ST.state.settings?.showFloatingBall === true && ST.floatingBall?.init) {
            ST.floatingBall.init();                                    // ← 浮动球已响应 ✓
        }
        // ← 缺失：sidebar/float-window 的 select 元素不更新 ✗
    }
});
```

**初始化只读一次**

`sidebar.js:114-118`：
```javascript
if (ST.state.settings) {
    sourceLangSelect.value = ST.state.settings.sourceLang || 'auto';
    targetLangSelect.value = ST.state.settings.targetLang || 'zh';
}
// 之后 select 值只通过用户手动操作和 change 事件更新 — 不监听 storage 变化
```

`float-window.js:81-83`：
```javascript
if (ST.state.settings) {
    targetLangSelect.value = ST.state.settings.targetLang || 'zh';
}
```

### 场景重现

1. Tab A 打开侧边栏，`targetLangSelect.value = "zh"`
2. Tab B 打开侧边栏，用户切换为 "en" → `saveLanguageSettings({ targetLang: 'en' })`
3. Tab A 的 `chrome.storage.onChanged` 触发 → `ST.state.settings.targetLang = "en"` ✓
4. Tab A 的 `targetLangSelect.value` 仍为 "zh" ✗ — DOM 未更新
5. 用户在 Tab A 翻译 → 使用 select 的 "zh" 而非 storage 的 "en"

### 建议修复方向

在 `content.js` 的 `chrome.storage.onChanged` handler 中增加 DOM 同步：
```javascript
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.settings) {
        ST.state.settings = mergeDefaults(changes.settings.newValue);
        applyContentTheme(ST.state.settings?.darkMode);
        // ... existing floating ball check ...

        // 新增：同步 sidebar/float-window select 值
        ST.syncLanguageSelects?.();
    }
});
```

`ST.syncLanguageSelects` 实现（放在 `content.js` 或 `utils.js`）：
```javascript
ST.syncLanguageSelects = function () {
    const s = ST.state.settings;
    if (!s) return;
    const sidebar = document.getElementById('st-sidebar');
    if (sidebar) {
        const src = sidebar.querySelector('#st-sidebar-source-lang');
        const tgt = sidebar.querySelector('#st-sidebar-target-lang');
        if (src && s.sourceLang) src.value = s.sourceLang;
        if (tgt && s.targetLang) tgt.value = s.targetLang;
    }
    const fw = document.getElementById('st-float-window');
    if (fw) {
        const tgt = fw.querySelector('#st-float-target-lang');
        if (tgt && s.targetLang) tgt.value = s.targetLang;
    }
};
```

### 需要 Codex 判断的不确定点

1. **同步时是否需要检查用户正在操作 select**（避免打断正在下拉选择的用户）
2. **是否需要区分"来自本 tab 的 saveLanguageSettings"和"来自其他 tab"** — `chrome.storage.onChanged` 在同一 tab 内也会触发，本 tab 的 change 事件刚修改了 select，再同步是多余的但无害
3. **`syncLanguageSelects` 放在 `utils.js`（方便复用）还是 `content.js`（只需要一处）**

---

## 涉及文件

| 文件 | 行号 | 角色 |
|------|------|------|
| `content/modules/utils.js` | 17-26 | `ST.sendMessage` 定义 — 无 timeout |
| `content/modules/sidebar.js` | 279-289, 303-362 | 翻译 + 朗读 handler |
| `content/modules/float-window.js` | 170-180, 206-254 | 翻译 + 朗读 handler |
| `content/content.js` | 138-147 | `storage.onChanged` — 更新 settings 但不更新 DOM |
| `background/modules/message-router.js` | 1-42 | 翻译/TTS 消息路由 |
| `src/core/translator.js` | 69-131 | 翻译 fallback 链 — 无 timeout |

## 前序讨论参考

| 讨论 | 已覆盖 | 已推迟 |
|------|--------|--------|
| 044 | Options 页 API 测试 + TTS 测试超时 | — |
| 045 | Speak 按钮 disabled guard | "不加超时保护到内容脚本的 speak — 可作为后续轮次" |
| 046 | Offscreen 音频重叠防护 | "不加 speak 超时保护" + "B2 留后续" |
| 020 | 翻译错误吞咽修复 | Timeout/挂起态未讨论 |
| 057 | `saveLanguageSettings` 写入 storage | 无 reactive 读回机制 |

## Codex Review

### [Codex] 2026-03-13 — 收口结论

这轮我的判断是：

- `A` 成立，可以进 task。
- `C` 也成立，而且边界不大，可以和 `A` 放在同一轮。
- `B` 的问题判断成立，但我不接受 discussion 里现在这版“直接给 `runSpeak` 整段包一个 30s `Promise.race(...)`”。

#### A. 翻译请求超时

问题本身我接受：现在 [utils.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/utils.js) 的 `ST.sendMessage()` 没超时，sidebar / float-window 的翻译按钮一旦卡在 `await ST.sendMessage(...)`，`finally` 就永远到不了。

但我不建议在每个调用点都手写：

```javascript
await Promise.race([
    ST.sendMessage(...),
    new Promise((_, reject) => setTimeout(...)),
]);
```

更稳的最小收口是：

- 给 `ST.sendMessage` 增加**可选** timeout 参数
- 默认仍保持 `0` 或无超时，避免改掉全局语义
- 只让 translate / TTS 这类会锁 UI 的调用点显式传 timeout

例如：

```javascript
ST.sendMessage = function (message, timeoutMs = 0, timeoutMessage = '请求超时') {
    const request = new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve(response);
        });
    });

    if (timeoutMs <= 0) return request;

    let timeoutId;
    return Promise.race([
        request,
        new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
        }),
    ]).finally(() => clearTimeout(timeoutId));
};
```

这样：

- `sidebar.js` / `float-window.js` 的 translate 路径可以显式传 `30000`
- 以后如果要给 TTS 请求也加超时，可以复用同一个 helper
- 不需要本轮去碰 background / translator 的 AbortController

所以 `A` 我接受，但 task 应该收成“`ST.sendMessage` 可选 timeout + translate 调用点 opt-in”，而不是每个 handler 各自复制 `Promise.race`。

#### B. 朗读超时 / 用户取消

问题判断是对的，但修法要分开看。

我不接受当前 discussion 里这版：

```javascript
await Promise.race([
    fn(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('朗读超时')), 30000)),
]);
```

原因很直接：

- 现在 [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) / [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) 的 `runSpeak` 是刻意等待**整段播放结束**后才恢复按钮
- 如果整段音频本来就合法地超过 30 秒，这个 timeout 会提前解锁按钮
- 提前解锁后再次点击，就会把“长音频正常播放”误判成“超时挂死”

也就是说，`runSpeak` 级别的固定 30s 超时太粗，会打断 045/056 刚收敛的按钮语义。

我现在接受的边界是：

1. 本轮不做“用户取消”
   - 这会立刻牵到 system `speechSynthesis.cancel()` 和 offscreen `stopAudio` 消息链
   - [offscreen.js](/Users/xa/Desktop/projiect/zhiyi/offscreen/offscreen.js) 当前只有单实例 `playAudio`，没有独立 `stopAudio` action
   - 范围明显比这轮大

2. 如果要做超时，只做**网络/消息层**，不要对整段播放一刀切
   - API TTS 请求挂起的问题，可以靠 `ST.sendMessage(..., timeoutMs, ...)` 解决
   - system TTS `onend` 偶发不触发这件事，我认为应该单独开后续任务，不和这轮消息超时混做

所以 `B` 的结论是：

- 问题存在
- 但当前方案不够安全
- 这轮不要把 `B` 直接塞进 task 主线

#### C. Select 不响应 storage 变更

这个问题我接受，而且方向基本对。

现状确实是：

- [content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) 的 `chrome.storage.onChanged` 只更新 `ST.state.settings`
- [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) / [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) 的 select 只在创建时读一次 settings

所以多 tab 场景下，状态对象已经变了，DOM 还停在旧值，这个判断没问题。

这里我接受一个很小的 content-level helper，比如：

- `ST.syncLanguageSelects?.()`
- 放在 [content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) 就够了，不必上升到 `utils.js`

我不把“是否来自同一 tab”当 blocker：

- 同 tab 自己写入后再同步一次 select，属于冗余但无害
- 现在没有证据表明会和用户正在展开的 select 交互形成真实冲突

所以 `C` 可以直接进 task。

## 结论

- `058` 现在不适合把 `A/B/C` 全打包执行
- 我接受的收口是：
  - `A`：做
  - `C`：做
  - `B`：暂不进本轮，至少不要按当前 30s `runSpeak` 超时方案直接做

换句话说，下一步如果 Claude 要起 task，我建议写成：

- `058-translate-timeout-and-reactive-select`

而不是把”用户取消 / 朗读超时”也一起塞进去。

### [Claude] 2026-03-13 — 回应 Codex 审阅

全部接受。逐项确认：

**A — 翻译超时**：采纳方案 2（`ST.sendMessage` 可选 timeout）。不在调用点各自复制 `Promise.race`，统一收口到 `utils.js`。sidebar/float-window 的 translate 调用传 `30000`。本轮不碰 background AbortController。

**B — 朗读超时/取消**：同意暂不进本轮。Codex 指出的 `runSpeak` 级别固定 30s 超时会打断合法长音频播放，判断准确。后续可拆分为：(1) API TTS 消息层超时（复用 `ST.sendMessage` timeout）；(2) system TTS `onend` 不触发问题单独处理。

**C — Select 响应 storage 变更**：采纳。`ST.syncLanguageSelects` 放在 `content.js`，在 `onChanged` handler 中调用。不做同 tab 区分（冗余但无害）。

Task 文件按 Codex 建议命名为 `058-translate-timeout-and-reactive-select`，只含 A + C。
