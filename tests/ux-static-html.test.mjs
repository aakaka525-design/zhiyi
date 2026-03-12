import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('options general toggles do not hardcode checked state that conflicts with defaults', async () => {
    const html = await readWorkspaceFile('options/options.html');

    assert.doesNotMatch(
        html,
        /<input type="checkbox" id="show-floating-ball" checked>/,
    );
    assert.doesNotMatch(
        html,
        /<input type="checkbox" id="enable-ad-block" checked>/,
    );
});

test('popup footer does not hardcode Google as the initial provider label', async () => {
    const html = await readWorkspaceFile('popup/popup.html');

    assert.doesNotMatch(
        html,
        /<span class="service-name" id="current-service">Google 翻译<\/span>/,
    );
});

test('DeepSeek section title does not expose ppinfra implementation detail', async () => {
    const html = await readWorkspaceFile('options/options.html');

    assert.doesNotMatch(
        html,
        /<h3>ppinfra 配置 \(DeepSeek\)<\/h3>/,
    );
    assert.match(
        html,
        /<h3>DeepSeek 配置<\/h3>/,
    );
});

test('options uses a button-based shortcut guidance entry instead of a chrome:// anchor', async () => {
    const html = await readWorkspaceFile('options/options.html');

    assert.doesNotMatch(
        html,
        /<a href="chrome:\/\/extensions\/shortcuts" target="_blank" class="btn btn-secondary"/,
    );
    assert.match(
        html,
        /<button type="button" id="shortcut-settings-btn" class="btn btn-secondary"/,
    );
});
