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
        getImmersiveMinLength: context.getImmersiveMinLength,
        sentMessages,
        getObserverCallback() {
            return observerCallback;
        },
    };
}

function getTranslateTexts(sentMessages) {
    const batchPayload = sentMessages.find((payload) => payload.action === 'translateBatch');
    assert.ok(batchPayload);
    return Array.from(batchPayload.texts);
}

test('Discord support uses strict host matching instead of hostname.includes', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(immersive, /window\.location\.hostname === 'discord\.com'/);
    assert.match(immersive, /window\.location\.hostname === 'ptb\.discord\.com'/);
    assert.match(immersive, /window\.location\.hostname === 'canary\.discord\.com'/);
    assert.doesNotMatch(immersive, /includes\('discord\.com'\)/);
});

test('getImmersiveMinLength returns 2 for Discord message content containers', async () => {
    const { getImmersiveMinLength } = await loadImmersiveHarness();

    const discordMessage = createNode('div', {
        id: 'message-content-123456',
        text: 'Hi',
    });
    const plainDiv = createNode('div', { text: 'Plain div' });

    assert.equal(getImmersiveMinLength(discordMessage, false), 2);
    assert.equal(getImmersiveMinLength(plainDiv, false), 20);
});

test('Discord chat pages prefer message-content nodes over generic fallback during initial scan', async () => {
    const messageOne = createNode('div', {
        id: 'message-content-1',
        text: 'Hello from Discord',
    });
    const messageTwo = createNode('div', {
        id: 'message-content-2',
        text: 'Second Discord line',
    });
    const genericParagraph = createNode('p', {
        text: 'Generic fallback paragraph that should not be used when Discord messages exist.',
    });

    const { ST, sentMessages } = await loadImmersiveHarness({
        hostname: 'discord.com',
        pathname: '/channels/1/2',
        documentQueryMap: {
            '[id^="message-content-"]': [messageOne, messageTwo],
            [GENERIC_SELECTOR]: [genericParagraph],
        },
    });

    await ST.toggleImmersive();

    assert.deepEqual(getTranslateTexts(sentMessages), [
        'Hello from Discord',
        'Second Discord line',
    ]);
});

test('Discord domains without message-content nodes fall back to generic selectors', async () => {
    const genericParagraph = createNode('p', {
        text: 'Discord download page paragraph that should still translate through the generic path.',
    });

    const { ST, sentMessages } = await loadImmersiveHarness({
        hostname: 'discord.com',
        pathname: '/download',
        documentQueryMap: {
            '[id^="message-content-"]': [],
            [GENERIC_SELECTOR]: [genericParagraph],
        },
    });

    await ST.toggleImmersive();

    assert.deepEqual(getTranslateTexts(sentMessages), [
        'Discord download page paragraph that should still translate through the generic path.',
    ]);
});

test('support.discord.com stays on the generic path because it is not a chat-app host', async () => {
    const genericParagraph = createNode('p', {
        text: 'Support article paragraph that should translate through the generic path.',
    });

    const { ST, sentMessages } = await loadImmersiveHarness({
        hostname: 'support.discord.com',
        pathname: '/hc/articles/123',
        documentQueryMap: {
            '[id^="message-content-"]': [],
            [GENERIC_SELECTOR]: [genericParagraph],
        },
    });

    await ST.toggleImmersive();

    assert.deepEqual(getTranslateTexts(sentMessages), [
        'Support article paragraph that should translate through the generic path.',
    ]);
});

test('observer collects Discord message nodes when a message-content element is added directly', async () => {
    const messageNode = createNode('div', {
        id: 'message-content-999',
        text: 'Live Discord message',
    });

    const { ST, sentMessages, getObserverCallback } = await loadImmersiveHarness({
        hostname: 'canary.discord.com',
        pathname: '/channels/1/2',
    });

    ST.state.isImmersiveEnabled = true;
    ST.state.immersiveRunId = 1;
    ST.startMutationObserver();

    const observerCallback = getObserverCallback();
    assert.equal(typeof observerCallback, 'function');

    await observerCallback([
        {
            type: 'childList',
            addedNodes: [Object.assign(messageNode, { nodeType: 1 })],
        },
    ]);

    assert.deepEqual(getTranslateTexts(sentMessages), ['Live Discord message']);
});
