import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('selection bubble captures a stable bubble reference and guards stale async responses', async () => {
    const selection = await readWorkspaceFile('content/modules/selection.js');

    assert.match(
        selection,
        /document\.body\.appendChild\(ST\.ui\.bubble\);\s*const myBubble = ST\.ui\.bubble;/,
    );
    assert.match(
        selection,
        /const response = await ST\.sendMessage\(\{\s*action: 'translate',\s*text: text,\s*from: sourceLang,\s*to: targetLang\s*\}, 30000, '翻译请求超时'\);\s*if \(ST\.ui\.bubble !== myBubble\) return;\s*const resultDiv = myBubble\.querySelector\('\.st-bubble-result'\);/,
    );
    assert.match(
        selection,
        /const actionsEl = myBubble\.querySelector\('\.st-bubble-actions'\);/,
    );
    assert.match(
        selection,
        /const copyBtn = myBubble\.querySelector\('#st-copy-btn'\);/,
    );
    assert.match(
        selection,
        /catch \(err\) \{\s*if \(ST\.ui\.bubble !== myBubble\) return;\s*const resultDiv = myBubble\.querySelector\('\.st-bubble-result'\);[\s\S]*const actionsEl = myBubble\.querySelector\('\.st-bubble-actions'\);/,
    );
});

test('offscreen audio playback uses a singleton audio instance with cancellable prior promise settlement', async () => {
    const offscreen = await readWorkspaceFile('offscreen/offscreen.js');

    assert.match(offscreen, /let currentAudio = null;\s*let cancelCurrent = null;/);
    assert.match(
        offscreen,
        /async function playAudio\(dataUrl, speed = 1\.0\) \{\s*if \(cancelCurrent\) cancelCurrent\(\);\s*const audio = new Audio\(dataUrl\);/,
    );
    assert.match(
        offscreen,
        /cancelCurrent = \(\) => \{\s*audio\.pause\(\);\s*currentAudio = null;\s*cancelCurrent = null;\s*resolve\(\);\s*\};/,
    );
    assert.match(
        offscreen,
        /audio\.onended = \(\) => \{\s*if \(currentAudio === audio\) \{ currentAudio = null; cancelCurrent = null; \}\s*resolve\(\);\s*\};/,
    );
    assert.match(
        offscreen,
        /audio\.onerror = \(\) => \{\s*if \(currentAudio === audio\) \{ currentAudio = null; cancelCurrent = null; \}\s*reject\(new Error\('Audio playback failed'\)\);\s*\};/,
    );
    assert.match(
        offscreen,
        /audio\.play\(\)\.catch\(\(err\) => \{\s*if \(currentAudio === audio\) \{ currentAudio = null; cancelCurrent = null; \}\s*reject\(err\);\s*\}\);/,
    );
    assert.doesNotMatch(offscreen, /Playback interrupted/);
});
