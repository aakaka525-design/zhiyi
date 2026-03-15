import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const OBSERVER_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

function selectorMatches(node, selector) {
    return selector.split(',').map((part) => part.trim()).some((part) => {
        if (!part) return false;
        if (part === '[data-testid="tweetText"]') {
            return node.dataset?.testid === 'tweetText';
        }
        if (part === '[id^="message-content-"]') {
            return typeof node.id === 'string' && node.id.startsWith('message-content-');
        }
        if (part.startsWith('.')) {
            return node.className?.split(/\s+/).includes(part.slice(1)) || false;
        }
        return part.toLowerCase() === node.__tagName;
    });
}

function createNode(tagName, {
    id = '',
    text = '',
    dataset = {},
    children = [],
} = {}) {
    const node = {
        __tagName: tagName.toLowerCase(),
        tagName: tagName.toUpperCase(),
        nodeType: 1,
        id,
        dataset,
        innerText: text,
        isContentEditable: false,
        __attached: true,
        __computedStyle: { display: 'block', visibility: 'visible' },
        nextElementSibling: null,
        parentNode: null,
        children: [],
        className: '',
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
                child.__attached = false;
            }
        },
        remove() {
            if (this.parentNode?.removeChild) {
                this.parentNode.removeChild(this);
            } else {
                this.__attached = false;
            }
        },
        querySelector(selector) {
            if (selector === '.st-immersive-translation') {
                return null;
            }
            return this.querySelectorAll(selector)[0] || null;
        },
        querySelectorAll(selector) {
            const result = [];
            for (const child of this.children) {
                if (typeof child.matches === 'function' && child.matches(selector)) {
                    result.push(child);
                }
                if (typeof child.querySelectorAll === 'function') {
                    result.push(...child.querySelectorAll(selector));
                }
            }
            return result;
        },
        contains(target) {
            let current = target;
            while (current) {
                if (current === this) return true;
                current = current.parentNode;
            }
            return false;
        },
        matches(selector) {
            return selectorMatches(this, selector);
        },
        closest() {
            return null;
        },
    };

    for (const child of children) {
        node.appendChild(child);
    }

    return node;
}

async function loadImmersiveHarness({ hostname = 'example.com' } = {}) {
    const source = await readWorkspaceFile('content/modules/immersive.js');
    const sentMessages = [];
    let observerCallback = null;

    const document = {
        body: {},
        contains(target) {
            return Boolean(target?.__attached);
        },
        querySelectorAll() {
            return [];
        },
        createElement(tagName) {
            const el = createNode(tagName);
            el.innerHTML = '';
            el.style = {};
            return el;
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
        async sendMessage(payload) {
            sentMessages.push(payload);
            if (payload.action === 'translateBatch') {
                return { results: payload.texts.map((text) => `ZH:${text}`) };
            }
            return {};
        },
        injectTranslation() {},
        showToast() {},
        showProgress() {},
        hideProgress() {},
        updateProgress() {},
    };

    const context = {
        window: {
            SmartTranslator: ST,
            location: { hostname },
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
    context.window.SmartTranslator.startMutationObserver();

    return {
        sentMessages,
        async observeNode(node) {
            assert.ok(observerCallback);
            await observerCallback([
                {
                    type: 'childList',
                    addedNodes: [node],
                },
            ]);
        },
    };
}

function getTranslateTexts(sentMessages) {
    const translatePayload = sentMessages.find((payload) => payload.action === 'translateBatch');
    assert.ok(translatePayload, 'expected translateBatch payload');
    return Array.from(translatePayload.texts);
}

test('observer generic path translates a directly added paragraph node', async () => {
    const paragraph = createNode('p', {
        text: 'Direct paragraph node that should now be translated by the observer.',
    });
    const { sentMessages, observeNode } = await loadImmersiveHarness();

    await observeNode(paragraph);

    assert.deepEqual(getTranslateTexts(sentMessages), [
        'Direct paragraph node that should now be translated by the observer.',
    ]);
});

test('observer generic path keeps only the outer blockquote when node and descendant both match', async () => {
    const paragraph = createNode('p', {
        text: 'Nested paragraph long enough for immersive translation dedup.',
    });
    const blockquote = createNode('blockquote', {
        text: 'Nested paragraph long enough for immersive translation dedup.',
        children: [paragraph],
    });
    const { sentMessages, observeNode } = await loadImmersiveHarness();

    await observeNode(blockquote);

    assert.deepEqual(getTranslateTexts(sentMessages), [
        'Nested paragraph long enough for immersive translation dedup.',
    ]);
});

test('observer generic path does not collect unmatched direct summary nodes', async () => {
    const summary = createNode('summary', {
        text: 'Summary text that should remain excluded from immersive observer capture.',
    });
    const { sentMessages, observeNode } = await loadImmersiveHarness();

    await observeNode(summary);

    assert.equal(sentMessages.length, 0);
});

test('observer Discord fallback translates a directly added generic paragraph node', async () => {
    const paragraph = createNode('p', {
        text: 'Discord fallback paragraph should translate when directly appended.',
    });
    const { sentMessages, observeNode } = await loadImmersiveHarness({ hostname: 'discord.com' });

    await observeNode(paragraph);

    assert.deepEqual(getTranslateTexts(sentMessages), [
        'Discord fallback paragraph should translate when directly appended.',
    ]);
});

test('observer Twitter path still captures directly added tweetText nodes', async () => {
    const tweet = createNode('div', {
        text: 'tweet text',
        dataset: { testid: 'tweetText' },
    });
    const { sentMessages, observeNode } = await loadImmersiveHarness({ hostname: 'x.com' });

    await observeNode(tweet);

    assert.deepEqual(getTranslateTexts(sentMessages), ['tweet text']);
});

test('observer generic path translates directly added figcaption nodes from the expanded selector set', async () => {
    const figcaption = createNode('figcaption', {
        text: 'Short caption',
    });
    const { sentMessages, observeNode } = await loadImmersiveHarness();

    await observeNode(figcaption);

    assert.deepEqual(getTranslateTexts(sentMessages), ['Short caption']);
});

test('observer generic path still translates matching descendants inside a container node', async () => {
    const paragraph = createNode('p', {
        text: 'Nested paragraph inside a container should still translate as before.',
    });
    const wrapper = createNode('div', { children: [paragraph] });
    const { sentMessages, observeNode } = await loadImmersiveHarness();

    await observeNode(wrapper);

    assert.deepEqual(getTranslateTexts(sentMessages), [
        'Nested paragraph inside a container should still translate as before.',
    ]);
});
