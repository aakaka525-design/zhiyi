import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('immersive cancel cleanup also removes inline translation separators', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(
        immersive,
        /document\.querySelectorAll\('\.st-immersive-translation, \.st-immersive-wrapper, \.st-translation-separator'\)\.forEach\(el => el\.remove\(\)\);/,
    );
});

test('immersive observer captures immersiveRunId and re-checks it after await before injecting translations', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(
        immersive,
        /ST\.startMutationObserver = function \(\) \{\s*if \(ST\.observers\.mutation\) return;\s*const observerRunId = ST\.state\.immersiveRunId;/,
    );
    assert.match(
        immersive,
        /if \(!ST\.state\.isImmersiveEnabled \|\| ST\.state\.immersiveRunId !== observerRunId\) \{\s*ST\.stopMutationObserver\(\);\s*return;\s*\}/,
    );
    assert.match(
        immersive,
        /const response = await ST\.sendMessage\(\{\s*action: 'translateBatch',\s*texts: texts,\s*to: targetLang\s*\}, 60000, '批量翻译超时'\);\s*if \(!ST\.state\.isImmersiveEnabled \|\| ST\.state\.immersiveRunId !== observerRunId\) return;\s*if \(response && response\.results\) \{/,
    );
});

test('options script defines a reusable timeout helper and aborts API fetch tests after 10 seconds', async () => {
    const options = await readWorkspaceFile('options/options.js');

    assert.match(
        options,
        /function withTimeout\(promise, ms, message = '请求超时'\) \{\s*let timeoutId;\s*return Promise\.race\(\[\s*promise,\s*new Promise\(\(_, reject\) => \{\s*timeoutId = setTimeout\(\(\) => reject\(new Error\(message\)\), ms\);\s*\}\),\s*\]\)\.finally\(\(\) => clearTimeout\(timeoutId\)\);\s*\}/,
    );
    assert.match(
        options,
        /const controller = new AbortController\(\);\s*const timeoutId = setTimeout\(\(\) => controller\.abort\(\), 10000\);/,
    );
    assert.match(
        options,
        /fetch\(`\$\{baseUrl\}\/models`, \{\s*method: 'GET',\s*headers: \{ 'Authorization': `Bearer \$\{apiKey\}` \},\s*signal: controller\.signal,\s*\}\);/,
    );
    assert.match(
        options,
        /fetch\(`https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\?key=\$\{apiKey\}`,\s*\{\s*signal: controller\.signal,\s*\}\);/,
    );
    assert.match(
        options,
        /if \(error\.name === 'AbortError'\) \{\s*statusEl\.textContent = '✗ 连接超时';\s*\} else \{\s*statusEl\.textContent = `✗ \$\{error\.message\}`;\s*\}/,
    );
    assert.match(
        options,
        /clearTimeout\(timeoutId\);\s*btn\.classList\.remove\('loading'\);\s*btn\.disabled = false;/,
    );
});

test('options TTS test wraps both request and playback phases with timeout guards', async () => {
    const options = await readWorkspaceFile('options/options.js');

    assert.match(
        options,
        /const audioData = await withTimeout\(\s*requestTtsTestAudio\(provider, testText, speed\),\s*15000,\s*'TTS 请求超时',\s*\);/,
    );
    assert.match(
        options,
        /const playbackResponse = await withTimeout\(\s*chrome\.runtime\.sendMessage\(\{\s*action: 'playAudioOffscreen',\s*audioData,\s*\}\),\s*15000,\s*'播放超时',\s*\);/,
    );
});
