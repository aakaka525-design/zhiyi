import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('immersive translation uses accent tokens in both token scope and render paths', async () => {
    const css = await readWorkspaceFile('content/content.css');
    const immersive = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(
        css,
        /#st-floating-ball-container,\s*\.st-immersive-translation,\s*\.st-translation-separator,\s*#st-toast\s*\{/,
    );
    assert.match(
        css,
        /\.st-immersive-translation\s*\{[\s\S]*color:\s*var\(--accent\);[\s\S]*border-left:\s*3px solid var\(--accent\);/,
    );

    assert.match(
        immersive,
        /separator\.style\.cssText = 'color: var\(--accent\); opacity: 0\.6;';/,
    );
    assert.match(
        immersive,
        /transEl\.style\.cssText = 'display: inline; font-style: normal; color: var\(--accent\); margin-left: 4px;';/,
    );
    assert.doesNotMatch(immersive, /#8DA399/);
});

test('popup showToast removes all existing toasts before rendering a new one', async () => {
    const popup = await readWorkspaceFile('popup/popup.js');

    assert.match(
        popup,
        /function showToast\(message\) \{\s*document\.querySelectorAll\('\.toast'\)\.forEach\(el => el\.remove\(\)\);\s*const toast = document\.createElement\('div'\);/,
    );
});

test('floating-ball no longer logs settings or init debug messages', async () => {
    const floatingBall = await readWorkspaceFile('content/modules/floating-ball.js');

    assert.doesNotMatch(floatingBall, /FloatingBall init called/);
    assert.doesNotMatch(floatingBall, /Settings:/);
    assert.doesNotMatch(floatingBall, /Setting changed, showFloatingBall:/);
});

test('ad-blocker uses the shared plugin element guard instead of a partial #st- selector', async () => {
    const adBlocker = await readWorkspaceFile('content/modules/ad-blocker.js');

    assert.match(adBlocker, /if \(ST\.isPluginElement\(el\)\) return;/);
    assert.doesNotMatch(adBlocker, /if \(el\.closest\('#st-'\)\) return;/);
});
