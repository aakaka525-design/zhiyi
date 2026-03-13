import test from 'node:test';
import assert from 'node:assert/strict';

function installServiceWorkerChromeStub() {
    globalThis.chrome = {
        storage: {
            local: {
                async get() {
                    return {};
                },
                async set() {},
                async remove() {},
            },
        },
        runtime: {
            onInstalled: { addListener() {} },
            onMessage: { addListener() {} },
            openOptionsPage() {},
            getURL(path = '') {
                return `chrome-extension://test/${path}`;
            },
            async getContexts() {
                return [];
            },
            async sendMessage() {
                return {};
            },
        },
        commands: {
            onCommand: { addListener() {} },
        },
        contextMenus: {
            onClicked: { addListener() {} },
            removeAll(callback) {
                callback?.();
            },
            create() {},
        },
        tabs: {
            async query() {
                return [];
            },
            async sendMessage() {},
        },
        offscreen: {
            async createDocument() {},
        },
    };
}

installServiceWorkerChromeStub();

const { createEnsureReadyManager } = await import('../background/service-worker.js');

test('ensureReady awaits the same in-flight init and returns the same translator instance', async () => {
    let initCalls = 0;
    let translator = null;
    let releaseInit;
    const initGate = new Promise((resolve) => {
        releaseInit = resolve;
    });
    const readyTranslator = { ready: true };

    const ensureReady = createEnsureReadyManager({
        init: async () => {
            initCalls += 1;
            await initGate;
            translator = readyTranslator;
        },
        getTranslator: () => translator,
        resetTranslator: () => {
            translator = null;
        },
    });

    const pendingA = ensureReady();
    const pendingB = ensureReady();

    assert.equal(initCalls, 1);

    releaseInit();

    assert.strictEqual(await pendingA, readyTranslator);
    assert.strictEqual(await pendingB, readyTranslator);
    assert.equal(initCalls, 1);
});

test('ensureReady clears state after init failure so the next call can retry', async () => {
    let initCalls = 0;
    let translator = null;
    const readyTranslator = { ready: true };
    const initError = new Error('boom');
    let shouldFail = true;

    const ensureReady = createEnsureReadyManager({
        init: async () => {
            initCalls += 1;
            translator = { halfReady: true };
            if (shouldFail) {
                throw initError;
            }
            translator = readyTranslator;
        },
        getTranslator: () => translator,
        resetTranslator: () => {
            translator = null;
        },
    });

    await assert.rejects(ensureReady(), (error) => error === initError);
    assert.equal(translator, null);
    assert.equal(initCalls, 1);

    shouldFail = false;

    assert.strictEqual(await ensureReady(), readyTranslator);
    assert.equal(initCalls, 2);
});
