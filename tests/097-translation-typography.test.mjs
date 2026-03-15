import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('097 block-wrapper typography uses a narrow selector override without changing the shared base rule', async () => {
    const css = await readWorkspaceFile('content/content.css');

    assert.match(
        css,
        /\.st-immersive-wrapper > \.st-immersive-translation\s*\{[\s\S]*background:\s*rgba\(122,\s*154,\s*139,\s*0\.05\);[\s\S]*border-left-width:\s*3px;[\s\S]*line-height:\s*1\.65;[\s\S]*font-family:\s*inherit;/,
    );
    assert.match(
        css,
        /\.st-immersive-translation\s*\{[\s\S]*background:\s*transparent;[\s\S]*border-left:\s*2px solid var\(--accent\);[\s\S]*line-height:\s*1\.6;/,
    );
    assert.match(
        css,
        /td > \.st-immersive-translation,[\s\S]*border-left:\s*2px solid var\(--accent\);/,
    );
});

test('097 replace mode removes quote chrome and resets wrapper spacing', async () => {
    const css = await readWorkspaceFile('content/content.css');

    assert.match(
        css,
        /body\.st-replace-mode \.st-immersive-translation\s*\{[\s\S]*border-left:\s*none;[\s\S]*background:\s*transparent;[\s\S]*padding:\s*0;[\s\S]*margin:\s*0;/,
    );
    assert.match(
        css,
        /body\.st-replace-mode \.st-immersive-wrapper\s*\{[\s\S]*margin:\s*0;/,
    );
});

test('097 replace mode keeps inline and cell translations replace-safe with page-color fallback', async () => {
    const css = await readWorkspaceFile('content/content.css');

    assert.match(
        css,
        /body\.st-replace-mode \.st-translated-inline > \.st-immersive-translation\s*\{[\s\S]*font-size:\s*0\.9rem\s*!important;[\s\S]*line-height:\s*1\.65\s*!important;[\s\S]*color:\s*var\(--st-page-color,\s*var\(--text-primary\)\)\s*!important;/,
    );
});
