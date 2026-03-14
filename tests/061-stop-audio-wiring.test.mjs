import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { routeMessage } from '../background/modules/message-router.js';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('service-worker imports stopAudioViaOffscreen from tts.js', async () => {
    const serviceWorker = await readWorkspaceFile('background/service-worker.js');

    assert.match(
        serviceWorker,
        /import \{ handleTTSGLM, handleTTSOpenAI, handleTTSGoogle, playAudioViaOffscreen, stopAudioViaOffscreen \} from '\.\/modules\/tts\.js';/,
    );
});

test('service-worker passes stopAudioViaOffscreen through the tts deps object', async () => {
    const serviceWorker = await readWorkspaceFile('background/service-worker.js');

    assert.match(
        serviceWorker,
        /tts:\s*\{\s*handleTTSGLM,\s*handleTTSOpenAI,\s*handleTTSGoogle,\s*playAudioViaOffscreen,\s*stopAudioViaOffscreen,\s*\},/s,
    );
});

test('routeMessage forwards stopAudio requests to deps.tts.stopAudioViaOffscreen', async () => {
    let calls = 0;
    const deps = {
        translator: {},
        storage: {},
        tts: {
            async stopAudioViaOffscreen() {
                calls += 1;
                return { success: true };
            },
        },
    };

    const result = await routeMessage({ action: 'stopAudio' }, deps);

    assert.deepEqual(result, { success: true });
    assert.equal(calls, 1);
});
