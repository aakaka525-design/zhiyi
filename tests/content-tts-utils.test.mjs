import test from 'node:test';
import assert from 'node:assert/strict';

test('content utils expose a Korean default Google TTS voice', async () => {
    const originalWindow = globalThis.window;
    const moduleUrl = new URL('../content/modules/utils.js', import.meta.url);
    moduleUrl.search = `?case=${Date.now()}`;

    globalThis.window = { SmartTranslator: {} };

    try {
        await import(moduleUrl.href);
        assert.equal(
            globalThis.window.SmartTranslator.getDefaultGoogleTtsVoice('ko'),
            'ko-KR-Wavenet-A',
        );
    } finally {
        globalThis.window = originalWindow;
    }
});
