import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { installChromeStub } from './helpers/chrome-stub.mjs';
import { StorageManager } from '../src/core/storage.js';

const { store, reset } = installChromeStub();

beforeEach(() => {
    reset();
});

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('clearFavorites clears persisted favorites data', async () => {
    await StorageManager.addFavorite({ source: 'hello', target: '你好', provider: 'google' });
    await StorageManager.addFavorite({ source: 'world', target: '世界', provider: 'openai' });

    await StorageManager.clearFavorites();

    assert.deepEqual(await StorageManager.getFavorites(), []);
    assert.deepEqual(store.favorites, []);
});

test('options history clear button follows the current tab context', async () => {
    const options = await readWorkspaceFile('options/options.js');

    assert.match(
        options,
        /function updateClearBtnContext\(type\) \{\s*elements\.clearHistoryBtn\.textContent = type === 'favorite' \? '清空所有收藏' : '清空所有历史';\s*\}/,
    );
    assert.match(
        options,
        /function switchHistoryTab\(type\) \{[\s\S]*updateClearBtnContext\(type\);\s*loadHistoryList\(type\);\s*\}/,
    );
    assert.match(
        options,
        /elements\.clearHistoryBtn\.addEventListener\('click', async \(\) => \{\s*const isFavorite = currentHistoryType === 'favorite';\s*const label = isFavorite \? '收藏' : '翻译历史';\s*if \(confirm\(`确定要清空所有\$\{label\}记录吗？`\)\) \{\s*if \(isFavorite\) \{\s*await StorageManager\.clearFavorites\(\);\s*\} else \{\s*await StorageManager\.clearHistory\(\);\s*\}\s*loadHistoryList\(currentHistoryType\);\s*\}\s*\}\);/,
    );
});

test('loadHistoryList re-applies the current search query after refresh', async () => {
    const options = await readWorkspaceFile('options/options.js');

    assert.match(
        options,
        /async function loadHistoryList\(type\) \{\s*currentHistoryType = type;[\s\S]*currentHistoryData = data;\s*const query = document\.getElementById\('history-search'\)\?\.value \|\| '';\s*filterHistoryList\(query\);\s*\}/,
    );
});
