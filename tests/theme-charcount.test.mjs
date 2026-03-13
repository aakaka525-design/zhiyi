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

    assert.match(
        popup,
        /elements\.sourceText\.addEventListener\('input', updateCharCount\);/,
    );
    assert.match(
        popup,
        /function updateCharCount\(\) \{\s*const len = elements\.sourceText\.value\.length;\s*elements\.charCount\.textContent = `\$\{len\} \/ \$\{MAX_CHARS\}`;\s*elements\.charCount\.style\.color = len > MAX_CHARS \? 'var\(--error\)' : 'var\(--text-muted\)';\s*\}/,
    );
    assert.doesNotMatch(
        popup,
        /elements\.sourceText\.addEventListener\('input', \(\) => \{[\s\S]*elements\.charCount\.style\.color = 'var\(--error\)'[\s\S]*\}\);/,
    );
});
