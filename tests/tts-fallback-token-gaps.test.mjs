import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('sidebar provider fallbacks preserve lang and configured speed', async () => {
    const source = await readWorkspaceFile('content/modules/sidebar.js');

    assert.match(
        source,
        /case 'openai':\s*await speakOpenAI\(text, lang, settings\);\s*break;/,
    );
    assert.match(
        source,
        /case 'glm':\s*await speakGLM\(text, lang, settings\);\s*break;/,
    );
    assert.match(
        source,
        /const speakOpenAI = async \(text, lang, settings\) => \{[\s\S]*if \(!apiKey\) \{ speakSystem\(text, lang, settings\.ttsSpeed \|\| 1\.0\); return; \}/,
    );
    assert.match(
        source,
        /const speakGoogle = async \(text, lang, settings\) => \{[\s\S]*if \(!apiKey\) \{\s*speakSystem\(text, lang, settings\.ttsSpeed \|\| 1\.0\);\s*return;\s*\}/,
    );
    assert.match(
        source,
        /const speakGLM = async \(text, lang, settings\) => \{[\s\S]*if \(!apiKey\) \{\s*speakSystem\(text, lang, settings\.ttsSpeed \|\| 1\.0\);[\s\S]*\}[\s\S]*else \{\s*speakSystem\(text, lang, settings\.ttsSpeed \|\| 1\.0\);\s*\}/,
    );
    assert.doesNotMatch(source, /speakSystem\(text, 'zh', 1\.0\)/);
});

test('bubble copy success and sidebar footer use content tokens', async () => {
    const selection = await readWorkspaceFile('content/modules/selection.js');
    const sidebar = await readWorkspaceFile('content/modules/sidebar.js');

    assert.match(selection, /copyBtn\.style\.color = 'var\(--accent\)';/);
    assert.doesNotMatch(selection, /copyBtn\.style\.color = '#00c853';/);

    assert.match(sidebar, /<div class="st-sidebar-info" style="[^"]*color: var\(--text-secondary\);/);
    assert.doesNotMatch(sidebar, /<div class="st-sidebar-info" style="[^"]*color: #666;/);
});

test('popup status dots use theme tokens without hard-coded green glow', async () => {
    const css = await readWorkspaceFile('popup/popup.css');

    assert.match(
        css,
        /\.status-dot\s*\{[\s\S]*background:\s*var\(--text-tertiary\);[\s\S]*\}/,
    );
    assert.match(
        css,
        /\.status-dot\.active\s*\{[\s\S]*background:\s*var\(--success\);[\s\S]*\}/,
    );
    assert.doesNotMatch(css, /\.status-dot\s*\{[\s\S]*background:\s*#D1D1D1;/);
    assert.doesNotMatch(css, /\.status-dot\.active\s*\{[\s\S]*background:\s*#A5D6A7;/);
    assert.doesNotMatch(css, /\.status-dot\.active\s*\{[\s\S]*box-shadow:/);
});
