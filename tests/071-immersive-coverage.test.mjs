import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

function createImmersiveElement(tagName, text, { display = 'block', visibility = 'visible' } = {}) {
    return {
        __tagName: tagName,
        __attached: true,
        __computedStyle: { display, visibility },
        innerText: text,
        nextElementSibling: null,
        parentNode: {
            __computedStyle: { display: 'block', visibility: 'visible' },
            insertBefore() {},
        },
        children: [],
        appendChild(child) {
            this.children.push(child);
            child.parentNode = this;
        },
        querySelector() {
            return null;
        },
        closest() {
            return null;
        },
        contains() {
            return false;
        },
        matches(selector) {
            return selector.split(',').map((part) => part.trim()).includes(this.__tagName);
        },
    };
}

async function loadImmersiveHarness({ initialElements = [] } = {}) {
    const source = await readWorkspaceFile('content/modules/immersive.js');
    const sentMessages = [];
    let observerCallback = null;

    const document = {
        body: {},
        contains(target) {
            return Boolean(target?.__attached);
        },
        querySelectorAll() {
            return initialElements;
        },
        createElement(tagName) {
            return {
                tagName: tagName.toUpperCase(),
                className: '',
                innerText: '',
                innerHTML: '',
                style: {},
                children: [],
                parentNode: null,
                appendChild(child) {
                    this.children.push(child);
                    child.parentNode = this;
                },
            };
        },
    };

    const ST = {
        state: {
            settings: { targetLang: 'zh' },
            isImmersiveEnabled: false,
            immersiveRunId: 0,
        },
        observers: {},
        pendingTranslations: new Set(),
        isPluginElement() {
            return false;
        },
        detectLanguage() {
            return 'en';
        },
        async sendMessage(payload) {
            sentMessages.push(payload);
            if (payload.action === 'translateBatch') {
                return { results: payload.texts.map((text) => `ZH:${text}`) };
            }
            return {};
        },
        showToast() {},
        showProgress() {},
        hideProgress() {},
        updateProgress() {},
    };

    const context = {
        window: {
            SmartTranslator: ST,
            location: { hostname: 'example.com' },
            getComputedStyle(target) {
                return target?.__computedStyle || { display: 'block', visibility: 'visible' };
            },
            addEventListener() {},
            removeEventListener() {},
        },
        document,
        console: {
            log() {},
            error() {},
            warn() {},
        },
        MutationObserver: class {
            constructor(callback) {
                observerCallback = callback;
            }
            disconnect() {}
            observe() {}
        },
        Node: { ELEMENT_NODE: 1 },
        setTimeout,
        clearTimeout,
    };

    vm.runInNewContext(source, context, { filename: 'immersive.js' });
    context.window.SmartTranslator.injectTranslation = () => {};

    return {
        ST: context.window.SmartTranslator,
        getImmersiveMinLength: context.getImmersiveMinLength,
        sentMessages,
        getObserverCallback() {
            return observerCallback;
        },
    };
}

test('immersive min-length helper returns layered thresholds by element type', async () => {
    const { getImmersiveMinLength } = await loadImmersiveHarness();

    assert.equal(typeof getImmersiveMinLength, 'function');
    assert.equal(getImmersiveMinLength(createImmersiveElement('p', 'tweet'), true), 5);
    assert.equal(getImmersiveMinLength(createImmersiveElement('h2', 'FAQ')), 2);
    assert.equal(getImmersiveMinLength(createImmersiveElement('li', 'Summary')), 2);
    assert.equal(getImmersiveMinLength(createImmersiveElement('td', 'OK')), 2);
    assert.equal(getImmersiveMinLength(createImmersiveElement('blockquote', 'Read more.')), 20);
});

test('immersive initial scan keeps short headings and list items while still filtering short paragraphs', async () => {
    const h2 = createImmersiveElement('h2', 'FAQ');
    const li = createImmersiveElement('li', 'Summary');
    const shortParagraph = createImmersiveElement('p', 'Read more.');
    const longParagraph = createImmersiveElement('p', 'This paragraph is definitely longer than twenty characters.');

    const { ST, sentMessages } = await loadImmersiveHarness({
        initialElements: [h2, li, shortParagraph, longParagraph],
    });

    await ST.toggleImmersive();

    const batchPayload = sentMessages.find((payload) => payload.action === 'translateBatch');
    assert.ok(batchPayload);
    assert.deepEqual(Array.from(batchPayload.texts), [
        'FAQ',
        'Summary',
        'This paragraph is definitely longer than twenty characters.',
    ]);
});

test('immersive observer path reuses the same layered thresholds for new elements', async () => {
    const { ST, sentMessages, getObserverCallback } = await loadImmersiveHarness();
    ST.state.isImmersiveEnabled = true;
    ST.state.immersiveRunId = 1;
    ST.startMutationObserver();

    const observerCallback = getObserverCallback();
    assert.equal(typeof observerCallback, 'function');

    const h2 = createImmersiveElement('h2', 'FAQ');
    const li = createImmersiveElement('li', 'Summary');
    const shortParagraph = createImmersiveElement('p', 'Read more.');

    await observerCallback([
        {
            type: 'childList',
            addedNodes: [
                {
                    nodeType: 1,
                    matches() {
                        return false;
                    },
                    querySelectorAll() {
                        return [h2, li, shortParagraph];
                    },
                },
            ],
        },
    ]);

    const batchPayload = sentMessages.find((payload) => payload.action === 'translateBatch');
    assert.ok(batchPayload);
    assert.deepEqual(Array.from(batchPayload.texts), ['FAQ', 'Summary']);
});
