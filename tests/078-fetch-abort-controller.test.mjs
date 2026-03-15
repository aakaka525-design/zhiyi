import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { pathToFileURL } from 'node:url';

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

async function fileExists(path) {
    try {
        await access(new URL(`../${path}`, import.meta.url), constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

function countMatches(source, regex) {
    return (source.match(regex) || []).length;
}

test('fetchWithTimeout helper exists and exports a narrow AbortController wrapper', async () => {
    assert.equal(await fileExists('src/core/fetch-with-timeout.js'), true);

    const helper = await readWorkspaceFile('src/core/fetch-with-timeout.js');
    assert.match(helper, /export function fetchWithTimeout\(url, options = \{\}, timeoutMs, timeoutMessage = '请求超时'\)/);
    assert.match(helper, /const controller = new AbortController\(\);/);
    assert.match(helper, /const timeoutId = setTimeout\(\(\) => controller\.abort\(\), timeoutMs\);/);
    assert.match(helper, /if \(err\.name === 'AbortError'\) \{\s*throw new Error\(timeoutMessage\);\s*\}/s);
});

test('fetchWithTimeout remaps AbortError to the provided readable timeout message', async () => {
    assert.equal(await fileExists('src/core/fetch-with-timeout.js'), true);

    globalThis.fetch = (_url, options = {}) => new Promise((_, reject) => {
        options.signal?.addEventListener('abort', () => {
            const abortError = new Error('The operation was aborted.');
            abortError.name = 'AbortError';
            reject(abortError);
        });
    });

    const helperUrl = pathToFileURL('/Users/xa/Desktop/projiect/zhiyi/src/core/fetch-with-timeout.js').href;
    const { fetchWithTimeout } = await import(`${helperUrl}?t=${Date.now()}`);

    await assert.rejects(
        fetchWithTimeout('https://example.com', {}, 5, '翻译请求超时'),
        /翻译请求超时/,
    );
});

test('network translators import fetchWithTimeout, replace raw fetch, and use layered timeouts', async () => {
    const googleFree = await readWorkspaceFile('src/core/google-free.js');
    const openai = await readWorkspaceFile('src/core/openai.js');
    const gemini = await readWorkspaceFile('src/core/gemini.js');
    const deepseek = await readWorkspaceFile('src/core/deepseek.js');

    assert.match(googleFree, /import \{ fetchWithTimeout \} from '\.\/fetch-with-timeout\.js';/);
    assert.equal(countMatches(googleFree, /fetchWithTimeout\(/g), 3);
    assert.equal(countMatches(googleFree, /\bfetch\(/g), 0);
    assert.match(googleFree, /8000,\s*'翻译请求超时'/);
    assert.match(googleFree, /5000,\s*'语言检测超时'/);

    assert.match(openai, /import \{ fetchWithTimeout \} from '\.\/fetch-with-timeout\.js';/);
    assert.equal(countMatches(openai, /fetchWithTimeout\(/g), 2);
    assert.equal(countMatches(openai, /\bfetch\(/g), 0);
    assert.match(openai, /20000,\s*'翻译请求超时'/);
    assert.match(openai, /45000,\s*'批量翻译请求超时'/);

    assert.match(gemini, /import \{ fetchWithTimeout \} from '\.\/fetch-with-timeout\.js';/);
    assert.equal(countMatches(gemini, /fetchWithTimeout\(/g), 2);
    assert.equal(countMatches(gemini, /\bfetch\(/g), 0);
    assert.match(gemini, /20000,\s*'翻译请求超时'/);
    assert.match(gemini, /45000,\s*'批量翻译请求超时'/);

    assert.match(deepseek, /import \{ fetchWithTimeout \} from '\.\/fetch-with-timeout\.js';/);
    assert.equal(countMatches(deepseek, /fetchWithTimeout\(/g), 1);
    assert.equal(countMatches(deepseek, /\bfetch\(/g), 0);
    assert.match(deepseek, /20000,\s*'翻译请求超时'/);
});

test('tts handlers import fetchWithTimeout, avoid raw fetch, and stay under the 15s client timeout', async () => {
    const tts = await readWorkspaceFile('background/modules/tts.js');

    assert.match(tts, /import \{ fetchWithTimeout \} from '\.\.\/\.\.\/src\/core\/fetch-with-timeout\.js';/);
    assert.equal(countMatches(tts, /fetchWithTimeout\(/g), 3);
    assert.equal(countMatches(tts, /\bfetch\(/g), 0);
    assert.equal(countMatches(tts, /12000,\s*'TTS 请求超时'/g), 3);
});

test('offline translator remains unchanged and does not adopt fetchWithTimeout', async () => {
    const offline = await readWorkspaceFile('src/core/offline.js');

    assert.doesNotMatch(offline, /fetchWithTimeout/);
    assert.match(offline, /const response = await fetch\(url\);/);
});
