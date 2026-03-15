import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const GENERIC_SELECTOR = [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'li', 'td', 'th', 'blockquote',
    'figcaption', 'dt', 'dd', 'caption',
    '.markdown-body p', '.markdown-body li',
    '.comment-body p', '.js-comment-body p',
].join(', ');

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

function selectorMatches(node, selector) {
    return selector.split(',').map((part) => part.trim()).some((part) => {
        if (!part) return false;
        if (part === '[id^="message-content-"]') {
            return typeof node.id === 'string' && node.id.startsWith('message-content-');
        }
        if (part.startsWith('.')) {
            return node.__classes?.includes(part.slice(1));
        }
        return part.toLowerCase() === node.__tagName;
    });
}

function createNode(tagName, {
    id = '',
    text = '',
    classes = [],
    parentNode = null,
    isContentEditable = false,
    display = 'block',
    visibility = 'visible',
    queryMap = {},
} = {}) {
    return {
        __tagName: tagName.toLowerCase(),
        __classes: classes,
        nodeType: 1,
        tagName: tagName.toUpperCase(),
        id,
        parentNode,
        isContentEditable,
        __attached: true,
        __computedStyle: { display, visibility },
        innerText: text,
        nextElementSibling: null,
        children: [],
        appendChild(child) {
            this.children.push(child);
            child.parentNode = this;
        },
        querySelector() {
            return null;
        },
        querySelectorAll(selector) {
            return queryMap[selector] || [];
        },
        contains() {
            return false;
        },
        matches(selector) {
            return selectorMatches(this, selector);
        },
        closest(selector) {
            let current = this;
            while (current) {
                if (typeof current.matches === 'function' && current.matches(selector)) {
                    return current;
                }
                current = current.parentNode;
            }
            return null;
        },
    };
}

async function loadImmersiveHarness({
    hostname = 'example.com',
    pathname = '/',
    documentQueryMap = {},
} = {}) {
    const source = await readWorkspaceFile('content/modules/immersive.js');
    const sentMessages = [];
    let observerCallback = null;

    const document = {
        body: {},
        contains(target) {
            return Boolean(target?.__attached);
        },
        querySelectorAll(selector) {
            return documentQueryMap[selector] || [];
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
            location: { hostname, pathname },
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
        sentMessages,
        getObserverCallback() {
            return observerCallback;
        },
    };
}

function getTranslateTexts(sentMessages) {
    const batchPayload = sentMessages.find((payload) => payload.action === 'translateBatch');
    return batchPayload ? Array.from(batchPayload.texts) : [];
}

test('Telegram support uses web.telegram.org hostname detection and the .translatable-message selector', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(immersive, /window\.location\.hostname === 'web\.telegram\.org'/);
    assert.match(immersive, /document\.querySelectorAll\('\.translatable-message'\)/);
});

test('Telegram initial scan prefers .translatable-message nodes over the generic path', async () => {
    const telegramMessage = createNode('span', {
        text: 'Telegram hello world',
        classes: ['translatable-message'],
    });
    const genericParagraph = createNode('p', {
        text: 'Generic paragraph that should not be used when Telegram messages exist.',
    });

    const { ST, sentMessages } = await loadImmersiveHarness({
        hostname: 'web.telegram.org',
        pathname: '/k/',
        documentQueryMap: {
            '.translatable-message': [telegramMessage],
            [GENERIC_SELECTOR]: [genericParagraph],
        },
    });

    await ST.toggleImmersive();

    assert.deepEqual(getTranslateTexts(sentMessages), ['Telegram hello world']);
});

test('Telegram non-chat pages fall through to the generic selector path when no message nodes exist', async () => {
    const genericParagraph = createNode('p', {
        text: 'Telegram generic help text that should still translate via the fallback path.',
    });

    const { ST, sentMessages } = await loadImmersiveHarness({
        hostname: 'web.telegram.org',
        pathname: '/login',
        documentQueryMap: {
            '.translatable-message': [],
            [GENERIC_SELECTOR]: [genericParagraph],
        },
    });

    await ST.toggleImmersive();

    assert.deepEqual(getTranslateTexts(sentMessages), [
        'Telegram generic help text that should still translate via the fallback path.',
    ]);
});

test('Telegram observer collects directly added .translatable-message nodes', async () => {
    const telegramMessage = createNode('span', {
        text: 'Hi!',
        classes: ['translatable-message'],
    });
    const { ST, sentMessages, getObserverCallback } = await loadImmersiveHarness({
        hostname: 'web.telegram.org',
        pathname: '/k/',
    });

    ST.state.isImmersiveEnabled = true;
    ST.state.immersiveRunId = 1;
    ST.startMutationObserver();

    await getObserverCallback()([
        {
            type: 'childList',
            addedNodes: [telegramMessage],
        },
    ]);

    assert.deepEqual(getTranslateTexts(sentMessages), ['Hi!']);
});

test('Telegram observer does not collect generic paragraph nodes through a Telegram-specific fallback', async () => {
    const telegramMessage = createNode('span', {
        text: 'Reply text',
        classes: ['translatable-message'],
    });
    const genericParagraph = createNode('p', {
        text: 'Generic paragraph that should stay out of the Telegram-specific observer path.',
    });
    const addedContainer = createNode('div', {
        queryMap: {
            '.translatable-message': [telegramMessage],
            [GENERIC_SELECTOR]: [genericParagraph],
        },
    });

    const { ST, sentMessages, getObserverCallback } = await loadImmersiveHarness({
        hostname: 'web.telegram.org',
        pathname: '/k/',
    });

    ST.state.isImmersiveEnabled = true;
    ST.state.immersiveRunId = 1;
    ST.startMutationObserver();

    await getObserverCallback()([
        {
            type: 'childList',
            addedNodes: [addedContainer],
        },
    ]);

    assert.deepEqual(getTranslateTexts(sentMessages), ['Reply text']);
});

test('Telegram .translatable-message nodes use the lowered short-text threshold without changing non-Telegram spans', async () => {
    const telegramMessage = createNode('span', {
        text: 'Hi!',
        classes: ['translatable-message'],
    });
    const { ST: telegramST, sentMessages: telegramMessages } = await loadImmersiveHarness({
        hostname: 'web.telegram.org',
        pathname: '/k/',
        documentQueryMap: {
            '.translatable-message': [telegramMessage],
            [GENERIC_SELECTOR]: [],
        },
    });

    await telegramST.toggleImmersive();
    assert.deepEqual(getTranslateTexts(telegramMessages), ['Hi!']);

    const nonTelegramMessage = createNode('span', {
        text: 'Hi!',
        classes: ['translatable-message'],
    });
    const { ST: normalST, sentMessages: normalMessages } = await loadImmersiveHarness({
        hostname: 'example.com',
        pathname: '/',
        documentQueryMap: {
            '.translatable-message': [nonTelegramMessage],
            [GENERIC_SELECTOR]: [],
        },
    });

    await normalST.toggleImmersive();
    assert.deepEqual(getTranslateTexts(normalMessages), []);
});
