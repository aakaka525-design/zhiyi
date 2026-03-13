import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { routeMessage } from '../background/modules/message-router.js';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('popup wires status dot state and re-syncs favorite icon after swap', async () => {
    const popup = await readWorkspaceFile('popup/popup.js');

    assert.match(
        popup,
        /statusDot:\s*document\.querySelector\('\.status-dot'\)/,
    );
    assert.match(
        popup,
        /if \(currentResult\) \{\s*elements\.sourceText\.value = currentResult;\s*updateCharCount\(\);\s*syncFavoriteState\(\);\s*\}/,
    );
    assert.match(
        popup,
        /if \(elements\.statusDot\) \{\s*const hasKey = settings\.provider === 'google'\s*\|\|\s*settings\.provider === 'offline'[\s\S]*elements\.statusDot\.classList\.toggle\('active', !!hasKey\);\s*\}/,
    );
});

test('routeMessage forwards addHistory requests to storage.addHistory', async () => {
    const calls = [];
    const item = { source: 'hello', target: '你好' };

    const result = await routeMessage(
        { action: 'addHistory', item },
        {
            translator: {},
            storage: {
                async addHistory(historyItem) {
                    calls.push(historyItem);
                    return { id: '1', ...historyItem };
                },
            },
            tts: {},
        },
    );

    assert.deepEqual(calls, [item]);
    assert.deepEqual(result, { id: '1', ...item });
});

test('sidebar persists history before refreshing the list', async () => {
    const sidebar = await readWorkspaceFile('content/modules/sidebar.js');

    assert.match(
        sidebar,
        /await ST\.sendMessage\(\{\s*action: 'addHistory',\s*item: \{\s*source: text,\s*target: response\.text,\s*sourceLang: sourceLangSelect\.value,\s*targetLang: targetLangSelect\.value,\s*provider: response\.provider \|\| '',\s*\}\s*\}\);\s*(?:await\s+)?ST\.refreshSidebarHistory\(\);/,
    );
    assert.doesNotMatch(
        sidebar,
        /setTimeout\(\(\) => ST\.refreshSidebarHistory\(\), 500\)/,
    );
});

test('float-window writes successful translations into history with auto source language', async () => {
    const floatWindow = await readWorkspaceFile('content/modules/float-window.js');

    assert.match(
        floatWindow,
        /ST\.sendMessage\(\{\s*action: 'addHistory',\s*item: \{\s*source: text,\s*target: response\.text,\s*sourceLang: 'auto',\s*targetLang: targetLangSelect\.value,\s*provider: response\.provider \|\| '',\s*\}\s*\}\);/,
    );
});
