import test from 'node:test';
import assert from 'node:assert/strict';

import {
    SHORTCUT_SETTINGS_URL,
    buildSettingsSnapshot,
    getSaveButtonLabel,
    getShortcutSettingsToastMessage,
    hasUnsavedChanges,
} from '../options/options-ui-state.js';

test('hasUnsavedChanges returns false for identical settings snapshots', () => {
    const baseline = buildSettingsSnapshot({
        targetLang: 'zh',
        enableSelection: true,
        enableShortcut: true,
        showFloatingBall: false,
        enableAdBlock: false,
        provider: 'google',
        openaiApiKey: '',
        openaiBaseUrl: 'https://api.openai.com/v1',
        openaiModel: 'gpt-4o-mini',
        geminiApiKey: '',
        geminiModel: 'gemini-2.5-flash',
        deepseekApiKey: '',
        deepseekBaseUrl: 'https://api.ppinfra.com/openai',
        deepseekModel: 'deepseek/deepseek-ocr',
        darkMode: false,
        debugMode: false,
        ttsProvider: 'system',
        ttsSpeed: 1,
        ttsVoice: '',
    });

    assert.equal(hasUnsavedChanges(baseline, { ...baseline }), false);
});

test('hasUnsavedChanges returns true when any tracked setting changes', () => {
    const baseline = buildSettingsSnapshot({
        targetLang: 'zh',
        enableSelection: true,
        enableShortcut: true,
        showFloatingBall: false,
        enableAdBlock: false,
        provider: 'google',
        openaiApiKey: '',
        openaiBaseUrl: 'https://api.openai.com/v1',
        openaiModel: 'gpt-4o-mini',
        geminiApiKey: '',
        geminiModel: 'gemini-2.5-flash',
        deepseekApiKey: '',
        deepseekBaseUrl: 'https://api.ppinfra.com/openai',
        deepseekModel: 'deepseek/deepseek-ocr',
        darkMode: false,
        debugMode: false,
        ttsProvider: 'system',
        ttsSpeed: 1,
        ttsVoice: '',
    });

    const changed = {
        ...baseline,
        openaiApiKey: 'sk-test',
    };

    assert.equal(hasUnsavedChanges(baseline, changed), true);
});

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

test('shortcut guidance toast message reflects clipboard success or fallback', () => {
    assert.equal(
        getShortcutSettingsToastMessage(true),
        '已复制快捷键设置地址，请粘贴到浏览器地址栏打开',
    );
    assert.equal(
        getShortcutSettingsToastMessage(false),
        `请在浏览器地址栏输入 ${SHORTCUT_SETTINGS_URL}`,
    );
});

test('save button label highlights pending unsaved changes', () => {
    assert.equal(getSaveButtonLabel(false), '保存并应用配置');
    assert.equal(getSaveButtonLabel(true), '保存并应用配置（有未保存更改）');
});
