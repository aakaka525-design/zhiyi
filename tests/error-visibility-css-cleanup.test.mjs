import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('popup error handling reveals the result section and clears stale state on max length errors', async () => {
    const source = await readWorkspaceFile('popup/popup.js');

    assert.match(
        source,
        /if \(text\.length > MAX_CHARS\) \{\s*clearResult\(\);\s*showError\('文本超出最大长度限制'\);\s*return;\s*\}/,
    );
    assert.match(
        source,
        /function showError\(message\) \{\s*elements\.resultSection\.classList\.add\('active'\);[\s\S]*elements\.resultContent\.innerHTML = `<div class="result-error" style="color: var\(--error\)">\$\{escapeHtml\(message\)\}<\/div>`;/,
    );
});

test('options history target keeps only the multi-line clamp rule', async () => {
    const css = await readWorkspaceFile('options/options.css');
    const matches = css.match(/\.history-target\s*\{/g) || [];

    assert.equal(matches.length, 1);
    assert.match(css, /\.history-target\s*\{[\s\S]*-webkit-line-clamp:\s*3;/);
    assert.doesNotMatch(css, /\.history-target\s*\{[\s\S]*white-space:\s*nowrap;/);
});

test('options GLM TTS error message uses the user-facing DeepSeek wording', async () => {
    const source = await readWorkspaceFile('options/options.js');

    assert.match(source, /请先填写 DeepSeek API Key（用于 GLM TTS）/);
    assert.doesNotMatch(source, /请先填写 ppinfra API Key/);
});

test('options about page lists DeepSeek and the offline en-zh capability', async () => {
    const html = await readWorkspaceFile('options/options.html');

    assert.match(
        html,
        /支持 Google、OpenAI、Gemini、DeepSeek 等多种翻译引擎，并提供离线英译中能力。/,
    );
    assert.doesNotMatch(
        html,
        /<strong>多引擎驱动<\/strong>：支持 Google, OpenAI, Gemini 多种服务。/,
    );
});
