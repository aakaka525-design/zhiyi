import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

function selectorMatches(node, selector) {
    return selector.split(',').map((part) => part.trim()).some((part) => {
        if (!part) return false;
        if (part === '[id^="message-content-"]') {
            return typeof node.id === 'string' && node.id.startsWith('message-content-');
        }
        return part.toLowerCase() === node.__tagName;
    });
}

function createNode(tagName, {
    id = '',
    text = '',
    queryMap = {},
} = {}) {
    return {
        __tagName: tagName.toLowerCase(),
        tagName: tagName.toUpperCase(),
        nodeType: 1,
        id,
        innerText: text,
        isContentEditable: false,
        __attached: true,
        __computedStyle: { display: 'block', visibility: 'visible' },
        parentNode: null,
        children: [],
        querySelector(selector) {
            return this.querySelectorAll(selector)[0] || null;
        },
        querySelectorAll(selector) {
            if (selector === '.st-immersive-loading') {
                return this.children.filter((child) => child.matches?.('.st-immersive-loading'));
            }
            return queryMap[selector] || [];
        },
        matches(selector) {
            return selectorMatches(this, selector);
        },
        closest() {
            return null;
        },
        appendChild(child) {
            this.children.push(child);
            child.parentNode = this;
            return child;
        },
        removeChild(child) {
            const index = this.children.indexOf(child);
            if (index !== -1) {
                this.children.splice(index, 1);
                child.parentNode = null;
            }
        },
    };
}

async function loadHarness({ pathname = '/channels/1/2' } = {}) {
    const source = await readWorkspaceFile('content/modules/immersive.js');
    let observerCallback = null;
    const sentMessages = [];

    const document = {
        body: {},
        contains(target) {
            return Boolean(target?.__attached);
        },
        querySelectorAll() {
            return [];
        },
        createElement(tagName) {
            return {
                __tagName: tagName.toLowerCase(),
                tagName: tagName.toUpperCase(),
                className: '',
                innerText: '',
                style: {},
                children: [],
                matches(selector) {
                    return selectorMatches(this, selector);
                },
                appendChild(child) {
                    this.children.push(child);
                    child.parentNode = this;
                    return child;
                },
                remove() {
                    if (this.parentNode?.removeChild) {
                        this.parentNode.removeChild(this);
                    }
                },
            };
        },
    };

    const ST = {
        state: {
            settings: { targetLang: 'zh' },
            isImmersiveEnabled: true,
            immersiveRunId: 1,
        },
        observers: {},
        pendingTranslations: new Set(),
        isPluginElement() {
            return false;
        },
        detectLanguage() {
            return 'en';
        },
        injectTranslation() {},
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
            location: {
                hostname: 'discord.com',
                pathname,
            },
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
        Promise,
        WeakMap,
    };

    vm.runInNewContext(source, context, { filename: 'immersive.js' });

    return {
        ST: context.window.SmartTranslator,
        sentMessages,
        getObserverCallback() {
            return observerCallback;
        },
    };
}

function getBatchTexts(sentMessages) {
    const batchPayload = sentMessages.find((payload) => payload.action === 'translateBatch');
    assert.ok(batchPayload);
    return Array.from(batchPayload.texts);
}

test('099 Discord chat generic selector removes h1 h2 h3 but keeps h4 h5 h6, while the base selector stays unchanged', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(immersive, /const DISCORD_CHAT_GENERIC_SELECTORS = 'p, h4, h5, h6, td, th, blockquote, figcaption, dt, dd, caption';/);
    assert.match(immersive, /const DISCORD_GENERIC_SELECTORS = 'p, h1, h2, h3, h4, h5, h6, td, th, blockquote, figcaption, dt, dd, caption';/);
    assert.match(immersive, /window\.location\.pathname \|\| ''\)\.startsWith\('\/channels'\)/);
});

test('099 Discord chat observer generic fallback ignores direct h3 metadata nodes', async () => {
    const h3Header = createNode('h3', {
        text: 'User role 15:46',
    });
    const { ST, sentMessages, getObserverCallback } = await loadHarness({ pathname: '/channels/1/2' });

    ST.startMutationObserver();
    const observerCallback = getObserverCallback();
    await observerCallback([
        {
            type: 'childList',
            addedNodes: [h3Header],
        },
    ]);

    assert.equal(sentMessages.length, 0);
});

test('099 Discord chat observer generic fallback still translates allowed direct generic nodes', async () => {
    const paragraph = createNode('p', {
        text: 'Discord generic paragraph content',
    });
    const { ST, sentMessages, getObserverCallback } = await loadHarness({ pathname: '/channels/1/2' });

    ST.startMutationObserver();
    const observerCallback = getObserverCallback();
    await observerCallback([
        {
            type: 'childList',
            addedNodes: [paragraph],
        },
    ]);

    assert.deepEqual(getBatchTexts(sentMessages), ['Discord generic paragraph content']);
});

test('099 non-chat Discord pages still allow direct h3 generic fallback nodes', async () => {
    const h3Header = createNode('h3', {
        text: 'Download page title',
    });
    const { ST, sentMessages, getObserverCallback } = await loadHarness({ pathname: '/download' });

    ST.startMutationObserver();
    const observerCallback = getObserverCallback();
    await observerCallback([
        {
            type: 'childList',
            addedNodes: [h3Header],
        },
    ]);

    assert.deepEqual(getBatchTexts(sentMessages), ['Download page title']);
});
