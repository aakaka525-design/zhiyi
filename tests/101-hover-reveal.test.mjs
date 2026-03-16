import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('101 replace-mode block wrapper uses animatable hiding instead of clip-path', async () => {
    const css = await readWorkspaceFile('content/content.css');

    assert.match(
        css,
        /body\.st-replace-mode \.st-translated\s*\{[\s\S]*opacity:\s*0;[\s\S]*max-height:\s*0;[\s\S]*transition:\s*opacity 0\.25s ease,\s*max-height 0\.3s ease;/,
    );
    assert.match(
        css,
        /body\.st-replace-mode \.st-translated\s*\{[\s\S]*pointer-events:\s*none;/,
    );
    assert.doesNotMatch(
        css,
        /body\.st-replace-mode \.st-translated\s*\{[^}]*clip-path:/,
    );
});

test('101 keeps the animatable block-wrapper hiding baseline without reverting to clip-path reveal wiring', async () => {
    const css = await readWorkspaceFile('content/content.css');

    assert.doesNotMatch(
        css,
        /body\.st-replace-mode \.st-translated:has\(\+ \.st-immersive-wrapper:hover\),[\s\S]*body\.st-replace-mode \.st-translated:hover\s*\{/,
    );
    assert.doesNotMatch(
        css,
        /body\.st-replace-mode \.st-translated\s*\{[^}]*position:\s*absolute\s*!important;/,
    );
});

test('101 does not change replace-mode inline or cell hiding semantics', async () => {
    const css = await readWorkspaceFile('content/content.css');

    assert.match(
        css,
        /body\.st-replace-mode \.st-translated-inline\s*\{[\s\S]*font-size:\s*0\s*!important;/,
    );
    assert.match(
        css,
        /\.st-translated-inline > \*:not\(\.st-immersive-translation\):not\(\.st-immersive-loading\)\s*\{[\s\S]*clip-path:\s*inset\(50%\)\s*!important;/,
    );
});
