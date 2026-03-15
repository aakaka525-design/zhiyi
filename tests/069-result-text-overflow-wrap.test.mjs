import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('sidebar result text preserves wrapping for long tokens', async () => {
    const contentCss = await readWorkspaceFile('content/content.css');

    assert.match(
        contentCss,
        /\.st-result-text\s*\{[^}]*word-wrap:\s*break-word;/,
    );
});

test('float-window result text preserves wrapping for long tokens', async () => {
    const contentCss = await readWorkspaceFile('content/content.css');

    assert.match(
        contentCss,
        /\.st-float-result-text\s*\{[^}]*word-wrap:\s*break-word;/,
    );
});

test('immersive translation blocks preserve wrapping for long tokens', async () => {
    const contentCss = await readWorkspaceFile('content/content.css');

    assert.match(
        contentCss,
        /\.st-immersive-translation\s*\{[^}]*word-wrap:\s*break-word;/,
    );
});

test('popup result content preserves wrapping for long tokens', async () => {
    const popupCss = await readWorkspaceFile('popup/popup.css');

    assert.match(
        popupCss,
        /\.result-content\s*\{[^}]*word-wrap:\s*break-word;/,
    );
});
