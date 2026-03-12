import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { handleTTSGoogle } from '../background/modules/tts.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

test('handleTTSGoogle preserves the full Chinese language code for Chirp voices', async () => {
    let capturedBody = null;

    globalThis.fetch = async (_url, options) => {
        capturedBody = JSON.parse(options.body);
        return {
            ok: true,
            async json() {
                return { audioContent: 'base64-audio' };
            },
        };
    };

    const result = await handleTTSGoogle({
        apiKey: 'test-key',
        text: '你好',
        voice: 'cmn-CN-Chirp3-HD-Aoede',
        speed: 1.0,
    });

    assert.equal(capturedBody.voice.languageCode, 'cmn-CN');
    assert.equal(result.audioData, 'data:audio/mp3;base64,base64-audio');
});
