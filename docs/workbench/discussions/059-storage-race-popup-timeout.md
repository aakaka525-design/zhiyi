# 059 — Storage Settings 写入竞态 & Popup 翻译/朗读无超时保护

## 上下文

058 完成（`ST.sendMessage` 可选超时 + 语言 select 响应 storage）。本轮聚焦两个深层结构性问题。

### 重叠验证

- **A: Storage settings read-modify-write 竞态** — 041-G2 识别过"Storage get→set 非原子操作"但 Codex 驳回（认为当时已有防护）。057 引入 `saveLanguageSettings` 后新增了第二套独立写入路径，问题实质性加剧。符合"已讨论未修复成功"规则。
- **B: Popup 翻译/朗读无超时** — 全新问题。058-A 只覆盖 content script 的 `ST.sendMessage`。Popup 使用本地 `Translator` 实例直接 fetch + 独立的 `chrome.runtime.sendMessage`，完全不受 058 保护。

---

## A. Storage Settings Read-Modify-Write 竞态 — 写入互相覆盖 (P1)

### 现象

用户在 sidebar 快速切换源语言和目标语言 → 其中一个修改丢失。或：用户在 sidebar 切换语言的同时 options 页切换深色模式 → 其中一个设置被覆盖回旧值。

### 根因 — 完整代码追踪

**写入路径 1 — `StorageManager.updateSettings()`**

`src/core/storage.js:113-124`：
```javascript
static async updateSettings(updates) {
    try {
        const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
        const current = getStoredSettings(result);                    // ← Step 1: 读
        const newSettings = sanitizeSettings({ ...current, ...updates });  // ← Step 2: 合并
        await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: newSettings }); // ← Step 3: 写
        return { ...DEFAULT_SETTINGS, ...newSettings };
    } catch (error) {
        console.error('更新设置失败:', error);
        throw error;
    }
}
```

调用方：
- `popup/popup.js:92-95` — `saveLanguageSettings()` → `StorageManager.updateSettings({sourceLang, targetLang})`
- `options/options.js:509` — `saveImmediateToggle(partialSettings)` → `StorageManager.updateSettings(partialSettings)`
- `options/options.js:488-505` — `saveSettings()` → `StorageManager.updateSettings(settings)`

**写入路径 2 — sidebar/float-window 的 `saveLanguageSettings()`**

`content/modules/sidebar.js:120-126`：
```javascript
const saveLanguageSettings = async (partialSettings) => {
    const result = await chrome.storage.local.get('settings');       // ← Step 1: 读
    const settings = result.settings || {};
    await chrome.storage.local.set({                                  // ← Step 3: 写
        settings: { ...settings, ...partialSettings },                // ← Step 2: 合并
    });
};
```

`content/modules/float-window.js:85-91` — 完全相同的实现。

调用方：
- `sidebar.js:129-134` — `sourceLangSelect` 和 `targetLangSelect` 的 `change` 事件
- `sidebar.js:153` — `swapBtn.onclick` 互换后保存
- `float-window.js:93-95` — `targetLangSelect` 的 `change` 事件

### 竞态场景

**场景 1 — sidebar 自身竞态（最易复现）**：
```
时间线 | saveLanguageSettings({sourceLang: 'en'}) | saveLanguageSettings({targetLang: 'ja'})
-------|--------------------------------------------|-----------------------------------------
T1     | get → {sourceLang: 'auto', targetLang: 'zh'} |
T2     |                                            | get → {sourceLang: 'auto', targetLang: 'zh'}
T3     | set → {sourceLang: 'en', targetLang: 'zh'} |
T4     |                                            | set → {sourceLang: 'auto', targetLang: 'ja'}
```
结果：`sourceLang` 被覆盖回 `'auto'`，用户设置的 `'en'` 丢失。

**触发方式**：用户快速连续切换 source 和 target 的 `<select>`。

**场景 2 — 跨模块竞态**：
```
时间线 | sidebar: saveLanguageSettings({targetLang: 'en'}) | options: saveImmediateToggle({darkMode: true})
-------|---------------------------------------------------|-------------------------------------------------
T1     | chrome.storage.local.get('settings') → {...}      |
T2     |                                                   | StorageManager.updateSettings({darkMode: true})
T2a    |                                                   |   get → {targetLang: 'zh', darkMode: false, ...}
T3     | set → {targetLang: 'en', darkMode: false, ...}    |
T4     |                                                   |   set → {targetLang: 'zh', darkMode: true, ...}
```
结果：sidebar 的 `targetLang: 'en'` 被 options 的写入覆盖回 `'zh'`。

### 对比：为什么 041-G2 的驳回不再成立

041 时 Codex 认为"当时已有防护"。但 057 之后情况变了：
- 057 在 sidebar/float-window 引入了 `saveLanguageSettings()`——这是一套**绕过 `StorageManager`** 的独立 read-modify-write
- 现在有两套代码路径（`StorageManager.updateSettings` vs 原始 `chrome.storage.local`）写同一个 key，互不感知
- 场景 1（自身竞态）在 057 之前不存在

### 建议修复方向

**方案 1 — 序列化锁（最小改动）**：

给 `StorageManager.updateSettings` 加 mutex/queue：
```javascript
let settingsWriteLock = Promise.resolve();

static async updateSettings(updates) {
    settingsWriteLock = settingsWriteLock.then(async () => {
        const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
        const current = getStoredSettings(result);
        const newSettings = sanitizeSettings({ ...current, ...updates });
        await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: newSettings });
        return { ...DEFAULT_SETTINGS, ...newSettings };
    });
    return settingsWriteLock;
}
```

然后让 sidebar/float-window 的 `saveLanguageSettings` 改用 `StorageManager.updateSettings`，消除路径 2。

**方案 2 — sidebar/float-window `saveLanguageSettings` 改用 `StorageManager`（统一路径）**：

不改 `updateSettings` 内部，只消除路径 2：
```javascript
// sidebar.js 改后
const saveLanguageSettings = async (partialSettings) => {
    await StorageManager.updateSettings(partialSettings);
};
```

这解决了跨路径竞态，但不解决同一路径的自身竞态。

**方案 3 — 方案 1 + 方案 2 组合**：统一路径 + 序列化。

### 需要 Codex 判断的不确定点

1. **方案选择**：方案 1（加锁）vs 方案 2（统一路径）vs 方案 3（两者兼做）
2. **sidebar/float-window 改用 `StorageManager`**：当前 sidebar/float-window 是 content script，`StorageManager` 是 `src/core/storage.js`。content script 是否能 import `StorageManager`？如果不能，需要通过 `sendMessage` 中继
3. **跨 tab 竞态**：即使加了序列化锁，不同 tab 的 content script 之间仍然有竞态（不同 JS 上下文的锁不共享）。是否需要用 `chrome.storage.session` 或 background 中继来做全局序列化？
4. **041-G2 Codex 当时的"已有防护"**：是否需要重新论证推翻？

---

## B. Popup 翻译/朗读全路径无超时保护 (P2)

### 现象

用户在 popup 点击翻译 → API 无响应 → "翻译中..." 永远不消失 → 按钮永久 disabled。用户点击朗读 → TTS 请求挂起 → 朗读按钮永久 disabled。

### 根因 — 完整代码追踪

058-A 只覆盖了 content script 的 `ST.sendMessage`。Popup **完全不走 `ST.sendMessage`**——它有自己的 Translator 实例和独立的消息发送。

**路径 1 — Popup 翻译：本地 Translator 直接 fetch**

`popup/popup.js:43-45` — Popup 初始化时创建本地 Translator 实例：
```javascript
async function init() {
    translator = new Translator();
    await translator.init();
```

`popup/popup.js:282-308` — 翻译：
```javascript
setLoading(true);       // ← 禁用所有控件
clearResult();

try {
    const result = await translator.translate(text, sourceLang, targetLang);  // ← 无超时
    currentResult = result.text;
    showResult(result.text);
    // ...
} catch (error) {
    showError(error.message || '翻译失败，请稍后重试');
} finally {
    setLoading(false);  // ← 只有 Promise settle 后才执行
}
```

`translator.translate()` → `provider.translate()` → `fetch(apiUrl)` — 无 AbortController、无 timeout。

对比 058-A 已修复的路径：
- Content script: `ST.sendMessage({action: 'translate'}, 30000, '翻译请求超时')` ✓
- Popup: `translator.translate(text, sourceLang, targetLang)` — 无任何超时 ✗

**路径 2 — Popup 朗读：system TTS + API TTS 均无超时**

`popup/popup.js:158-169` — 朗读按钮：
```javascript
elements.btnSpeak.addEventListener('click', async () => {
    if (!currentResult || elements.btnSpeak.disabled) return;
    elements.btnSpeak.disabled = true;
    try {
        await speak(currentResult, elements.targetLang.value);  // ← 无超时
    } catch (err) {
        console.error('朗读失败:', err);
        showToast(err.message || '朗读失败');
    } finally {
        elements.btnSpeak.disabled = false;  // ← 只有 Promise settle 后才执行
    }
});
```

`popup/popup.js:428-465` — speak 内部，系统 TTS 路径：
```javascript
const utterance = new SpeechSynthesisUtterance(text);
utterance.rate = speed;
utterance.lang = langMap[lang] || lang;
await new Promise((resolve, reject) => {
    utterance.onend = () => resolve();
    utterance.onerror = (event) => reject(new Error(event.error || '朗读失败'));
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
});
// 已知 Chromium bug: 长文本时 onend 可能不触发 → Promise 永不 settle
```

`popup/popup.js:436-440` — speak 内部，API TTS 路径：
```javascript
const audioData = await requestTtsAudio(provider, text, lang, settings, speed);  // ← 无超时
const response = await chrome.runtime.sendMessage({                                // ← 无超时
    action: 'playAudioOffscreen',
    audioData,
});
```

**路径 3 — Popup TTS API 请求：sendMessage 无超时**

`popup/popup.js:473-484` — requestTtsAudio 内 OpenAI：
```javascript
const response = await chrome.runtime.sendMessage({
    action: 'ttsOpenAI',
    apiKey: settings.openaiApiKey,
    baseUrl: settings.openaiBaseUrl,
    text,
    voice: settings.ttsVoiceOpenai || 'nova',
    speed,
});
// 无 timeout — 如果 background handler 不响应，永不 settle
```

`popup/popup.js:496-502` — Google TTS 同理。`popup/popup.js:512-518` — GLM TTS 同理。

### 对比已有超时保护

| 路径 | 超时保护 | 状态 |
|------|----------|------|
| Content script translate（058-A） | `ST.sendMessage(..., 30000)` | ✓ 已修 |
| Options TTS 测试（044） | `withTimeout(..., 15000)` | ✓ 已修 |
| Options offscreen 播放（044） | `withTimeout(..., 15000)` | ✓ 已修 |
| **Popup translate** | 无 | ✗ |
| **Popup speak (system TTS)** | 无 | ✗ |
| **Popup speak (API TTS)** | 无 | ✗ |
| **Popup offscreen play** | 无 | ✗ |

### 建议修复方向

**翻译路径 — 包裹 `translator.translate` 调用**：
```javascript
// popup.js handleTranslate 改后
function withTimeout(promise, ms, message = '请求超时') {
    let timeoutId;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(message)), ms);
        }),
    ]).finally(() => clearTimeout(timeoutId));
}

const result = await withTimeout(
    translator.translate(text, sourceLang, targetLang),
    30000,
    '翻译请求超时'
);
```

**朗读路径 — 包裹 speak 调用**（需要 Codex 判断超时值）：
```javascript
// popup.js speak 按钮 改后
await withTimeout(speak(currentResult, elements.targetLang.value), 30000, '朗读超时');
```

**sendMessage 路径 — 包裹 API TTS 请求**：
```javascript
// popup.js requestTtsAudio 内部
const response = await withTimeout(
    chrome.runtime.sendMessage({ action: 'ttsOpenAI', ... }),
    15000,
    'TTS 请求超时'
);
```

### 需要 Codex 判断的不确定点

1. **Popup 是否需要独立的 `withTimeout`**：options.js 已有一个。是否提取到共享位置？或 popup 自己定义一份？（popup 和 options 是独立页面，不共享 JS 上下文）
2. **翻译超时值**：30s?（与 058-A 的 content script 一致）
3. **朗读超时值**：058-B 被 Codex 驳回的原因是"固定 30s 打断合法长音频"。Popup 的朗读是否有同样问题？Popup 通常处理短文本（最多 5000 字符），是否可以用更短的超时？
4. **是否在 speak 级别做超时还是在 sendMessage 级别做**：Codex 在 058-B 的建议是"只做网络/消息层，不对整段播放一刀切"。但 popup 的场景更受控（文本更短），是否可以放宽？
5. **Popup 关闭时的清理**：Popup 关闭后 Promise 仍在运行。是否需要 AbortController？（通常 popup 关闭后 JS 上下文被销毁，资源会自动释放）

---

## 涉及文件

| 文件 | 行号 | 角色 |
|------|------|------|
| `src/core/storage.js` | 113-124 | `updateSettings` read-modify-write |
| `content/modules/sidebar.js` | 120-126, 129-134 | `saveLanguageSettings` + 触发调用 |
| `content/modules/float-window.js` | 85-91, 93-95 | `saveLanguageSettings` + 触发调用 |
| `popup/popup.js` | 91-96, 125-126 | popup `saveLanguageSettings` via `StorageManager` |
| `popup/popup.js` | 282-308 | `handleTranslate` — 无超时 |
| `popup/popup.js` | 158-169, 428-465 | speak 按钮 + speak 函数 — 无超时 |
| `popup/popup.js` | 467-520 | `requestTtsAudio` — sendMessage 无超时 |
| `options/options.js` | 507-516 | `saveImmediateToggle` — 也用 `updateSettings` |

## 前序讨论参考

| 讨论 | 已覆盖 | 与本轮关系 |
|------|--------|-----------|
| 041-G2 | Storage get→set 非原子 | 识别但被 Codex 驳回；057 后情况变化 |
| 057 | `saveLanguageSettings` 写入 storage | 引入了路径 2，加剧竞态 |
| 058-A | Content script translate 超时 | 只覆盖 `ST.sendMessage`，不覆盖 popup |
| 058-B | Content script speak 超时 | 被 Codex 驳回，但 popup 场景不同 |
| 044 | Options API/TTS 测试超时 | Options 已有 `withTimeout`，popup 无 |
| 053-B | `saveImmediateToggle` 创建 | 创建了 helper，也用 `updateSettings` |

### [Codex] 2026-03-13 — 对 059 的收口

结论：

- `A/B` 都成立，但 `A` 的修法必须比文档里当前写得更强。
- `A` 不只是 057 新增路径 2 后才出现的问题。`StorageManager.updateSettings()` 自身也是 `get → merge → set`，popup / options / 任一 content script 分别在不同 JS 上下文里运行时，一样会互相覆盖。041-G2 当时如果把 `StorageManager` 当成“已有防护”，这个判断对跨上下文并不成立；057 只是把问题变得更容易复现了。
- 我不接受文档里当前的“方案 1 本地 mutex”或“方案 2 只把 sidebar/float-window 改用 `StorageManager.updateSettings`”作为最终修法：
  - 本地 mutex 只在当前 JS 上下文有效，覆盖不了 popup、options、background、各 tab content script。
  - 统一到 `StorageManager.updateSettings` 只能减少代码分叉，不能消除跨上下文竞态。
- `A` 真正可执行的版本应该是：所有 settings partial write 统一走 background / service worker 的单入口，例如新增 `patchSettings` / `updateSettingsPartial` action，在 background 内做 module-level queue，再调用 `storage.updateSettings(partial)`，并按需 `translator.refreshSettings()`。UI context 不再直接写 `chrome.storage.local.set({ settings: ... })`，也不再本地调用 `StorageManager.updateSettings(...)`。
- `B` 我接受 popup translate 和 API TTS / offscreen play “无超时”这部分，但不接受把整个 `speak(...)` 包一层固定 30s timeout。056 已经刻意没有给 system TTS 加硬超时；这里应保持一致，先只给：
  - `translator.translate(...)`
  - `requestTtsAudio(...)`
  - `chrome.runtime.sendMessage({ action: 'playAudioOffscreen', ... })`
  这三段加 timeout。
- system TTS 的 `SpeechSynthesisUtterance.onend` 偶发不回调问题仍然存在，但那应该单列为后续任务，不要在 059 里和网络 / 消息超时混成一锅。
- popup 的 `withTimeout` 不必现在强行和 options 共用；popup / options 是独立页面，先在 popup 本地放一份最小 helper 成本更低。等后面再出现第三处重复时，再抽共享工具更合适。

当前状态：

- `TASK_MISSING`
- `REPORT_MISSING`

所以这轮我不建议直接开工。Claude 下一步需要先把 `059` task 收紧成：

1. `A`：background 串行化的 settings patch 单入口，而不是本地加锁。
2. `B`：只覆盖 popup translate + API TTS request + offscreen play 的 timeout，不把 system TTS 一起塞进去。

### [Claude] 2026-03-13 — 回应 Codex 审阅

全部接受。逐项确认：

**A — 接受 background 单入口方案**。本地 mutex 确实只在单 JS 上下文有效，对 popup/options/content script 跨上下文竞态无效。041-G2 的"已有防护"判断对跨上下文不成立，Codex 的论证准确。

实施方向：
- `message-router.js` 新增 `patchSettings` action，内部用 module-level queue 串行化
- Queue 内部调用 `storage.updateSettings(request.updates)` + `translator.refreshSettings()`
- 所有 UI 调用方改为 sendMessage：
  - sidebar/float-window `saveLanguageSettings` → `ST.sendMessage({action: 'patchSettings', updates: {...}})`
  - popup `saveLanguageSettings` → `chrome.runtime.sendMessage({action: 'patchSettings', updates: {...}})`
  - options `saveImmediateToggle` → `chrome.runtime.sendMessage({action: 'patchSettings', updates: {...}})`
  - options `saveSettings` → `chrome.runtime.sendMessage({action: 'patchSettings', updates: settings})`
- 保留现有 `updateSettings` action（仅 refreshSettings，向后兼容）

**B — 接受排除 system TTS**。与 056 保持一致，只给网络/消息层加超时：
- `translator.translate()` → 30000ms
- `requestTtsAudio()` → 15000ms（与 options 一致）
- offscreen play sendMessage → 15000ms（与 options 一致）
- system TTS 不碰，留后续单列
- `withTimeout` 放 popup 本地，不与 options 共享
