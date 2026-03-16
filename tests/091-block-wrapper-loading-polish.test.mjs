import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('091 content CSS lightens block wrapper spacing and translation chrome', async () => {
    const css = await readWorkspaceFile('content/content.css');

    assert.match(
        css,
        /\.st-immersive-wrapper\s*\{[\s\S]*margin:\s*4px 0 6px 0;[\s\S]*\}/,
    );
    assert.doesNotMatch(
        css,
        /\.st-immersive-wrapper\s*\{[\s\S]*margin:\s*12px 0 20px 0;[\s\S]*\}/,
    );
    assert.match(
        css,
        /\.st-immersive-translation\s*\{[\s\S]*background:\s*transparent;[\s\S]*border-left:\s*2px solid var\(--accent\);[\s\S]*padding:\s*0 0 0 10px;[\s\S]*margin:\s*2px 0;[\s\S]*border-radius:\s*0;[\s\S]*font-size:\s*0\.92em;[\s\S]*line-height:\s*1\.6;[\s\S]*box-shadow:\s*none;[\s\S]*word-wrap:\s*break-word;/,
    );
    assert.doesNotMatch(
        css,
        /\.st-immersive-translation\s*\{[^}]*box-shadow:\s*0 2px 8px rgba[^}]*\}/,
    );
});

test('091 content CSS keeps immersive loading visually present with textual placeholder styling', async () => {
    const css = await readWorkspaceFile('content/content.css');

    assert.match(
        css,
        /\.st-immersive-loading\s*\{[\s\S]*display:\s*block;[\s\S]*padding:\s*0 0 0 10px;[\s\S]*border-left:\s*2px solid var\(--accent\);[\s\S]*animation:\s*st-loading-breathe 1\.5s infinite ease-in-out;/,
    );
    assert.match(
        css,
        /\.st-immersive-loading::before\s*\{[\s\S]*content:\s*'翻译中\.\.\.';[\s\S]*color:\s*var\(--accent\);[\s\S]*font-size:\s*0\.85rem;/,
    );
    assert.match(css, /@keyframes st-loading-breathe\s*\{/);
});
