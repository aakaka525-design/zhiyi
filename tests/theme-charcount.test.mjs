import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('theme.css uses accent-glow instead of legacy blue/cyan hardcoded accents', async () => {
    const css = await readWorkspaceFile('options/theme.css');

    assert.match(
        css,
        /\.btn-primary:hover\s*\{[\s\S]*box-shadow:\s*var\(--shadow-md\), 0 0 20px var\(--accent-glow\);[\s\S]*\}/,
    );
    assert.match(
        css,
        /\.input:focus\s*\{[\s\S]*box-shadow:\s*0 0 0 3px var\(--accent-glow\);[\s\S]*\}/,
    );
    assert.match(
        css,
        /\.tag-accent\s*\{[\s\S]*background:\s*var\(--accent-glow\);[\s\S]*color:\s*var\(--accent\);[\s\S]*\}/,
    );
    assert.doesNotMatch(css, /rgba\(102,\s*126,\s*234,\s*0\.[24]\)/);
    assert.doesNotMatch(css, /rgba\(0,\s*217,\s*255,\s*0\.15\)/);
});

test('popup char count funnels all color logic through updateCharCount', async () => {
    const popup = await readWorkspaceFile('popup/popup.js');

    // updateCharCount uses classList.toggle instead of inline style.color
    assert.match(
        popup,
        /function updateCharCount\(\)\s*\{[\s\S]*classList\.toggle\('over-limit'/,
    );
    assert.doesNotMatch(
        popup,
        /elements\.charCount\.style\.color/,
    );
});
