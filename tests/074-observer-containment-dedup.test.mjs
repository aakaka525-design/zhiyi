import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const GENERIC_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote';

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
            return node.className?.split(/\s+/).includes(part.slice(1)) || false;
        }
        return part.toLowerCase() === node.__tagName;
    });
}

function createNode(tagName, {
    id = '',
    text = '',
    children = [],
    isContentEditable = false,
    display = 'block',
    visibility = 'visible',
} = {}) {
    const node = {
        __tagName: tagName.toLowerCase(),
        tagName: tagName.toUpperCase(),
        nodeType: 1,
        id,
        innerText: text,
        isContentEditable,
        __attached: true,
        __computedStyle: { display, visibility },
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

    for (const child of children) {
        node.appendChild(child);
    }

    return node;
}

async function loadImmersiveHarness({ hostname = 'example.com', initialElements = [] } = {}) {
    const source = await readWorkspaceFile('content/modules/immersive.js');
    const sentMessages = [];
    let observerCallback = null;

    const document = {
        body: {},
        contains(target) {
            return Boolean(target?.__attached);
        },
        querySelectorAll(selector) {
            if (selector === '[id^="message-content-"]') {
                return initialElements.filter((el) => el.matches(selector));
            }
            if (selector.includes('.markdown-body')) {
                return initialElements;
            }
            return initialElements;
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
    context.window.SmartTranslator.injectTranslation = () => {};

    return {
        ST: context.window.SmartTranslator,
        filterContainedImmersiveElements: context.filterContainedImmersiveElements,
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

test('filterContainedImmersiveElements keeps only the outer parent for nested candidates', async () => {
    const paragraph = createNode('p', { text: 'Nested text' });
    const blockquote = createNode('blockquote', { text: 'Nested text', children: [paragraph] });
    const { filterContainedImmersiveElements } = await loadImmersiveHarness();

    assert.equal(typeof filterContainedImmersiveElements, 'function');
    assert.deepEqual(
        Array.from(filterContainedImmersiveElements([blockquote, paragraph])),
        [blockquote],
    );
});

test('filterContainedImmersiveElements preserves siblings, empty arrays, and deepest chains correctly', async () => {
    const p1 = createNode('p', { text: 'First paragraph long enough for translation.' });
    const p2 = createNode('p', { text: 'Second paragraph long enough for translation.' });
    const inner = createNode('p', { text: 'Deep nested text' });
    const middle = createNode('blockquote', { text: 'Deep nested text', children: [inner] });
    const outer = createNode('div', { text: 'Deep nested text', children: [middle] });
    const { filterContainedImmersiveElements } = await loadImmersiveHarness();

    assert.deepEqual(Array.from(filterContainedImmersiveElements([])), []);
    assert.deepEqual(Array.from(filterContainedImmersiveElements([p1, p2])), [p1, p2]);
    assert.deepEqual(
        Array.from(filterContainedImmersiveElements([outer, middle, inner])),
        [outer],
    );
});

test('initial scan generic path reuses containment dedup so nested blockquote and paragraph translate once', async () => {
    const paragraph = createNode('p', { text: 'Nested quote that is definitely longer than twenty characters.' });
    const blockquote = createNode('blockquote', {
        text: 'Nested quote that is definitely longer than twenty characters.',
        children: [paragraph],
    });
    const { ST, sentMessages } = await loadImmersiveHarness({
        initialElements: [blockquote, paragraph],
    });

    await ST.toggleImmersive();

    assert.deepEqual(getTranslateTexts(sentMessages), [
        'Nested quote that is definitely longer than twenty characters.',
    ]);
});

test('observer generic path removes nested descendants before translateBatch', async () => {
    const paragraph = createNode('p', { text: 'Observer nested quote that is definitely longer than twenty characters.' });
    const blockquote = createNode('blockquote', {
        text: 'Observer nested quote that is definitely longer than twenty characters.',
        children: [paragraph],
    });
    const addedRoot = createNode('article', { children: [blockquote] });
    const { ST, sentMessages, getObserverCallback } = await loadImmersiveHarness();

    ST.state.isImmersiveEnabled = true;
    ST.state.immersiveRunId = 1;
    ST.startMutationObserver();
    const observerCallback = getObserverCallback();

    await observerCallback([
        {
            type: 'childList',
            addedNodes: [addedRoot],
        },
    ]);

    assert.deepEqual(getTranslateTexts(sentMessages), [
        'Observer nested quote that is definitely longer than twenty characters.',
    ]);
});

test('observer Discord path keeps the message container and removes nested generic children', async () => {
    const paragraph = createNode('p', { text: 'Discord nested paragraph long enough for observer translation.' });
    const listItem = createNode('li', { text: 'Discord nested item' });
    const message = createNode('div', {
        id: 'message-content-123456',
        text: 'Discord nested paragraph long enough for observer translation.',
        children: [paragraph, listItem],
    });
    const addedRoot = createNode('section', { children: [message] });
    const { ST, sentMessages, getObserverCallback } = await loadImmersiveHarness({
        hostname: 'discord.com',
    });

    ST.state.isImmersiveEnabled = true;
    ST.state.immersiveRunId = 1;
    ST.startMutationObserver();
    const observerCallback = getObserverCallback();

    await observerCallback([
        {
            type: 'childList',
            addedNodes: [addedRoot],
        },
    ]);

    assert.deepEqual(getTranslateTexts(sentMessages), [
        'Discord nested paragraph long enough for observer translation.',
    ]);
});

test('observer containment dedup does not drop flat sibling paragraphs', async () => {
    const p1 = createNode('p', { text: 'First flat paragraph long enough for translation.' });
    const p2 = createNode('p', { text: 'Second flat paragraph long enough for translation.' });
    const addedRoot = createNode('section', { children: [p1, p2] });
    const { ST, sentMessages, getObserverCallback } = await loadImmersiveHarness();

    ST.state.isImmersiveEnabled = true;
    ST.state.immersiveRunId = 1;
    ST.startMutationObserver();
    const observerCallback = getObserverCallback();

    await observerCallback([
        {
            type: 'childList',
            addedNodes: [addedRoot],
        },
    ]);

    assert.deepEqual(getTranslateTexts(sentMessages), [
        'First flat paragraph long enough for translation.',
        'Second flat paragraph long enough for translation.',
    ]);
});
