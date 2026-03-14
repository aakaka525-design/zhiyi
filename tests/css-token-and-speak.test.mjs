import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('content css extends token scope to the selection icon and uses tokens for remaining exact-match colors', async () => {
    const css = await readWorkspaceFile('content/content.css');

    assert.match(
        css,
        /#st-floating-ball-container,\s*#smart-translator-icon,\s*\.st-immersive-translation,\s*\.st-translation-separator,\s*#st-toast\s*\{/,
    );

    const expectedRules = [
        /#smart-translator-bubble\s*\{[\s\S]*color:\s*var\(--text-primary\);/,
        /\.st-bubble-logo\s*\{[\s\S]*color:\s*var\(--accent\);/,
        /\.st-action-btn\s*\{[\s\S]*color:\s*var\(--text-tertiary\);/,
        /\.st-action-btn:hover\s*\{[\s\S]*background:\s*var\(--bg-secondary\);[\s\S]*color:\s*var\(--accent\);/,
        /\.st-bubble-result\s*\{[\s\S]*color:\s*var\(--text-primary\);/,
        /#smart-translator-icon\s*\{[\s\S]*background:\s*var\(--accent\);/,
        /#smart-translator-icon:hover\s*\{[\s\S]*background:\s*var\(--accent-light\);/,
        /#st-sidebar\s*\{[\s\S]*color:\s*var\(--text-primary\);/,
        /\.st-sidebar-header\s*\{[\s\S]*border-bottom:\s*1px solid var\(--bg-secondary\);/,
        /\.st-sidebar-title\s*\{[\s\S]*color:\s*var\(--text-primary\);/,
        /\.st-sidebar-search\s*\{[\s\S]*background:\s*var\(--bg-secondary\);/,
        /\.st-sidebar-input\s*\{[\s\S]*color:\s*var\(--text-primary\);/,
        /\.st-sidebar-btn\s*\{[\s\S]*background:\s*var\(--accent\);/,
        /\.st-sidebar-btn:hover\s*\{[\s\S]*background:\s*var\(--accent-light\);/,
        /\.st-float-header\s*\{[\s\S]*border-bottom:\s*1px solid var\(--bg-secondary\);/,
        /\.st-float-title\s*\{[\s\S]*color:\s*var\(--accent\);/,
        /#st-floating-ball\s*\{[\s\S]*color:\s*var\(--accent\);/,
        /#st-floating-ball:hover,\s*#st-floating-ball\.active\s*\{[\s\S]*background:\s*var\(--accent\);/,
        /\.st-orb-menu-item\s*\{[\s\S]*color:\s*var\(--accent\);/,
        /\.st-orb-menu-item:hover\s*\{[\s\S]*background:\s*var\(--accent\);/,
    ];

    for (const rule of expectedRules) {
        assert.match(css, rule);
    }
});

test('float-window source speech resolves language once and reuses it for Google and system TTS', async () => {
    const source = await readWorkspaceFile('content/modules/float-window.js');

    assert.match(
        source,
        /speakSourceBtn\.onclick = \(\) => runSpeak\(speakSourceBtn, \(\) => speak\(input\.value, 'auto'\)\);/,
    );
    assert.match(
        source,
        /const speed = settings\.ttsSpeed \|\| 1\.0;\s*const resolvedLang = !lang \|\| lang === 'auto' \? ST\.detectLanguage\(text\) : lang;/,
    );
    assert.match(
        source,
        /voice: settings\.ttsVoiceGoogle \|\| ST\.getDefaultGoogleTtsVoice\(resolvedLang\),/,
    );
    assert.match(
        source,
        /await ST\.speakSystemWithGuard\(text, resolvedLang, speed\);/,
    );
    assert.doesNotMatch(source, /ST\.getDefaultGoogleTtsVoice\(lang\)/);
});

test('sidebar history replay restores target language UI when available and falls back cleanly when absent', async () => {
    const sidebar = await readWorkspaceFile('content/modules/sidebar.js');

    assert.match(sidebar, /historyItem\.dataset\.sourceLang = item\.sourceLang \|\| '';/);
    assert.match(sidebar, /historyItem\.dataset\.targetLang = item\.targetLang \|\| '';/);
    assert.match(
        sidebar,
        /const sl = historyItem\.dataset\.sourceLang;\s*const tl = historyItem\.dataset\.targetLang;\s*if \(sl\) sourceLangSelect\.value = sl;\s*else sourceLangSelect\.value = 'auto';\s*if \(tl\) \{\s*targetLangSelect\.value = tl;\s*resultLang\.innerText = `翻译结果 \(\$\{tl\}\)`;\s*\} else \{\s*resultLang\.innerText = '翻译结果';\s*\}/,
    );
});
