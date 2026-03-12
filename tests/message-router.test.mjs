import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { routeMessage } from '../background/modules/message-router.js';

const originalWarn = console.warn;

beforeEach(() => {
    console.warn = () => {};
});

afterEach(() => {
    console.warn = originalWarn;
});

function createTranslator() {
    return {
        translateCalls: [],
        translateBatchCalls: [],
        refreshSettingsCalls: 0,
        async translate(text, from, to, provider) {
            this.translateCalls.push({ text, from, to, provider });
            return { text: `[translated] ${text}`, provider: provider || 'google', from, to };
        },
        async translateBatch(texts, from, to) {
            this.translateBatchCalls.push({ texts, from, to });
            return texts.map((text) => `[batch] ${text}`);
        },
        async refreshSettings() {
            this.refreshSettingsCalls += 1;
        },
    };
}

function createStorage() {
    return {
        getSettingsCalls: 0,
        getHistoryCalls: 0,
        async getSettings() {
            this.getSettingsCalls += 1;
            return { provider: 'google', targetLang: 'zh' };
        },
        async getHistory() {
            this.getHistoryCalls += 1;
            return [{ source: 'hello', target: '你好' }];
        },
    };
}

function createTts() {
    return {
        glmCalls: [],
        openaiCalls: [],
        googleCalls: [],
        playCalls: [],
        async handleTTSGLM(request) {
            this.glmCalls.push(request);
            return { audioData: 'glm-audio' };
        },
        async handleTTSOpenAI(request) {
            this.openaiCalls.push(request);
            return { audioData: 'openai-audio' };
        },
        async handleTTSGoogle(request) {
            this.googleCalls.push(request);
            return { audioData: 'google-audio' };
        },
        async playAudioViaOffscreen(audioData, speed) {
            this.playCalls.push({ audioData, speed });
            return { success: true };
        },
    };
}

function createDeps() {
    return {
        translator: createTranslator(),
        storage: createStorage(),
        tts: createTts(),
    };
}

test('routeMessage forwards translate requests to translator.translate', async () => {
    const deps = createDeps();

    const result = await routeMessage({
        action: 'translate',
        text: 'hello',
        from: 'en',
        to: 'zh',
        provider: 'openai',
    }, deps);

    assert.deepEqual(result, {
        text: '[translated] hello',
        provider: 'openai',
        from: 'en',
        to: 'zh',
    });
    assert.deepEqual(deps.translator.translateCalls, [{
        text: 'hello',
        from: 'en',
        to: 'zh',
        provider: 'openai',
    }]);
});

test('routeMessage wraps translateBatch results in an object', async () => {
    const deps = createDeps();

    const result = await routeMessage({
        action: 'translateBatch',
        texts: ['one', 'two'],
        from: 'en',
        to: 'zh',
    }, deps);

    assert.deepEqual(result, {
        results: ['[batch] one', '[batch] two'],
    });
    assert.deepEqual(deps.translator.translateBatchCalls, [{
        texts: ['one', 'two'],
        from: 'en',
        to: 'zh',
    }]);
});

test('routeMessage forwards ttsGLM requests to the glm handler', async () => {
    const deps = createDeps();
    const request = { action: 'ttsGLM', text: 'hello', apiKey: 'key' };

    const result = await routeMessage(request, deps);

    assert.deepEqual(result, { audioData: 'glm-audio' });
    assert.deepEqual(deps.tts.glmCalls, [request]);
});

test('routeMessage forwards ttsOpenAI requests to the openai handler', async () => {
    const deps = createDeps();
    const request = { action: 'ttsOpenAI', text: 'hello', apiKey: 'key' };

    const result = await routeMessage(request, deps);

    assert.deepEqual(result, { audioData: 'openai-audio' });
    assert.deepEqual(deps.tts.openaiCalls, [request]);
});

test('routeMessage forwards ttsGoogle requests to the google handler', async () => {
    const deps = createDeps();
    const request = { action: 'ttsGoogle', text: 'hello', apiKey: 'key' };

    const result = await routeMessage(request, deps);

    assert.deepEqual(result, { audioData: 'google-audio' });
    assert.deepEqual(deps.tts.googleCalls, [request]);
});

test('routeMessage forwards playAudioOffscreen requests to the offscreen handler', async () => {
    const deps = createDeps();

    const result = await routeMessage({
        action: 'playAudioOffscreen',
        audioData: 'data:audio/mp3;base64,abc',
        speed: 1.25,
    }, deps);

    assert.deepEqual(result, { success: true });
    assert.deepEqual(deps.tts.playCalls, [{
        audioData: 'data:audio/mp3;base64,abc',
        speed: 1.25,
    }]);
});

test('routeMessage forwards getSettings requests to storage.getSettings', async () => {
    const deps = createDeps();

    const result = await routeMessage({ action: 'getSettings' }, deps);

    assert.deepEqual(result, { provider: 'google', targetLang: 'zh' });
    assert.equal(deps.storage.getSettingsCalls, 1);
});

test('routeMessage forwards getHistory requests to storage.getHistory', async () => {
    const deps = createDeps();

    const result = await routeMessage({ action: 'getHistory' }, deps);

    assert.deepEqual(result, [{ source: 'hello', target: '你好' }]);
    assert.equal(deps.storage.getHistoryCalls, 1);
});

test('routeMessage refreshes translator settings for updateSettings', async () => {
    const deps = createDeps();

    const result = await routeMessage({ action: 'updateSettings' }, deps);

    assert.deepEqual(result, { success: true });
    assert.equal(deps.translator.refreshSettingsCalls, 1);
});

test('routeMessage returns an error object for unknown actions', async () => {
    const deps = createDeps();

    const result = await routeMessage({ action: 'missing-action' }, deps);

    assert.deepEqual(result, { error: 'Unknown action' });
});
