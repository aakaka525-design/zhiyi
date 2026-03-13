---
status: done
priority: P1
created: 2026-03-13
discussion: 035-settings-trim-and-voice-dup
---

# 035 — Settings snapshot 字符串字段 trim

## 背景

035 讨论确认：`options.js` 的测试函数（`testApiConnection()`、`requestTtsTestAudio()`）对 API Key / BaseUrl 做了 `.trim()`，但保存路径 `collectCurrentSettings()` → `buildSettingsSnapshot()` 没有 trim。用户粘贴带尾部空白的 key 时，测试通过但保存后翻译失败（API 返回 401）。

修复点在 `buildSettingsSnapshot()`（`options/options-ui-state.js`），这是规范化的唯一收口点，布尔值和数字已经在此强转，字符串 trim 是自然延伸。

---

## 任务 A：`buildSettingsSnapshot()` 对自由输入字符串加 `.trim()`

**文件**：`options/options-ui-state.js:3-25`

**当前**：

```javascript
openaiApiKey: settings.openaiApiKey || '',
openaiBaseUrl: settings.openaiBaseUrl || '',
openaiModel: settings.openaiModel || '',
geminiApiKey: settings.geminiApiKey || '',
geminiModel: settings.geminiModel || '',
deepseekApiKey: settings.deepseekApiKey || '',
deepseekBaseUrl: settings.deepseekBaseUrl || '',
deepseekModel: settings.deepseekModel || '',
ttsVoice: settings.ttsVoice || '',
```

**修复**：

```javascript
openaiApiKey: (settings.openaiApiKey || '').trim(),
openaiBaseUrl: (settings.openaiBaseUrl || '').trim(),
openaiModel: (settings.openaiModel || '').trim(),
geminiApiKey: (settings.geminiApiKey || '').trim(),
geminiModel: (settings.geminiModel || '').trim(),
deepseekApiKey: (settings.deepseekApiKey || '').trim(),
deepseekBaseUrl: (settings.deepseekBaseUrl || '').trim(),
deepseekModel: (settings.deepseekModel || '').trim(),
ttsVoice: (settings.ttsVoice || '').trim(),
```

注意：
- `targetLang`、`provider`、`ttsProvider` 是下拉框选值，不会有空白，不需要 trim
- `ttsVoice` 虽然也是选值，但为保持一致性可以 trim（无害）
- 不改 `collectCurrentSettings()`，它保持只负责收集

---

## 任务 B：补测试

**文件**：`tests/options-ui-state.test.mjs`

新增测试用例：

### B1. `buildSettingsSnapshot()` 会 trim 带空白的字符串字段

```javascript
test('buildSettingsSnapshot trims whitespace from string fields', () => {
    const snapshot = buildSettingsSnapshot({
        targetLang: 'zh',
        enableSelection: true,
        enableShortcut: true,
        showFloatingBall: false,
        enableAdBlock: false,
        provider: 'openai',
        openaiApiKey: '  sk-abc123  \n',
        openaiBaseUrl: ' https://api.openai.com/v1 ',
        openaiModel: ' gpt-4o-mini\t',
        geminiApiKey: ' gemini-key ',
        geminiModel: ' gemini-2.5-flash ',
        deepseekApiKey: '\n deepseek-key \n',
        deepseekBaseUrl: ' https://api.ppinfra.com/openai ',
        deepseekModel: ' deepseek-chat ',
        darkMode: false,
        debugMode: false,
        ttsProvider: 'system',
        ttsSpeed: 1,
        ttsVoice: ' voice-name ',
    });

    assert.equal(snapshot.openaiApiKey, 'sk-abc123');
    assert.equal(snapshot.openaiBaseUrl, 'https://api.openai.com/v1');
    assert.equal(snapshot.openaiModel, 'gpt-4o-mini');
    assert.equal(snapshot.geminiApiKey, 'gemini-key');
    assert.equal(snapshot.geminiModel, 'gemini-2.5-flash');
    assert.equal(snapshot.deepseekApiKey, 'deepseek-key');
    assert.equal(snapshot.deepseekBaseUrl, 'https://api.ppinfra.com/openai');
    assert.equal(snapshot.deepseekModel, 'deepseek-chat');
    assert.equal(snapshot.ttsVoice, 'voice-name');
});
```

### B2. `hasUnsavedChanges()` 对仅有空白差异的 snapshot 返回 `false`

```javascript
test('hasUnsavedChanges returns false when difference is only whitespace', () => {
    const base = buildSettingsSnapshot({
        targetLang: 'zh',
        enableSelection: true,
        enableShortcut: true,
        showFloatingBall: false,
        enableAdBlock: false,
        provider: 'openai',
        openaiApiKey: 'sk-abc123',
        openaiBaseUrl: 'https://api.openai.com/v1',
        openaiModel: 'gpt-4o-mini',
        geminiApiKey: '',
        geminiModel: 'gemini-2.5-flash',
        deepseekApiKey: '',
        deepseekBaseUrl: 'https://api.ppinfra.com/openai',
        deepseekModel: 'deepseek-chat',
        darkMode: false,
        debugMode: false,
        ttsProvider: 'system',
        ttsSpeed: 1,
        ttsVoice: '',
    });

    const withWhitespace = buildSettingsSnapshot({
        ...base,
        openaiApiKey: '  sk-abc123  \n',
        openaiBaseUrl: ' https://api.openai.com/v1 ',
    });

    assert.equal(hasUnsavedChanges(base, withWhitespace), false);
});
```

---

## 不做的事

- 不改 `collectCurrentSettings()` 的收集逻辑
- 不改测试函数的 trim（它们已经正确）
- 不改输入框视觉值（UX polish，不是 bugfix 必要项）
- 不碰 Google TTS voice 默认值重复（B 部分停留在 discussion）
- 不碰 CSS / TTS / immersive / sidebar

---

## 验收标准

- [x] `buildSettingsSnapshot()` 对 `openaiApiKey`、`openaiBaseUrl`、`openaiModel`、`geminiApiKey`、`geminiModel`、`deepseekApiKey`、`deepseekBaseUrl`、`deepseekModel`、`ttsVoice` 做 `.trim()`
- [x] 测试覆盖带空白字符串被 trim
- [x] 测试覆盖 `hasUnsavedChanges()` 对仅空白差异返回 `false`
- [x] 现有测试不受影响
