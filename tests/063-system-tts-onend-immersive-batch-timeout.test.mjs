import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('content utils expose ST.speakSystemWithGuard with a hasStarted polling guard', async () => {
    const utils = await readWorkspaceFile('content/modules/utils.js');

    assert.match(
        utils,
        /ST\.speakSystemWithGuard = function \(text, lang, speed\) \{\s*return new Promise\(\(resolve, reject\) => \{\s*const langMap = \{ zh: 'zh-CN', en: 'en-US', ja: 'ja-JP', ko: 'ko-KR' \};\s*const resolvedLang = !lang \|\| lang === 'auto' \? ST\.detectLanguage\(text\) : lang;[\s\S]*let settled = false;\s*let hasStarted = false;[\s\S]*utterance\.onstart = \(\) => \{ hasStarted = true; \};[\s\S]*if \(hasStarted && !window\.speechSynthesis\.speaking && !window\.speechSynthesis\.pending\) \{\s*settle\(resolve\);\s*\}/s,
    );
});

test('sidebar and float window use the shared content-side speakSystemWithGuard helper', async () => {
    const sidebar = await readWorkspaceFile('content/modules/sidebar.js');
    const floatWindow = await readWorkspaceFile('content/modules/float-window.js');

    assert.match(
        sidebar,
        /const speakSystem = \(text, lang, speed\) => ST\.speakSystemWithGuard\(text, lang, speed\);/,
    );

    assert.match(
        floatWindow,
        /await ST\.speakSystemWithGuard\(text, resolvedLang, speed\);/,
    );
});

test('popup defines a local speakWithGuard helper with the same hasStarted guard', async () => {
    const popup = await readWorkspaceFile('popup/popup.js');

    assert.match(
        popup,
        /function speakWithGuard\(text, lang, speed\) \{\s*return new Promise\(\(resolve, reject\) => \{\s*const utterance = new SpeechSynthesisUtterance\(text\);\s*utterance\.rate = speed;\s*utterance\.lang = lang;\s*let settled = false;\s*let hasStarted = false;[\s\S]*utterance\.onstart = \(\) => \{ hasStarted = true; \};[\s\S]*if \(hasStarted && !speechSynthesis\.speaking && !speechSynthesis\.pending\) \{\s*settle\(resolve\);\s*\}/s,
    );
    assert.match(
        popup,
        /await speakWithGuard\(text, langMap\[lang\] \|\| lang, speed\);/,
    );
});

test('immersive translateBatch calls opt into a 60000ms timeout on initial, observer, and rescan paths', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');

    const matches = immersive.match(/action: 'translateBatch'[\s\S]*?\}, 60000, '批量翻译超时'\);/g) || [];
    assert.equal(matches.length, 3);
});
