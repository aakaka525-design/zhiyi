import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('102 content CSS defines original bubble styles, token scope, and removes 101 in-place hover reveal', async () => {
    const css = await readWorkspaceFile('content/content.css');

    assert.match(
        css,
        /#smart-translator-bubble,[\s\S]*#st-toast,\s*#st-original-bubble\s*\{/,
    );
    assert.match(
        css,
        /:root\[data-st-theme="dark"\] #smart-translator-bubble,[\s\S]*:root\[data-st-theme="dark"\] #st-toast,\s*:root\[data-st-theme="dark"\] #st-original-bubble\s*\{/,
    );
    assert.match(
        css,
        /#st-original-bubble\s*\{[\s\S]*position:\s*fixed;[\s\S]*background:\s*var\(--surface\);[\s\S]*pointer-events:\s*none;[\s\S]*opacity:\s*0;/,
    );
    assert.match(
        css,
        /#st-original-bubble\.active\s*\{[\s\S]*opacity:\s*1;/,
    );
    assert.doesNotMatch(
        css,
        /body\.st-replace-mode \.st-translated:has\(\+ \.st-immersive-wrapper:hover\),[\s\S]*body\.st-replace-mode \.st-translated:hover\s*\{/,
    );
});

test('102 immersive module stores scoped original text and includes hover bubble helpers', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(immersive, /data-st-original-text/);
    assert.match(immersive, /function setOriginalTextAttr\(el, text\)/);
    assert.match(immersive, /function getOriginalTextAttr\(el\)/);
    assert.match(immersive, /function removeOriginalTextAttr\(el\)/);
    assert.match(immersive, /function getOriginalTextSource\(el\)/);
    assert.match(immersive, /function positionOriginalBubble\(rect, bubbleWidth, bubbleHeight, viewportW, viewportH\)/);
    assert.match(immersive, /function handleBubbleMouseOver\(e\)/);
    assert.match(immersive, /function handleBubbleMouseOut\(e\)/);
    assert.match(
        immersive,
        /document\.querySelectorAll\('\.st-immersive-wrapper, \.st-translated-inline'\)\.forEach\(el => \{\s*removeOriginalTextAttr\(el\);/s,
    );
});

test('102 settings chain adds hoverShowOriginal with default-true semantics', async () => {
    const storage = await readWorkspaceFile('src/core/storage.js');
    const optionsHtml = await readWorkspaceFile('options/options.html');
    const optionsJs = await readWorkspaceFile('options/options.js');
    const uiState = await readWorkspaceFile('options/options-ui-state.js');

    assert.match(storage, /hoverShowOriginal:\s*true/);
    assert.match(optionsHtml, /id="hover-show-original"/);
    assert.match(optionsJs, /hoverShowOriginal:\s*document\.getElementById\('hover-show-original'\)/);
    assert.match(optionsJs, /elements\.hoverShowOriginal\.checked\s*=\s*settings\.hoverShowOriginal !== false;/);
    assert.match(optionsJs, /saveImmediateToggle\(\{\s*hoverShowOriginal:\s*e\.target\.checked\s*\}\)/);
    assert.match(uiState, /hoverShowOriginal:\s*settings\.hoverShowOriginal !== false/);
    assert.doesNotMatch(uiState, /hoverShowOriginal:\s*Boolean\(settings\.hoverShowOriginal\)/);
});
