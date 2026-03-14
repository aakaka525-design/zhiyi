import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('settings partial writes are routed through background patchSettings instead of local read-modify-write helpers', async () => {
    const router = await readWorkspaceFile('background/modules/message-router.js');
    const sidebar = await readWorkspaceFile('content/modules/sidebar.js');
    const floatWindow = await readWorkspaceFile('content/modules/float-window.js');
    const popup = await readWorkspaceFile('popup/popup.js');
    const options = await readWorkspaceFile('options/options.js');

    assert.match(
        router,
        /let settingsQueue = Promise\.resolve\(\);\s*export async function routeMessage\(request, deps\) \{\s*const \{ translator, storage, tts \} = deps;[\s\S]*case 'patchSettings': \{\s*const task = settingsQueue\.then\(async \(\) => \{\s*await storage\.updateSettings\(request\.updates\);\s*await translator\.refreshSettings\(\);\s*return \{ success: true \};\s*\}\);\s*settingsQueue = task\.catch\(\(\) => \{\}\);\s*return task;\s*\}[\s\S]*case 'updateSettings':\s*await translator\.refreshSettings\(\);\s*return \{ success: true \};/s,
    );

    assert.match(
        sidebar,
        /const saveLanguageSettings = \(partialSettings\) => \{\s*ST\.sendMessage\(\{ action: 'patchSettings', updates: partialSettings \}\);\s*\};/,
    );

    assert.match(
        floatWindow,
        /const saveLanguageSettings = \(partialSettings\) => \{\s*ST\.sendMessage\(\{ action: 'patchSettings', updates: partialSettings \}\);\s*\};/,
    );

    assert.match(
        popup,
        /function saveLanguageSettings\(\) \{\s*chrome\.runtime\.sendMessage\(\{\s*action: 'patchSettings',\s*updates: \{\s*sourceLang: elements\.sourceLang\.value,\s*targetLang: elements\.targetLang\.value,\s*\},\s*\}\);\s*\}/,
    );

    assert.match(
        options,
        /async function saveSettings\(\) \{\s*const current = collectCurrentSettings\(\);\s*const diff = \{\};[\s\S]*const response = await chrome\.runtime\.sendMessage\(\{ action: 'patchSettings', updates: diff \}\);[\s\S]*initialSettingsSnapshot = buildSettingsSnapshot\(\{ \.\.\.initialSettingsSnapshot, \.\.\.diff \}\);[\s\S]*showToast\('设置保存成功'\);[\s\S]*\}\s*catch \(err\) \{/s,
    );

    assert.match(
        options,
        /async function saveImmediateToggle\(partialSettings\) \{\s*try \{\s*await chrome\.runtime\.sendMessage\(\{ action: 'patchSettings', updates: partialSettings \}\);\s*initialSettingsSnapshot = buildSettingsSnapshot\(\{ \.\.\.initialSettingsSnapshot, \.\.\.partialSettings \}\);\s*refreshDirtyState\(\);/s,
    );
});

test('popup wraps translate and remote TTS paths with local timeout guards', async () => {
    const popup = await readWorkspaceFile('popup/popup.js');

    assert.match(
        popup,
        /function withTimeout\(promise, ms, message = '请求超时'\) \{\s*let timeoutId;\s*return Promise\.race\(\[\s*promise,\s*new Promise\(\(_, reject\) => \{\s*timeoutId = setTimeout\(\(\) => reject\(new Error\(message\)\), ms\);\s*\}\),\s*\]\)\.finally\(\(\) => clearTimeout\(timeoutId\)\);\s*\}/,
    );

    assert.match(
        popup,
        /const result = await withTimeout\(\s*translator\.translate\(text, sourceLang, targetLang\),\s*30000,\s*'翻译请求超时'\s*\);/,
    );

    assert.match(
        popup,
        /const audioData = await withTimeout\(\s*requestTtsAudio\(provider, text, lang, settings, speed\),\s*15000,\s*'TTS 请求超时'\s*\);/,
    );

    assert.match(
        popup,
        /const response = await withTimeout\(\s*chrome\.runtime\.sendMessage\(\{\s*action: 'playAudioOffscreen',\s*audioData,\s*\}\),\s*15000,\s*'播放超时'\s*\);/,
    );
});
