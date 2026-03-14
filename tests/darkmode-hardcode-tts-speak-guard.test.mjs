import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('content container surfaces use theme tokens instead of hardcoded light backgrounds and borders', async () => {
    const css = await readWorkspaceFile('content/content.css');

    assert.match(css, /--surface-ball:\s*rgba\(255,\s*255,\s*255,\s*0\.6\);/);
    assert.match(css, /:root\[data-st-theme="dark"\][\s\S]*--surface-ball:\s*rgba\(30,\s*34,\s*43,\s*0\.6\);/);

    assert.match(css, /#smart-translator-bubble\s*\{[\s\S]*background:\s*var\(--surface\);/);
    assert.match(css, /#st-sidebar\s*\{[\s\S]*background:\s*var\(--surface\);[\s\S]*border-left:\s*1px solid var\(--border-color\);/);
    assert.match(css, /\.st-sidebar-search\s*\{[\s\S]*border:\s*1px solid var\(--border-color\);/);
    assert.match(css, /#st-float-window\s*\{[\s\S]*background:\s*var\(--surface\);[\s\S]*border:\s*1px solid var\(--border-color\);/);
    assert.match(css, /\.st-float-header\s*\{[\s\S]*background:\s*var\(--bg-secondary\);/);
    assert.match(css, /#st-sidebar-toggle-btn\s*\{[\s\S]*background:\s*var\(--surface\);/);
    assert.match(css, /#st-floating-ball\s*\{[\s\S]*background:\s*var\(--surface-ball\);/);

    assert.doesNotMatch(css, /#smart-translator-bubble\s*\{[\s\S]*background:\s*rgba\(249,\s*249,\s*249,\s*0\.95\);/);
    assert.doesNotMatch(css, /#st-sidebar\s*\{[\s\S]*background:\s*rgba\(249,\s*249,\s*249,\s*0\.98\);/);
    assert.doesNotMatch(css, /#st-float-window\s*\{[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.95\);/);
    assert.doesNotMatch(css, /\.st-float-header\s*\{[\s\S]*background:\s*#F9F9F9;/);
    assert.doesNotMatch(css, /#st-sidebar-toggle-btn\s*\{[\s\S]*background:\s*rgba\(253,\s*252,\s*248,\s*0\.95\);/);
});

test('system TTS paths resolve on speech end so speak-button guards stay active until playback finishes', async () => {
    const popup = await readWorkspaceFile('popup/popup.js');
    const utils = await readWorkspaceFile('content/modules/utils.js');
    const sidebar = await readWorkspaceFile('content/modules/sidebar.js');
    const floatWindow = await readWorkspaceFile('content/modules/float-window.js');

    assert.match(
        utils,
        /ST\.speakSystemWithGuard = function \(text, lang, speed\) \{\s*return new Promise\(\(resolve, reject\) => \{[\s\S]*let settled = false;\s*let hasStarted = false;[\s\S]*utterance\.onstart = \(\) => \{ hasStarted = true; \};[\s\S]*if \(hasStarted && !window\.speechSynthesis\.speaking && !window\.speechSynthesis\.pending\) \{\s*settle\(resolve\);\s*\}/s,
    );

    assert.match(
        popup,
        /function speakWithGuard\(text, lang, speed\) \{\s*return new Promise\(\(resolve, reject\) => \{[\s\S]*let settled = false;\s*let hasStarted = false;[\s\S]*utterance\.onstart = \(\) => \{ hasStarted = true; \};[\s\S]*if \(hasStarted && !speechSynthesis\.speaking && !speechSynthesis\.pending\) \{\s*settle\(resolve\);\s*\}[\s\S]*speechSynthesis\.cancel\(\);\s*speechSynthesis\.speak\(utterance\);\s*\}\);\s*\}/s,
    );
    assert.match(
        popup,
        /await speakWithGuard\(text, langMap\[lang\] \|\| lang, speed\);/,
    );

    assert.match(
        sidebar,
        /const speakSystem = \(text, lang, speed\) => ST\.speakSystemWithGuard\(text, lang, speed\);/,
    );
    assert.match(sidebar, /default:\s*return speakSystem\(text, lang, speed\);/);
    assert.match(
        sidebar,
        /\} catch \(err\) \{\s*console\.error\('\[TTS\] 朗读失败:', err\);\s*ST\.sendMessage\(\{ action: 'stopAudio' \}\)\.catch\(\(\) => \{\}\);\s*return speakSystem\(text, lang, speed\);/,
    );
    assert.match(sidebar, /if \(!apiKey\) \{\s*return speakSystem\(text, lang, settings\.ttsSpeed \|\| 1\.0\);\s*\}/);

    const sidebarFallbackReturns = sidebar.match(/return speakSystem\(text, lang, settings\.ttsSpeed \|\| 1\.0\);/g) || [];
    assert.equal(sidebarFallbackReturns.length, 6, 'expected all provider fallback branches to return speakSystem');

    assert.match(
        floatWindow,
        /await ST\.speakSystemWithGuard\(text, resolvedLang, speed\);/,
    );
});
