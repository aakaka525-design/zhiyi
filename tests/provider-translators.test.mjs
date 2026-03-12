import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { GeminiTranslator } from '../src/core/gemini.js';
import { OpenAITranslator } from '../src/core/openai.js';
import { DeepSeekTranslator } from '../src/core/deepseek.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

function createJsonResponse(payload) {
    return {
        ok: true,
        async json() {
            return payload;
        },
    };
}

test('Gemini translateBatch sends the same safetySettings policy as single translate', async () => {
    const translator = new GeminiTranslator('test-key');
    let capturedBody = null;

    globalThis.fetch = async (_url, options) => {
        capturedBody = JSON.parse(options.body);
        return createJsonResponse({
            candidates: [{ content: { parts: [{ text: '[1] 你好' }] } }],
        });
    };

    await translator.translateBatch(['hello'], 'en', 'zh');

    assert.deepEqual(capturedBody.safetySettings, [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ]);
});

test('Gemini translate prompt includes the richer translation requirements', async () => {
    const translator = new GeminiTranslator('test-key');
    let capturedBody = null;

    globalThis.fetch = async (_url, options) => {
        capturedBody = JSON.parse(options.body);
        return createJsonResponse({
            candidates: [{ content: { parts: [{ text: '你好' }] } }],
        });
    };

    await translator.translate('hello', 'en', 'zh');

    const prompt = capturedBody.contents?.[0]?.parts?.[0]?.text || '';
    assert.match(prompt, /保持原文的语气和风格/);
    assert.match(prompt, /专业术语/);
    assert.match(prompt, /专有名词/);
});

test('Gemini translateBatch prompt also includes the richer translation requirements', async () => {
    const translator = new GeminiTranslator('test-key');
    let capturedBody = null;

    globalThis.fetch = async (_url, options) => {
        capturedBody = JSON.parse(options.body);
        return createJsonResponse({
            candidates: [{ content: { parts: [{ text: '[1] 你好' }] } }],
        });
    };

    await translator.translateBatch(['hello'], 'en', 'zh');

    const prompt = capturedBody.contents?.[0]?.parts?.[0]?.text || '';
    assert.match(prompt, /保持原文的语气和风格/);
    assert.match(prompt, /专业术语/);
    assert.match(prompt, /专有名词/);
});

test('Gemini updateConfig allows clearing apiKey and model', () => {
    const translator = new GeminiTranslator('old-key', 'old-model');

    translator.updateConfig('', '');

    assert.equal(translator.apiKey, '');
    assert.equal(translator.model, '');
});

test('OpenAI updateConfig allows clearing apiKey, baseUrl, and model', () => {
    const translator = new OpenAITranslator('old-key', 'https://example.com/v1', 'old-model');

    translator.updateConfig('', '', '');

    assert.equal(translator.apiKey, '');
    assert.equal(translator.baseUrl, '');
    assert.equal(translator.model, '');
});

test('DeepSeek constructor removes a trailing slash from baseUrl', () => {
    const translator = new DeepSeekTranslator('key', 'https://api.ppinfra.com/openai/', 'model');

    assert.equal(translator.baseUrl, 'https://api.ppinfra.com/openai');
});

test('DeepSeek updateConfig allows clearing values and normalizes baseUrl', () => {
    const translator = new DeepSeekTranslator('old-key', 'https://api.ppinfra.com/openai', 'old-model');

    translator.updateConfig('', 'https://alt.example.com/', '');
    assert.equal(translator.apiKey, '');
    assert.equal(translator.baseUrl, 'https://alt.example.com');
    assert.equal(translator.model, '');
});
