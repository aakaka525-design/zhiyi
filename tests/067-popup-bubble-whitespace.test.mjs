import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('popup result-content preserves newlines with pre-wrap', async () => {
    const popupCss = await readWorkspaceFile('popup/popup.css');

    assert.match(
        popupCss,
        /\.result-content\s*\{[^}]*white-space:\s*pre-wrap;/,
    );
});

test('bubble result container preserves newlines with pre-wrap', async () => {
    const contentCss = await readWorkspaceFile('content/content.css');

    assert.match(
        contentCss,
        /\.st-bubble-result\s*\{[^}]*white-space:\s*pre-wrap;/,
    );
});
