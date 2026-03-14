import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('content TTS and offscreen playback calls opt into 15s message-layer timeouts', async () => {
    const sidebar = await readWorkspaceFile('content/modules/sidebar.js');
    const floatWindow = await readWorkspaceFile('content/modules/float-window.js');

    assert.match(
        sidebar,
        /action: 'playAudioOffscreen',\s*audioData: dataUrl,\s*speed\s*\}, 15000, '播放超时'\);/s,
    );
    assert.match(
        sidebar,
        /action: 'ttsOpenAI'[\s\S]*speed: settings\.ttsSpeed \|\| 1\.0\s*\}, 15000, 'TTS 请求超时'\);/s,
    );
    assert.match(
        sidebar,
        /action: 'ttsGoogle'[\s\S]*speed: settings\.ttsSpeed \|\| 1\.0\s*\}, 15000, 'TTS 请求超时'\);/s,
    );
    assert.match(
        sidebar,
        /action: 'ttsGLM'[\s\S]*speed: settings\.ttsSpeed \|\| 1\.0\s*\}, 15000, 'TTS 请求超时'\);/s,
    );

    assert.match(
        floatWindow,
        /action: 'playAudioOffscreen',\s*audioData: dataUrl,\s*speed: playbackSpeed\s*\}, 15000, '播放超时'\);/s,
    );
    assert.match(
        floatWindow,
        /action: 'ttsOpenAI'[\s\S]*speed\s*\}, 15000, 'TTS 请求超时'\);/s,
    );
    assert.match(
        floatWindow,
        /action: 'ttsGoogle'[\s\S]*speed\s*\}, 15000, 'TTS 请求超时'\);/s,
    );
    assert.match(
        floatWindow,
        /action: 'ttsGLM'[\s\S]*speed\s*\}, 15000, 'TTS 请求超时'\);/s,
    );
});

test('offscreen and background expose a no-create stopAudio chain', async () => {
    const offscreen = await readWorkspaceFile('offscreen/offscreen.js');
    const tts = await readWorkspaceFile('background/modules/tts.js');
    const router = await readWorkspaceFile('background/modules/message-router.js');

    assert.match(
        offscreen,
        /if \(request\.action === 'stopAudio'\) \{\s*if \(cancelCurrent\) cancelCurrent\(\);\s*sendResponse\(\{ success: true \}\);\s*return;\s*\}/,
    );

    assert.match(
        tts,
        /export async function stopAudioViaOffscreen\(\) \{\s*const offscreenUrl = chrome\.runtime\.getURL\('offscreen\/offscreen\.html'\);[\s\S]*const existingContexts = await chrome\.runtime\.getContexts\(\{\s*contextTypes: \['OFFSCREEN_DOCUMENT'\],\s*documentUrls: \[offscreenUrl\]\s*\}\);[\s\S]*if \(existingContexts\.length === 0\) \{\s*return \{ success: true \};\s*\}\s*return chrome\.runtime\.sendMessage\(\{ action: 'stopAudio' \}\);\s*\}/s,
    );
    assert.doesNotMatch(tts, /stopAudioViaOffscreen\(\)[\s\S]*ensureOffscreenDocument\(/s);

    assert.match(
        router,
        /case 'playAudioOffscreen':\s*return tts\.playAudioViaOffscreen\(request\.audioData, request\.speed\);\s*case 'stopAudio':\s*return tts\.stopAudioViaOffscreen\(\);/s,
    );
});

test('remote TTS fallbacks stop offscreen playback before switching to system speech', async () => {
    const popup = await readWorkspaceFile('popup/popup.js');
    const sidebar = await readWorkspaceFile('content/modules/sidebar.js');
    const floatWindow = await readWorkspaceFile('content/modules/float-window.js');

    assert.match(
        popup,
        /catch \(error\) \{\s*console\.warn\(`Popup TTS provider "\$\{provider\}" failed, falling back to system speech\.`, error\);\s*chrome\.runtime\.sendMessage\(\{ action: 'stopAudio' \}\)\.catch\(\(\) => \{\}\);\s*\}/,
    );

    assert.match(
        sidebar,
        /catch \(err\) \{\s*console\.error\('\[TTS\] 朗读失败:', err\);\s*ST\.sendMessage\(\{ action: 'stopAudio' \}\)\.catch\(\(\) => \{\}\);\s*return speakSystem\(text, lang, speed\);\s*\}/,
    );

    assert.match(
        floatWindow,
        /catch \(err\) \{\s*console\.error\('\[TTS\] 朗读失败:', err\);\s*ST\.sendMessage\(\{ action: 'stopAudio' \}\)\.catch\(\(\) => \{\}\);\s*\}\s*\/\/ 回退到系统语音/s,
    );
});
