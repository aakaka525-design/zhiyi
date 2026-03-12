import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { Translator } from '../src/core/translator.js';

const originalWarn = console.warn;

beforeEach(() => {
    console.warn = () => {};
});

afterEach(() => {
    console.warn = originalWarn;
});

function createProvider(result = '', options = {}) {
    return {
        calls: [],
        async translate(text, from, to) {
            this.calls.push({ text, from, to });
            if (options.error) {
                throw options.error;
            }
            return typeof result === 'function' ? result(text, from, to) : result;
        },
        async translateBatch(texts, from, to) {
            this.calls.push({ texts, from, to, batch: true });
            if (options.batchError) {
                throw options.batchError;
            }
            if (options.batchResult) {
                return options.batchResult(texts, from, to);
            }
            return texts.map((text) => `${result}:${text}`);
        },
    };
}

function createTranslator(settings = {}, providers = {}) {
    const translator = new Translator();
    translator.settings = {
        provider: 'google',
        openaiApiKey: '',
        geminiApiKey: '',
        deepseekApiKey: '',
        ...settings,
    };
    translator.providers = {
        google: createProvider('google-result'),
        openai: createProvider('openai-result'),
        gemini: createProvider('gemini-result'),
        deepseek: createProvider('deepseek-result'),
        offline: createProvider('offline-result'),
        ...providers,
    };
    return translator;
}

test('translate uses settings.provider by default', async () => {
    const translator = createTranslator({ provider: 'google' });

    const result = await translator.translate('hello', 'en', 'zh');

    assert.equal(result.text, 'google-result');
    assert.equal(result.provider, 'google');
    assert.equal(translator.providers.google.calls.length, 1);
});

test('translate explicit provider overrides settings.provider', async () => {
    const translator = createTranslator({ provider: 'google', openaiApiKey: 'sk-test' });

    const result = await translator.translate('hello', 'en', 'zh', 'openai');

    assert.equal(result.text, 'openai-result');
    assert.equal(result.provider, 'openai');
    assert.equal(translator.providers.google.calls.length, 0);
    assert.equal(translator.providers.openai.calls.length, 1);
});

test('translate throws for an unknown provider', async () => {
    const translator = createTranslator();

    await assert.rejects(
        translator.translate('hello', 'en', 'zh', 'missing'),
        /未知的翻译服务/
    );
});

test('translate falls back to google when openai api key is missing', async () => {
    const translator = createTranslator({ provider: 'openai', openaiApiKey: '' });

    const result = await translator.translate('hello', 'en', 'zh');

    assert.equal(result.text, 'google-result');
    assert.equal(result.provider, 'google');
    assert.equal(translator.providers.openai.calls.length, 0);
    assert.equal(translator.providers.google.calls.length, 1);
});

test('translate falls back to google when gemini api key is missing', async () => {
    const translator = createTranslator({ provider: 'gemini', geminiApiKey: '' });

    const result = await translator.translate('hello', 'en', 'zh');

    assert.equal(result.text, 'google-result');
    assert.equal(result.provider, 'google');
    assert.equal(translator.providers.gemini.calls.length, 0);
    assert.equal(translator.providers.google.calls.length, 1);
});

test('translate falls back to google when deepseek api key is missing', async () => {
    const translator = createTranslator({ provider: 'deepseek', deepseekApiKey: '' });

    const result = await translator.translate('hello', 'en', 'zh');

    assert.equal(result.text, 'google-result');
    assert.equal(result.provider, 'google');
    assert.equal(translator.providers.deepseek.calls.length, 0);
    assert.equal(translator.providers.google.calls.length, 1);
});

test('translate falls back to google when the primary provider throws', async () => {
    const primaryError = new Error('openai failed');
    const translator = createTranslator(
        { provider: 'openai', openaiApiKey: 'sk-test' },
        { openai: createProvider('', { error: primaryError }) }
    );

    const result = await translator.translate('hello', 'en', 'zh');

    assert.equal(result.text, 'google-result');
    assert.equal(result.provider, 'google');
    assert.equal(translator.providers.openai.calls.length, 1);
    assert.equal(translator.providers.google.calls.length, 1);
});

test('translate falls back to offline when google throws', async () => {
    const googleError = new Error('google failed');
    const translator = createTranslator(
        { provider: 'google' },
        {
            google: createProvider('', { error: googleError }),
            offline: createProvider('offline-fallback'),
        }
    );

    const result = await translator.translate('hello', 'en', 'zh');

    assert.equal(result.text, 'offline-fallback');
    assert.equal(result.provider, 'offline');
    assert.equal(translator.providers.google.calls.length, 1);
    assert.equal(translator.providers.offline.calls.length, 1);
});

test('translate rethrows the original google error when offline also fails', async () => {
    const googleError = new Error('google failed');
    const offlineError = new Error('offline failed');
    const translator = createTranslator(
        { provider: 'google' },
        {
            google: createProvider('', { error: googleError }),
            offline: createProvider('', { error: offlineError }),
        }
    );

    await assert.rejects(
        translator.translate('hello', 'en', 'zh'),
        (error) => error === googleError
    );
});

test('translate does not fall back when offline is explicitly selected and fails', async () => {
    const offlineError = new Error('offline failed');
    const translator = createTranslator(
        { provider: 'offline' },
        {
            offline: createProvider('', { error: offlineError }),
        }
    );

    await assert.rejects(
        translator.translate('hello', 'en', 'zh'),
        (error) => error === offlineError
    );
    assert.equal(translator.providers.google.calls.length, 0);
});

test('detectLanguage classifies zh ja ko and en text', async () => {
    const translator = createTranslator();

    assert.equal(await translator.detectLanguage('你好，世界'), 'zh');
    assert.equal(await translator.detectLanguage('こんにちは'), 'ja');
    assert.equal(await translator.detectLanguage('안녕하세요'), 'ko');
    assert.equal(await translator.detectLanguage('hello world'), 'en');
});

test('translateBatch uses provider batch support for openai and gemini', async () => {
    const openai = createProvider('unused', {
        batchResult(texts) {
            return texts.map((text) => `openai-batch:${text}`);
        },
    });
    const gemini = createProvider('unused', {
        batchResult(texts) {
            return texts.map((text) => `gemini-batch:${text}`);
        },
    });

    const openaiTranslator = createTranslator(
        { provider: 'openai', openaiApiKey: 'sk-test' },
        { openai }
    );
    const geminiTranslator = createTranslator(
        { provider: 'gemini', geminiApiKey: 'gm-test' },
        { gemini }
    );

    assert.deepEqual(
        await openaiTranslator.translateBatch(['a', 'b'], 'en', 'zh'),
        ['openai-batch:a', 'openai-batch:b']
    );
    assert.deepEqual(
        await geminiTranslator.translateBatch(['a', 'b'], 'en', 'zh'),
        ['gemini-batch:a', 'gemini-batch:b']
    );
    assert.equal(openai.calls.length, 1);
    assert.equal(gemini.calls.length, 1);
});

test('translateBatch falls back to per-item translate for non-batch providers', async () => {
    const translator = createTranslator(
        { provider: 'google' },
        {
            google: createProvider((text) => `google:${text}`),
        }
    );

    const result = await translator.translateBatch(['one', 'two'], 'en', 'zh');

    assert.deepEqual(result, ['google:one', 'google:two']);
    assert.equal(translator.providers.google.calls.length, 2);
    assert.deepEqual(translator.providers.google.calls[0], {
        text: 'one',
        from: 'en',
        to: 'zh',
    });
});
