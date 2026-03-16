import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('100 popup css removes the decorative header gradient and adds popup-scoped variables', async () => {
    const css = await readWorkspaceFile('popup/popup.css');

    assert.doesNotMatch(css, /\.popup-container::before\s*\{/);
    assert.match(css, /\.popup-container\s*\{[\s\S]*--popup-lang-radius:\s*10px;[\s\S]*--popup-translate-bg:\s*rgba\(122,\s*154,\s*139,\s*0\.12\);[\s\S]*--popup-translate-bg-hover:\s*rgba\(122,\s*154,\s*139,\s*0\.2\);[\s\S]*--popup-translate-border:\s*rgba\(122,\s*154,\s*139,\s*0\.2\);/);
    assert.match(css, /body\.dark-mode \.popup-container\s*\{[\s\S]*--popup-translate-bg:\s*rgba\(143,\s*179,\s*164,\s*0\.15\);[\s\S]*--popup-translate-bg-hover:\s*rgba\(143,\s*179,\s*164,\s*0\.25\);[\s\S]*--popup-translate-border:\s*rgba\(143,\s*179,\s*164,\s*0\.25\);/);
});

test('100 popup language selector uses the local radius variable instead of radius-xl', async () => {
    const css = await readWorkspaceFile('popup/popup.css');

    assert.match(css, /\.language-selector\s*\{[^}]*border-radius:\s*var\(--popup-lang-radius\);/);
    assert.doesNotMatch(css, /\.language-selector\s*\{[^}]*border-radius:\s*var\(--radius-xl\);/);
});

test('100 popup translate button uses the lighter dark-mode-safe styling', async () => {
    const css = await readWorkspaceFile('popup/popup.css');

    assert.match(css, /\.translate-btn\s*\{[\s\S]*background:\s*var\(--popup-translate-bg\);[\s\S]*color:\s*var\(--accent\);[\s\S]*border:\s*1px solid var\(--popup-translate-border\);[\s\S]*box-shadow:\s*none;/);
    assert.match(css, /\.translate-btn:hover\s*\{[\s\S]*background:\s*var\(--popup-translate-bg-hover\);[\s\S]*transform:\s*translateY\(-1px\);[\s\S]*box-shadow:\s*none;/);
    assert.doesNotMatch(css, /\.translate-btn\s*\{[\s\S]*color:\s*white;/);
    assert.match(css, /\.translate-btn:active\s*\{[\s\S]*transform:\s*translateY\(0\);/);
});
