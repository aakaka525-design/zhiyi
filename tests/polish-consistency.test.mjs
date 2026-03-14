import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('popup toast uses a fixed dark background instead of text-primary', async () => {
    const source = await readWorkspaceFile('popup/popup.js');

    assert.match(
        source,
        /function showToast\(message\)\s*\{[\s\S]*background:\s*rgba\(50,\s*54,\s*66,\s*0\.95\);/,
    );
    assert.doesNotMatch(
        source,
        /function showToast\(message\)\s*\{[\s\S]*background:\s*var\(--text-primary\);/,
    );
});

test('popup remote TTS failures fall back to system speech with a warning', async () => {
    const source = await readWorkspaceFile('popup/popup.js');
    const speakSection = source.match(
        /async function speak\(text, lang\)\s*\{[\s\S]*?\n\}\n\nasync function requestTtsAudio/,
    )?.[0] || '';

    assert.match(
        speakSection,
        /if \(provider !== 'system'\)\s*\{[\s\S]*try \{[\s\S]*requestTtsAudio[\s\S]*chrome\.runtime\.sendMessage[\s\S]*return;[\s\S]*\} catch \(error\) \{[\s\S]*console\.warn\(/,
    );
    assert.doesNotMatch(
        speakSection,
        /showToast\(/,
    );
    assert.match(source, /function speakWithGuard\(text, lang, speed\)\s*\{/);
    assert.match(speakSection, /await speakWithGuard\(text, langMap\[lang\] \|\| lang, speed\);/);
});

test('content script merges default settings in both fallback and storage change paths', async () => {
    const source = await readWorkspaceFile('content/content.js');

    assert.match(source, /function mergeDefaults\(raw\)\s*\{/);
    assert.match(source, /provider:\s*'google'/);
    assert.match(source, /ttsProvider:\s*'system'/);
    assert.match(source, /showFloatingBall:\s*false/);
    assert.match(source, /enableAdBlock:\s*false/);
    assert.match(
        source,
        /const settings = mergeDefaults\(result\.settings \|\| \{\}\);[\s\S]*ST\.state\.settings = settings;/,
    );
    assert.match(
        source,
        /ST\.state\.settings = mergeDefaults\(changes\.settings\.newValue\);/,
    );
});

test('generic immersive filtering skips paragraphs already in the target language', async () => {
    const source = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(
        source,
        /if \(text\.length < 20\) return false;\s*if \(ST\.detectLanguage\(text\) === targetLang\) return false;/,
    );
});

test('content stylesheet defines loading dots animation and uses a surface token for content cards', async () => {
    const css = await readWorkspaceFile('content/content.css');

    assert.match(css, /--surface:\s*rgba\(255,\s*255,\s*255,\s*0\.95\);/);
    assert.match(css, /\.st-loading-dots\s*\{/);
    assert.match(css, /\.st-loading-dots span\s*\{/);
    assert.match(css, /animation:\s*st-bounce 1\.2s infinite ease-in-out/);
    assert.match(css, /@keyframes st-bounce\s*\{/);
    assert.match(css, /\.st-sidebar-result-card\s*\{[\s\S]*background:\s*var\(--surface\);/);
    assert.match(css, /\.st-history-item:hover\s*\{[\s\S]*background:\s*var\(--surface\);/);
    assert.match(css, /\.st-orb-menu-item\s*\{[\s\S]*background:\s*var\(--surface\);/);
});

test('sidebar inline colors use content tokens instead of hardcoded gray values', async () => {
    const source = await readWorkspaceFile('content/modules/sidebar.js');

    assert.doesNotMatch(source, /#999/);
    assert.doesNotMatch(source, /#eee/);
    assert.match(source, /color:\s*var\(--text-tertiary\)/);
    assert.match(source, /background:\s*var\(--bg-secondary\)/);
    assert.match(source, /emptyState\.style\.color = 'var\(--text-tertiary\)'/);
});
