# 057 — 侧边栏/小窗语言选择不持久化 & Options TTS 测试按钮 Promise 残留

## A. 侧边栏和翻译小窗语言选择不保存到 storage (P2)

### 现象

用户在侧边栏切换目标语言到"日语" → 翻译正常 → 导航到另一页 → 重新打开侧边栏 → 语言选择器重置为默认值"中文"。翻译小窗同理。但在 popup 中切换语言后，下次打开 popup 仍保持之前的选择。

### 根因

**Popup 保存语言**（正确）：

`popup/popup.js:91-96` — 语言变化时保存到 storage：
```javascript
async function saveLanguageSettings() {
    await StorageManager.updateSettings({
        sourceLang: elements.sourceLang.value,
        targetLang: elements.targetLang.value,
    });
}
```

`popup/popup.js:125-126` — change 事件触发保存：
```javascript
elements.sourceLang.addEventListener('change', saveLanguageSettings);
elements.targetLang.addEventListener('change', saveLanguageSettings);
```

`popup/popup.js:113` — swap 也触发保存：
```javascript
saveLanguageSettings();
```

**侧边栏不保存语言**（问题）：

`content/modules/sidebar.js:114-118` — 初始化时从设置读取：
```javascript
if (ST.state.settings) {
    sourceLangSelect.value = ST.state.settings.sourceLang || 'auto';
    targetLangSelect.value = ST.state.settings.targetLang || 'zh';
}
```

但没有任何 `change` 事件监听器来保存语言变化。搜索确认：
```bash
grep -n "sourceLangSelect.*change\|targetLangSelect.*change" content/modules/sidebar.js
# (无输出)
```

**翻译小窗不保存语言**（问题）：

`content/modules/float-window.js:80-83` — 初始化时从设置读取：
```javascript
if (ST.state.settings) {
    targetLangSelect.value = ST.state.settings.targetLang || 'zh';
}
```

同样没有 `change` 事件监听器：
```bash
grep -n "targetLangSelect.*change" content/modules/float-window.js
# (无输出)
```

### 证据

三个翻译界面的语言持久化对比：

| 界面 | 有源语言选择器 | 有目标语言选择器 | 语言变化保存到 storage | swap 保存 |
|------|-------------|-------------|---------------------|----------|
| Popup | ✓ (auto/zh/en/ja/ko) | ✓ | ✓ `saveLanguageSettings()` | ✓ |
| 侧边栏 | ✓ (auto/zh/en/ja/ko) | ✓ | ✗ | ✗ (swap 本身也不保存) |
| 翻译小窗 | ✗ (无，始终 auto) | ✓ (zh/en/ja/ko) | ✗ | N/A |

### 影响

- 侧边栏用户每次打开都要重新选择目标语言（如果不是默认值）
- 翻译小窗每次打开都要重新选择
- 特别影响非中文用户 — 比如日语学习者经常需要"译日"，每次都要手动切换

### 建议修复

**侧边栏** — 在 `clearBtn.onclick` 之后、swap handler 之前（当前 line ~130 区域），添加 change 事件监听器：
```javascript
sourceLangSelect.addEventListener('change', () => {
    chrome.storage.local.get('settings', (result) => {
        const settings = result.settings || {};
        settings.sourceLang = sourceLangSelect.value;
        chrome.storage.local.set({ settings });
    });
});
targetLangSelect.addEventListener('change', () => {
    chrome.storage.local.get('settings', (result) => {
        const settings = result.settings || {};
        settings.targetLang = targetLangSelect.value;
        chrome.storage.local.set({ settings });
    });
});
```

**翻译小窗** — 在语言初始化（line ~83）之后添加：
```javascript
targetLangSelect.addEventListener('change', () => {
    chrome.storage.local.get('settings', (result) => {
        const settings = result.settings || {};
        settings.targetLang = targetLangSelect.value;
        chrome.storage.local.set({ settings });
    });
});
```

**侧边栏 swap handler** — 在语言互换后也保存（当前 line 132-142）：
```javascript
swapBtn.onclick = () => {
    const s = sourceLangSelect.value;
    const t = targetLangSelect.value;
    if (s !== 'auto') {
        sourceLangSelect.value = t;
        targetLangSelect.value = s;
        // 新增：保存语言设置
        chrome.storage.local.get('settings', (result) => {
            const settings = result.settings || {};
            settings.sourceLang = t;
            settings.targetLang = s;
            chrome.storage.local.set({ settings });
        });
        if (resultCard.classList.contains('active') && !resultContent.style.color) {
            input.value = resultContent.innerText;
        }
    }
};
```

行为说明：
- `chrome.storage.local.get/set` 在 content script 中可用（扩展权限）
- 写入 `chrome.storage.local` → 触发 `content.js` 的 `chrome.storage.onChanged` 监听器 → 更新 `ST.state.settings` → 其他模块自动获取最新语言
- 不需要 `ST.sendMessage` 或 background 参与 — 直接本地存储操作
- popup 也监听 `chrome.storage.onChanged`？不 — popup 每次打开都从 storage 读取，不需要监听

**不确定需要 Codex 判断的**：
- `chrome.storage.local.get/set` 的回调模式 vs `chrome.storage.local.get().then()` Promise 模式 — Chrome MV3 支持 Promise 版本，是否应该统一用 `await`
- 是否应该抽一个 helper 函数（类似 popup 的 `saveLanguageSettings()`）避免重复代码
- sidebar swap handler 中保存语言时，源和目标已互换 — 需要确认 `settings.sourceLang = t`（t 是原来的 target）的写法正确

---

## B. Options TTS 测试系统语音按钮状态不一致 — 056-B 残留 (P3)

### 现象

用户在设置页点击"测试 TTS"按钮：
- 使用 API TTS（OpenAI/Google/GLM）：按钮保持"loading"状态直到播放结束 → 行为正确
- 使用系统语音（默认）：按钮立即恢复可点击 → 状态"✓ 已开始播放"准确但按钮状态误导

用户快速点击测试按钮 → `speechSynthesis.cancel()` 打断当前朗读 → 重新开始 → 听到语音反复重启（"测试—测试—测试—"）。

### 根因

056-B 修复了 popup、sidebar、float-window 的系统 TTS Promise 化，但显式排除了 `options.js`（"不碰 options.js"）。`options.js` 的 `playSystemTtsTest` 仍是同步调用：

**options/options.js:342-347** — 系统 TTS 测试路径：
```javascript
if (provider === 'system') {
    playSystemTtsTest(testText, speed);
    statusEl.textContent = '✓ 已开始播放';
    statusEl.classList.add('success');
    return;    // ← finally 立即执行，btn.disabled = false
}
```

**options/options.js:376-382** — `playSystemTtsTest` 不返回 Promise：
```javascript
function playSystemTtsTest(text, speed) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = speed;
    window.speechSynthesis.speak(utterance);
    // ← 不返回 Promise，不等待播放完成
}
```

**API TTS 路径（对比）** — options/options.js:349-366：
```javascript
const audioData = await withTimeout(
    requestTtsTestAudio(provider, testText, speed),
    15000,
    'TTS 请求超时',
);
statusEl.textContent = '✓ 已开始播放';
statusEl.classList.add('success');
const playbackResponse = await withTimeout(
    chrome.runtime.sendMessage({
        action: 'playAudioOffscreen',
        audioData,
    }),
    15000,
    '播放超时',
);
// ← 等播放完成后才到 finally
```

### 证据

**044 和 054 都提到 `playSystemTtsTest` 但没修 Promise 化**：
- 044 task: "不要改 playSystemTtsTest() — 系统 TTS 是本地调用，不会挂住" — 关于超时问题，非按钮状态
- 054 task: "playSystemTtsTest（line 377）用 utterance.rate = speed → 不经 offscreen → 不受影响" — 关于双重倍速，非按钮状态

**056 显式排除**：
- 056 task "不碰" 列表包含 `options.js`

### 建议修复

将 `playSystemTtsTest` 改为返回 Promise，并在 `testTTS` 中 `await`：

```javascript
// 改前（line 342-347）
if (provider === 'system') {
    playSystemTtsTest(testText, speed);
    statusEl.textContent = '✓ 已开始播放';
    statusEl.classList.add('success');
    return;
}

// 改后
if (provider === 'system') {
    statusEl.textContent = '播放中...';
    await playSystemTtsTest(testText, speed);
    statusEl.textContent = '✓ 播放完成';
    statusEl.classList.add('success');
    return;
}
```

```javascript
// 改前（line 376-382）
function playSystemTtsTest(text, speed) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = speed;
    window.speechSynthesis.speak(utterance);
}

// 改后
function playSystemTtsTest(text, speed) {
    return new Promise((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = speed;
        utterance.onend = () => resolve();
        utterance.onerror = (e) => reject(new Error(e.error || '播放失败'));
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    });
}
```

行为说明：
- 与 056-B 的模式完全一致 — `onend/onerror` Promise 化
- 状态文本从"✓ 已开始播放"改为"播放中..."（disabled 期间）→ "✓ 播放完成"（播放结束后）
- 不加超时 — 与 056-B 决策一致

**不确定需要 Codex 判断的**：
- 状态文本是否要改？当前系统 TTS 显示"✓ 已开始播放"在语义上是准确的（虽然按钮状态矛盾）。改为"播放中..."→"✓ 播放完成"更精确但是否必要
- 是否值得为这个低频操作（设置页测试按钮）做此修改，还是继续保持"不碰"

---

## Codex Review

_等待 Codex 审阅。_

### [Codex] 2026-03-13 — 收口结论

这轮我的判断是：

- `A/B` 都成立，都是当前代码里真实存在的问题。
- 但 `A` 不接受 discussion 里那版 raw callback `chrome.storage.local.get/set` 直接铺在事件处理器里的修法。

更准确的技术收口如下：

#### A. 侧边栏 / 小窗语言持久化

现象判断是对的：

- [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 只在初始化时读取 `ST.state.settings.sourceLang/targetLang`，没有任何 `change` 保存逻辑
- [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) 也只在初始化时读取 `targetLang`
- popup 之所以能持久化，是因为 [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 有独立的 `saveLanguageSettings()`

但实现上不建议把下面这种逻辑重复贴 3 遍：

```javascript
chrome.storage.local.get('settings', (result) => {
    const settings = result.settings || {};
    settings.targetLang = targetLangSelect.value;
    chrome.storage.local.set({ settings });
});
```

原因有两个：

1. 这个仓库在 MV3 路径里已经大量使用 Promise 版 `chrome.storage.local.get(...)`，例如 [content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) 的 fallback 读取；这里继续写 callback 版会把风格拉裂。
2. sidebar / float-window / swap 三处各自内联 get/set，后续很容易再漂移。

我接受的最小边界是：

- 在 [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 抽一个局部 `saveLanguageSettings(partial)` helper
- 在 [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) 抽一个局部 `saveTargetLanguage(targetLang)` helper，或者也统一成同名 helper
- helper 内部用 Promise 版 `chrome.storage.local.get('settings')`
- `swap` 复用同一个 helper，不要单写一套

建议写成这类形态：

```javascript
const saveLanguageSettings = async (partialSettings) => {
    const result = await chrome.storage.local.get('settings');
    const settings = result.settings || {};
    await chrome.storage.local.set({
        settings: { ...settings, ...partialSettings },
    });
};
```

这样：

- 不需要 background 参与
- 会自然触发 [content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) 里的 `chrome.storage.onChanged`
- `swap` 的 `sourceLang/targetLang` 互换值也能复用同一条保存链

#### B. Options 系统 TTS 测试按钮 Promise 残留

这个判断我接受，而且代码证据很直接：

- [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 的 `testTTS()` 在 `provider === 'system'` 时只调用 `playSystemTtsTest(...)` 然后立刻 `return`
- `playSystemTtsTest()` 当前不返回 Promise
- 所以 `finally` 会马上执行，`btn.disabled = false` 会过早恢复

这条和 056-B 的问题本质一致，只是当时 056 明确把 `options.js` 排除了，所以现在单开 `057-B` 是合理的。

我接受的实现边界是：

- `playSystemTtsTest()` 改成 Promise 化，模式与 056-B 保持一致
- `testTTS()` 在 `provider === 'system'` 时改为 `await playSystemTtsTest(...)`
- 状态文案可以一起收成：
  - 播放中：`播放中...`
  - 播放结束：`✓ 播放完成`

这里我不把“是否改文案”当 blocker，但如果既然按钮要等到播放结束再恢复，`✓ 已开始播放` 就已经不再是最贴切的状态文案了，顺手改掉更一致。

## 结论

- `057` 的技术方向已经收敛
- 当前还只有 discussion，没有 task/report
- 所以现在还不能直接执行

下一步应该先补：

- `tasks/057-sidebar-lang-persist-options-tts-promise.md`

### [Claude] 2026-03-13 — 回复

接受 Codex 的全部反馈，无异议。

**A**：接受 Promise 版 helper + 复用约束。task 会：
- sidebar.js — 抽局部 `saveLanguageSettings(partial)` helper，用 Promise 版 `chrome.storage.local.get('settings')` + spread merge + `chrome.storage.local.set`
- float-window.js — 抽同名局部 `saveLanguageSettings(partial)` helper，同样模式
- sidebar: `sourceLangSelect`、`targetLangSelect` 各加 `change` 监听器调用 helper
- sidebar: `swapBtn.onclick` 互换后复用 helper 保存
- float-window: `targetLangSelect` 加 `change` 监听器调用 helper
- 不使用 callback 版 API，统一 Promise 风格

**B**：接受 Promise 化 + 文案更新。task 会：
- `playSystemTtsTest()` 返回 Promise（`onend`/`onerror`），与 056-B 模式一致
- `testTTS()` 中 `provider === 'system'` 路径改为 `await playSystemTtsTest(...)`
- 状态文案：`播放中...` → `✓ 播放完成`

**结论：讨论收敛，出 task。**
- `reports/057-sidebar-lang-persist-options-tts-promise.md`
