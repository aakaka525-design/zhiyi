import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('options playSystemTtsTest uses hasStarted polling guard instead of bare onend resolution', async () => {
    const options = await readWorkspaceFile('options/options.js');

    assert.match(
        options,
        /function playSystemTtsTest\(text, speed\) \{\s*return new Promise\(\(resolve, reject\) => \{\s*const utterance = new SpeechSynthesisUtterance\(text\);\s*utterance\.lang = 'zh-CN';\s*utterance\.rate = speed;[\s\S]*let settled = false;\s*let hasStarted = false;\s*let pollId = null;[\s\S]*utterance\.onstart = \(\) => \{ hasStarted = true; \};[\s\S]*if \(hasStarted && !window\.speechSynthesis\.speaking && !window\.speechSynthesis\.pending\) \{\s*settle\(resolve\);\s*\}/s,
    );
});

test('options system TTS test wraps playSystemTtsTest with a 15000ms timeout', async () => {
    const options = await readWorkspaceFile('options/options.js');

    assert.match(
        options,
        /if \(provider === 'system'\) \{\s*statusEl\.textContent = '播放中\.\.\.';\s*await withTimeout\(playSystemTtsTest\(testText, speed\), 15000, '系统语音播放超时'\);\s*statusEl\.textContent = '✓ 播放完成';/s,
    );
});

test('immersive toggle only hides progress for the active run id', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(
        immersive,
        /if \(ST\.state\.immersiveRunId === myRunId\) \{\s*ST\.hideProgress\(\);\s*\}/,
    );
});

test('content progress helpers clear any pending hide timer before showing again', async () => {
    const utils = await readWorkspaceFile('content/modules/utils.js');

    assert.match(
        utils,
        /let _hideProgressTimerId = null;/,
    );
    assert.match(
        utils,
        /ST\.showProgress = function \(\) \{\s*if \(_hideProgressTimerId\) \{\s*clearTimeout\(_hideProgressTimerId\);\s*_hideProgressTimerId = null;\s*\}/s,
    );
    assert.match(
        utils,
        /ST\.hideProgress = function \(\) \{\s*if \(ST\.ui\.progress\) \{\s*ST\.ui\.progress\.style\.width = '100%';[\s\S]*_hideProgressTimerId = setTimeout\(\(\) => \{\s*ST\.ui\.progress\.style\.display = 'none';[\s\S]*_hideProgressTimerId = null;\s*\}, 500\);\s*\}\s*\}/s,
    );
});
