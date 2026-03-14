import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('sidebar and float-window persist language selector changes back to settings storage', async () => {
    const sidebar = await readWorkspaceFile('content/modules/sidebar.js');
    const floatWindow = await readWorkspaceFile('content/modules/float-window.js');

    assert.match(
        sidebar,
        /const saveLanguageSettings = \(partialSettings\) => \{\s*ST\.sendMessage\(\{ action: 'patchSettings', updates: partialSettings \}\);\s*\};/,
    );
    assert.match(
        sidebar,
        /sourceLangSelect\.addEventListener\('change', \(\) => \{\s*saveLanguageSettings\(\{ sourceLang: sourceLangSelect\.value \}\);\s*\}\);/,
    );
    assert.match(
        sidebar,
        /targetLangSelect\.addEventListener\('change', \(\) => \{\s*saveLanguageSettings\(\{ targetLang: targetLangSelect\.value \}\);\s*\}\);/,
    );
    assert.match(
        sidebar,
        /swapBtn\.onclick = \(\) => \{\s*const s = sourceLangSelect\.value;\s*const t = targetLangSelect\.value;\s*if \(s !== 'auto'\) \{\s*sourceLangSelect\.value = t;\s*targetLangSelect\.value = s;\s*saveLanguageSettings\(\{ sourceLang: t, targetLang: s \}\);/s,
    );

    assert.match(
        floatWindow,
        /const saveLanguageSettings = \(partialSettings\) => \{\s*ST\.sendMessage\(\{ action: 'patchSettings', updates: partialSettings \}\);\s*\};/,
    );
    assert.match(
        floatWindow,
        /targetLangSelect\.addEventListener\('change', \(\) => \{\s*saveLanguageSettings\(\{ targetLang: targetLangSelect\.value \}\);\s*\}\);/,
    );
});

test('options system TTS test awaits playback completion before restoring button state', async () => {
    const options = await readWorkspaceFile('options/options.js');

    assert.match(
        options,
        /if \(provider === 'system'\) \{\s*statusEl\.textContent = '播放中\.\.\.';\s*await withTimeout\(playSystemTtsTest\(testText, speed\), 15000, '系统语音播放超时'\);\s*statusEl\.textContent = '✓ 播放完成';\s*statusEl\.classList\.add\('success'\);\s*return;\s*\}/,
    );
    assert.match(
        options,
        /function playSystemTtsTest\(text, speed\) \{\s*return new Promise\(\(resolve, reject\) => \{\s*const utterance = new SpeechSynthesisUtterance\(text\);\s*utterance\.lang = 'zh-CN';\s*utterance\.rate = speed;[\s\S]*let settled = false;\s*let hasStarted = false;\s*let pollId = null;[\s\S]*utterance\.onstart = \(\) => \{ hasStarted = true; \};[\s\S]*utterance\.onend = \(\) => settle\(resolve\);[\s\S]*if \(hasStarted && !window\.speechSynthesis\.speaking && !window\.speechSynthesis\.pending\) \{\s*settle\(resolve\);\s*\}/s,
    );
});
