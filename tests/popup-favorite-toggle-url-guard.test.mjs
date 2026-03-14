import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('popup favorite button toggles favorite state using trimmed source text', async () => {
    const popup = await readWorkspaceFile('popup/popup.js');

    assert.match(
        popup,
        /elements\.btnFavorite\.addEventListener\('click', async \(\) => \{\s*const sourceText = elements\.sourceText\.value\.trim\(\);\s*if \(!currentResult \|\| !sourceText\) return;/,
    );
    assert.match(
        popup,
        /const favorites = await StorageManager\.getFavorites\(\);\s*const existing = favorites\.find\(f => f\.source === sourceText\);/,
    );
    assert.match(
        popup,
        /if \(existing\) \{\s*await StorageManager\.removeFavorite\(existing\.id\);\s*showToast\('已取消收藏'\);\s*\} else \{\s*await StorageManager\.addFavorite\(\{\s*source: sourceText,/,
    );
    assert.match(
        popup,
        /await syncFavoriteState\(\);\s*\} catch \(err\) \{\s*console\.error\('\[智译\] 收藏操作失败:', err\);\s*\}/,
    );
});

test('popup defines a shared supported-page helper and reuses it for all tab messaging entry points', async () => {
    const popup = await readWorkspaceFile('popup/popup.js');

    assert.match(
        popup,
        /const isSupportedPageUrl = \(url\) => \/\^https\?:\\\/\\\/\//,
    );
    assert.match(popup, /if \(tab\?\.id && isSupportedPageUrl\(tab\.url\)\) \{\s*await chrome\.tabs\.sendMessage\(tab\.id, \{ action: 'toggleImmersive' \}\);/);
    assert.match(popup, /if \(tab\?\.id && isSupportedPageUrl\(tab\.url\)\) \{\s*await chrome\.tabs\.sendMessage\(tab\.id, \{ action: 'toggleSidebar' \}\);/);
    assert.match(popup, /if \(tab\?\.id && isSupportedPageUrl\(tab\.url\)\) \{\s*await chrome\.tabs\.sendMessage\(tab\.id, \{ action: 'toggleFloatWindow' \}\);/);
    assert.match(popup, /if \(tab\?\.id && isSupportedPageUrl\(tab\.url\)\) \{\s*const response = await chrome\.tabs\.sendMessage\(tab\.id, \{ action: 'getSelectedText' \}\);/);
});

test('popup no longer hardcodes a chrome:// blacklist for feature entry points', async () => {
    const popup = await readWorkspaceFile('popup/popup.js');

    assert.doesNotMatch(popup, /tab\.url\?\.startsWith\('chrome:\/\/'\)/);
});
