import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('content speakSystemWithGuard adds a startup-timeout pollCount guard', async () => {
    const utils = await readWorkspaceFile('content/modules/utils.js');

    assert.match(
        utils,
        /ST\.speakSystemWithGuard = function \(text, lang, speed\) \{[\s\S]*let pollCount = 0;[\s\S]*pollCount\+\+;[\s\S]*else if \(!hasStarted && pollCount >= 10\) \{[\s\S]*window\.speechSynthesis\.cancel\(\);[\s\S]*settle\(\(\) => reject\(new Error\('系统朗读启动超时'\)\)\);[\s\S]*\}/s,
    );
    assert.match(
        utils,
        /if \(hasStarted && !window\.speechSynthesis\.speaking && !window\.speechSynthesis\.pending\) \{\s*settle\(resolve\);\s*\}/s,
    );
});

test('popup speakWithGuard mirrors the startup-timeout guard without adding a total hard cap', async () => {
    const popup = await readWorkspaceFile('popup/popup.js');

    assert.match(
        popup,
        /function speakWithGuard\(text, lang, speed\) \{[\s\S]*let pollCount = 0;[\s\S]*pollCount\+\+;[\s\S]*else if \(!hasStarted && pollCount >= 10\) \{[\s\S]*speechSynthesis\.cancel\(\);[\s\S]*settle\(\(\) => reject\(new Error\('系统朗读启动超时'\)\)\);[\s\S]*\}/s,
    );
    assert.doesNotMatch(popup, /pollCount >= 240|系统朗读超时/);
});

test('options playSystemTtsTest adds the same startup-timeout guard while keeping the outer 15s UI timeout', async () => {
    const options = await readWorkspaceFile('options/options.js');

    assert.match(
        options,
        /function playSystemTtsTest\(text, speed\) \{[\s\S]*let pollCount = 0;[\s\S]*pollCount\+\+;[\s\S]*else if \(!hasStarted && pollCount >= 10\) \{[\s\S]*window\.speechSynthesis\.cancel\(\);[\s\S]*settle\(\(\) => reject\(new Error\('系统朗读启动超时'\)\)\);[\s\S]*\}/s,
    );
    assert.match(
        options,
        /await withTimeout\(playSystemTtsTest\(testText, speed\), 15000, '系统语音播放超时'\);/,
    );
});

test('all three system TTS helpers still keep the hasStarted polling resolve path', async () => {
    const [utils, popup, options] = await Promise.all([
        readWorkspaceFile('content/modules/utils.js'),
        readWorkspaceFile('popup/popup.js'),
        readWorkspaceFile('options/options.js'),
    ]);

    assert.match(utils, /if \(hasStarted && !window\.speechSynthesis\.speaking && !window\.speechSynthesis\.pending\) \{\s*settle\(resolve\);\s*\}/s);
    assert.match(popup, /if \(hasStarted && !speechSynthesis\.speaking && !speechSynthesis\.pending\) \{\s*settle\(resolve\);\s*\}/s);
    assert.match(options, /if \(hasStarted && !window\.speechSynthesis\.speaking && !window\.speechSynthesis\.pending\) \{\s*settle\(resolve\);\s*\}/s);
});
