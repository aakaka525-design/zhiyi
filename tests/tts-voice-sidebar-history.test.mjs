import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { installChromeStub } from './helpers/chrome-stub.mjs';
import { StorageManager } from '../src/core/storage.js';

const { store, reset } = installChromeStub();

beforeEach(() => {
    reset();
});

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('storage migrates legacy ttsVoice into the provider-specific voice fields', async () => {
    store.settings = { ttsProvider: 'openai', ttsVoice: 'alloy' };
    let settings = await StorageManager.getSettings();
    assert.equal(settings.ttsVoiceOpenai, 'alloy');
    assert.equal(settings.ttsVoiceGoogle, '');
    assert.equal(settings.ttsVoiceGlm, '');
    assert.equal('ttsVoice' in settings, false);

    store.settings = { ttsProvider: 'google', ttsVoice: 'en-US-Chirp3-HD-Fenrir' };
    settings = await StorageManager.getSettings();
    assert.equal(settings.ttsVoiceOpenai, '');
    assert.equal(settings.ttsVoiceGoogle, 'en-US-Chirp3-HD-Fenrir');
    assert.equal(settings.ttsVoiceGlm, '');

    store.settings = { ttsProvider: 'glm', ttsVoice: 'tongtong' };
    settings = await StorageManager.getSettings();
    assert.equal(settings.ttsVoiceOpenai, '');
    assert.equal(settings.ttsVoiceGoogle, '');
    assert.equal(settings.ttsVoiceGlm, 'tongtong');
});

test('options snapshots and TTS consumers use provider-specific voice fields', async () => {
    const optionsUiState = await readWorkspaceFile('options/options-ui-state.js');
    const options = await readWorkspaceFile('options/options.js');
    const popup = await readWorkspaceFile('popup/popup.js');
    const sidebar = await readWorkspaceFile('content/modules/sidebar.js');
    const floatWindow = await readWorkspaceFile('content/modules/float-window.js');
    const content = await readWorkspaceFile('content/content.js');

    assert.match(optionsUiState, /ttsVoiceOpenai: settings\.ttsVoiceOpenai \|\| ''/);
    assert.match(optionsUiState, /ttsVoiceGoogle: settings\.ttsVoiceGoogle \|\| ''/);
    assert.match(optionsUiState, /ttsVoiceGlm: settings\.ttsVoiceGlm \|\| ''/);
    assert.doesNotMatch(optionsUiState, /ttsVoice: settings\.ttsVoice \|\| ''/);

    assert.match(options, /elements\.ttsVoiceOpenai\.value = settings\.ttsVoiceOpenai \|\| 'nova';/);
    assert.match(options, /elements\.ttsVoiceGoogle\.value = settings\.ttsVoiceGoogle \|\| 'cmn-CN-Chirp3-HD-Aoede';/);
    assert.match(options, /elements\.ttsVoiceGlm\.value = settings\.ttsVoiceGlm \|\| 'tongtong';/);
    assert.match(options, /function collectTtsVoices\(\) \{\s*return \{\s*ttsVoiceOpenai: elements\.ttsVoiceOpenai\.value,\s*ttsVoiceGoogle: elements\.ttsVoiceGoogle\.value,\s*ttsVoiceGlm: elements\.ttsVoiceGlm\.value,\s*\};\s*\}/);
    assert.match(options, /\.\.\.collectTtsVoices\(\),/);
    assert.doesNotMatch(options, /function getSelectedTtsVoice\(/);

    assert.match(popup, /voice: settings\.ttsVoiceOpenai \|\| 'nova',/);
    assert.match(popup, /voice: settings\.ttsVoiceGoogle \|\| voiceMap\[lang\] \|\| voiceMap\.zh,/);
    assert.match(popup, /voice: settings\.ttsVoiceGlm \|\| 'tongtong',/);

    assert.match(sidebar, /voice: settings\.ttsVoiceOpenai \|\| 'nova',/);
    assert.match(sidebar, /const voice = settings\.ttsVoiceGoogle \|\| ST\.getDefaultGoogleTtsVoice\(resolvedLang\);/);
    assert.match(sidebar, /const voice = settings\.ttsVoiceGlm \|\| 'tongtong';/);

    assert.match(floatWindow, /voice: settings\.ttsVoiceOpenai \|\| 'nova',/);
    assert.match(floatWindow, /voice: settings\.ttsVoiceGoogle \|\| ST\.getDefaultGoogleTtsVoice\(resolvedLang\),/);
    assert.match(floatWindow, /voice: settings\.ttsVoiceGlm \|\| 'tongtong',/);

    assert.match(content, /ttsVoiceOpenai: '',/);
    assert.match(content, /ttsVoiceGoogle: '',/);
    assert.match(content, /ttsVoiceGlm: '',/);
    assert.doesNotMatch(content, /ttsVoice: ''/);
    assert.match(
        content,
        /if \(raw\?\.ttsVoice\) \{\s*const provider = raw\.ttsProvider \|\| 'system';[\s\S]*delete merged\.ttsVoice;\s*\}/,
    );
});

test('sidebar Enter shortcut guards IME composition and history view state flows through a shared helper', async () => {
    const sidebar = await readWorkspaceFile('content/modules/sidebar.js');
    const options = await readWorkspaceFile('options/options.js');

    assert.match(
        sidebar,
        /input\.addEventListener\('keydown', \(e\) => \{\s*if \(e\.key === 'Enter' && !e\.shiftKey && !e\.isComposing\) \{\s*e\.preventDefault\(\);\s*translateBtn\.click\(\);\s*\}\s*\}\);/,
    );

    assert.match(
        options,
        /function switchHistoryTab\(type\) \{\s*elements\.historyTabs\.forEach\(b => b\.classList\.remove\('active'\)\);\s*const targetBtn = document\.querySelector\(`\.history-tab-btn\[data-type="\$\{type\}"\]`\);\s*if \(targetBtn\) targetBtn\.classList\.add\('active'\);\s*const searchInput = document\.getElementById\('history-search'\);\s*if \(searchInput\) searchInput\.value = '';\s*loadHistoryList\(type\);\s*\}/,
    );
    assert.match(
        options,
        /elements\.historyTabs\.forEach\(btn => \{\s*btn\.addEventListener\('click', \(\) => \{\s*switchHistoryTab\(btn\.getAttribute\('data-type'\)\);\s*\}\);\s*\}\);/,
    );
    assert.match(
        options,
        /elements\.clearHistoryBtn\.addEventListener\('click', async \(\) => \{\s*if \(confirm\('确定要清空所有翻译历史记录吗？'\)\) \{\s*await StorageManager\.clearHistory\(\);\s*switchHistoryTab\('recent'\);\s*\}\s*\}\);/,
    );
    assert.match(
        options,
        /function loadTab\(name\) \{\s*if \(name === 'history'\) \{\s*switchHistoryTab\('recent'\);\s*\}\s*\}/,
    );
});
