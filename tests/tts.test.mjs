import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { playAudioViaOffscreen } from '../background/modules/tts.js';

const originalChrome = globalThis.chrome;

afterEach(() => {
    globalThis.chrome = originalChrome;
});

test('playAudioViaOffscreen retries offscreen creation after the first createDocument failure', async () => {
    const createError = new Error('createDocument failed');
    let createCalls = 0;
    let sendMessageCalls = 0;

    globalThis.chrome = {
        runtime: {
            getURL(path = '') {
                return `chrome-extension://test/${path}`;
            },
            async getContexts() {
                return [];
            },
            async sendMessage(message) {
                sendMessageCalls += 1;
                return { success: true, message };
            },
        },
        offscreen: {
            async createDocument() {
                createCalls += 1;
                if (createCalls === 1) {
                    throw createError;
                }
            },
        },
    };

    await assert.rejects(
        playAudioViaOffscreen('data:audio/mp3;base64,abc', 1.0),
        (error) => error === createError
    );

    const result = await playAudioViaOffscreen('data:audio/mp3;base64,def', 1.25);

    assert.deepEqual(result, {
        success: true,
        message: {
            action: 'playAudio',
            audioData: 'data:audio/mp3;base64,def',
            speed: 1.25,
        },
    });
    assert.equal(createCalls, 2);
    assert.equal(sendMessageCalls, 1);
});
