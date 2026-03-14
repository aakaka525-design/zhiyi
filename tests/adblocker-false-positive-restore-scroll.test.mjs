import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('closePopupAds uses token-level ad matching instead of raw substring includes', async () => {
    const source = await readWorkspaceFile('content/modules/ad-blocker.js');

    assert.match(
        source,
        /const hasAdToken = \(str\) => str\.split\(\/\[\\s_-\]\+\/\)\.some\(t => t === 'ad' \|\| t === 'ads'\);/,
    );
    assert.match(source, /hasAdToken\(className\)/);
    assert.match(source, /hasAdToken\(id\)/);
    assert.doesNotMatch(source, /className\.includes\('ad'\)/);
    assert.doesNotMatch(source, /id\.includes\('ad'\)/);
});

test('closePopupAds returns whether it removed popup elements', async () => {
    const source = await readWorkspaceFile('content/modules/ad-blocker.js');

    assert.match(source, /let removed = false;/);
    assert.match(source, /removed = true;/);
    assert.match(source, /return removed;\s*\n\s*\};/);
});

test('observer restores scroll only when closePopupAds actually removed a popup', async () => {
    const source = await readWorkspaceFile('content/modules/ad-blocker.js');

    assert.match(
        source,
        /if \(hasNewAds\) \{\s*removeAds\(\);\s*if \(closePopupAds\(\)\) \{\s*restoreScroll\(\);\s*\}\s*\}/,
    );
    assert.match(
        source,
        /const enable = \(\) => \{\s*injectStyles\(\);\s*removeAds\(\);\s*closePopupAds\(\);\s*restoreScroll\(\);/,
    );
});
