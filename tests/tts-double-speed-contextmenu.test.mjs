import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('popup and options offscreen playback no longer reapply TTS speed', async () => {
    const popup = await readWorkspaceFile('popup/popup.js');
    const options = await readWorkspaceFile('options/options.js');

    assert.match(
        popup,
        /chrome\.runtime\.sendMessage\(\{\s*action: 'playAudioOffscreen',\s*audioData,\s*\}\)/,
    );
    assert.doesNotMatch(
        popup,
        /chrome\.runtime\.sendMessage\(\{\s*action: 'playAudioOffscreen',\s*audioData,\s*speed,\s*\}\)/,
    );

    assert.match(
        options,
        /const playbackResponse = await withTimeout\(\s*chrome\.runtime\.sendMessage\(\{\s*action: 'playAudioOffscreen',\s*audioData,\s*\}\),\s*15000,\s*'播放超时',\s*\);/,
    );
    assert.doesNotMatch(
        options,
        /chrome\.runtime\.sendMessage\(\{\s*action: 'playAudioOffscreen',\s*audioData,\s*speed,\s*\}\)/,
    );
});

test('context menus are restricted to http and https document schemes', async () => {
    const menus = await readWorkspaceFile('background/modules/menus.js');

    const patternMatches = menus.match(/documentUrlPatterns:\s*\['http:\/\/\*\/\*', 'https:\/\/\*\/\*'\]/g) || [];
    assert.equal(patternMatches.length, 4, 'expected all four context menus to declare http/https documentUrlPatterns');

    assert.match(
        menus,
        /id: 'translate-selection'[\s\S]*contexts: \['selection'\],[\s\S]*documentUrlPatterns: \['http:\/\/\*\/\*', 'https:\/\/\*\/\*'\]/,
    );
    assert.match(
        menus,
        /id: 'translate-page'[\s\S]*contexts: \['page'\],[\s\S]*documentUrlPatterns: \['http:\/\/\*\/\*', 'https:\/\/\*\/\*'\]/,
    );
    assert.match(
        menus,
        /id: 'separator'[\s\S]*contexts: \['selection', 'page'\],[\s\S]*documentUrlPatterns: \['http:\/\/\*\/\*', 'https:\/\/\*\/\*'\]/,
    );
    assert.match(
        menus,
        /id: 'open-settings'[\s\S]*contexts: \['selection', 'page'\],[\s\S]*documentUrlPatterns: \['http:\/\/\*\/\*', 'https:\/\/\*\/\*'\]/,
    );
});
