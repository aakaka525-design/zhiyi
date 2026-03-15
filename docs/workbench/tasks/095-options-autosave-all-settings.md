---
task: "095"
status: done
priority: P2
created: 2026-03-15
scope: "设置页全量自动保存 — 两条独立 partial save 路径"
---

# 095 — 设置页全量自动保存

## 范围

所有设置改为自动保存，不再需要手动点击底部"保存并应用配置"按钮。两条完全独立的保存路径，互不干扰。

---

## 改动

### 1. 新增 Text 层 autosave 管理

**文件：`options/options.js`**

在 `saveImmediateToggle` 函数之后添加：

```javascript
let pendingTextChanges = {};
let textAutosaveTimer = null;

function queueTextAutosave(partial) {
    Object.assign(pendingTextChanges, partial);
    if (textAutosaveTimer) clearTimeout(textAutosaveTimer);
    textAutosaveTimer = setTimeout(flushTextAutosave, 800);
}

async function flushTextAutosave() {
    if (textAutosaveTimer) {
        clearTimeout(textAutosaveTimer);
        textAutosaveTimer = null;
    }
    const changes = pendingTextChanges;
    pendingTextChanges = {};
    if (Object.keys(changes).length === 0) return;
    try {
        await chrome.runtime.sendMessage({ action: 'patchSettings', updates: changes });
        initialSettingsSnapshot = buildSettingsSnapshot({ ...initialSettingsSnapshot, ...changes });
        refreshDirtyState();
        showToast('已自动保存');
    } catch (err) {
        console.error('[智译] 自动保存失败:', err);
        showToast('自动保存失败: ' + err.message, 'error');
    }
}
```

### 2. `bindDirtyTracking` 改造

**改前**：所有字段只绑 `refreshDirtyState`，不触发保存。

**改后**：三层分别绑定。

```javascript
function bindDirtyTracking() {
    // Toggle 层 — 已各自绑定 saveImmediateToggle，此处不重复绑定
    const toggleFields = new Set([
        elements.enableDarkMode,
        elements.enableDebugMode,
        elements.showOriginal,
    ]);

    // Select/Range 层 — change 立即 partial save
    const selectFields = [
        elements.targetLang,
        elements.provider,
        elements.enableSelection,
        elements.enableShortcut,
        elements.showFloatingBall,
        elements.enableAdBlock,
        elements.ttsProvider,
        elements.ttsSpeed,
        elements.ttsVoiceOpenai,
        elements.ttsVoiceGoogle,
        elements.ttsVoiceGlm,
    ];

    // Text 层 — input debounced partial save
    const textFields = [
        elements.openaiApiKey,
        elements.openaiBaseUrl,
        elements.openaiModel,
        elements.geminiApiKey,
        elements.geminiModel,
        elements.deepseekApiKey,
        elements.deepseekBaseUrl,
        elements.deepseekModel,
    ];

    // Select 层：change → refreshDirtyState + 立即 partial save
    selectFields.forEach((field) => {
        if (!field || toggleFields.has(field)) return;
        field.addEventListener('change', () => {
            refreshDirtyState();
            // 构造 partial：checkbox 用 checked，其他用 value
            const key = getFieldKey(field);
            if (!key) return;
            const value = field.type === 'checkbox' ? field.checked
                : field.type === 'range' ? parseFloat(field.value)
                : field.value;
            saveImmediateToggle({ [key]: value });
        });
    });

    // Text 层：input → refreshDirtyState + debounced partial save
    textFields.forEach((field) => {
        if (!field) return;
        field.addEventListener('input', () => {
            refreshDirtyState();
            const key = getFieldKey(field);
            if (!key) return;
            queueTextAutosave({ [key]: field.value });
        });
    });
}
```

### 3. 字段 → 设置键映射

```javascript
const FIELD_KEY_MAP = {
    'default-target-lang': 'targetLang',
    'default-provider': 'provider',
    'enable-selection': 'enableSelection',
    'enable-shortcut': 'enableShortcut',
    'show-floating-ball': 'showFloatingBall',
    'enable-ad-block': 'enableAdBlock',
    'openai-api-key': 'openaiApiKey',
    'openai-base-url': 'openaiBaseUrl',
    'openai-model': 'openaiModel',
    'gemini-api-key': 'geminiApiKey',
    'gemini-model': 'geminiModel',
    'deepseek-api-key': 'deepseekApiKey',
    'deepseek-base-url': 'deepseekBaseUrl',
    'deepseek-model': 'deepseekModel',
    'tts-provider': 'ttsProvider',
    'tts-speed': 'ttsSpeed',
    'tts-voice-openai': 'ttsVoiceOpenai',
    'tts-voice-google': 'ttsVoiceGoogle',
    'tts-voice-glm': 'ttsVoiceGlm',
};

function getFieldKey(element) {
    return FIELD_KEY_MAP[element.id] || null;
}
```

### 4. 保存按钮改为 flush 入口

```javascript
// 改前
elements.saveBtn.addEventListener('click', saveSettings);

// 改后
elements.saveBtn.addEventListener('click', flushTextAutosave);
```

`saveSettings()` 保留不删（兜底），但不再由按钮直接触发。

### 5. `beforeunload` 保留 + best-effort flush

```javascript
function handleBeforeUnload(event) {
    if (Object.keys(pendingTextChanges).length > 0) {
        flushTextAutosave(); // best-effort，不能 await
        event.preventDefault();
        event.returnValue = '';
    }
}
```

---

## 三层保存路径总结

| 层 | 字段 | 事件 | 保存函数 | 队列 |
|----|------|------|----------|------|
| Toggle | darkMode, debugMode, showOriginal | `change` | `saveImmediateToggle` | 无（立即） |
| Select/Range | provider, targetLang, ttsProvider, ttsSpeed, ttsVoice*, enableSelection, enableShortcut, showFloatingBall, enableAdBlock | `change` | `saveImmediateToggle` | 无（立即） |
| Text | API keys, baseUrls, models | `input` | `queueTextAutosave` → `flushTextAutosave` | `pendingTextChanges`（800ms debounce） |

Toggle 和 Select/Range 共用 `saveImmediateToggle`（独立 partial，不碰 `pendingTextChanges`）。Text 有自己的独立队列。**互不干扰**。

---

## 约束

1. **两条保存路径完全独立**：Toggle/Select 的 `saveImmediateToggle` 不碰 `pendingTextChanges`
2. **不改** `saveImmediateToggle` 函数本身
3. **不删** `saveSettings()` 函数（保留为兜底）
4. **保留** `beforeunload`（best-effort flush）
5. **不碰** immersive.js、content.js、content.css、storage.js

---

## 测试

**文件：`tests/095-options-autosave.test.mjs`**

### 静态断言

1. JS 包含 `queueTextAutosave` 函数定义
2. JS 包含 `flushTextAutosave` 函数定义
3. JS 包含 `FIELD_KEY_MAP` 或等效的字段映射
4. JS 保存按钮绑定包含 `flushTextAutosave`

### Runtime harness（如 Node harness 支持）

5. `queueTextAutosave` 累积 partial 到 `pendingTextChanges`
6. `flushTextAutosave` 发送累积的 changes 并清空 pending
7. `flushTextAutosave` 对空 pending 不发送请求

全量 `node --test tests/*.test.mjs` 必须通过。

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `options/options.js` | autosave 管理 + bindDirtyTracking 改造 + 按钮改为 flush |
| `tests/095-options-autosave.test.mjs` | 新增测试 |
