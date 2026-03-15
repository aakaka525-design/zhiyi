import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const INITIAL_SELECTOR = [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'li', 'td', 'th', 'blockquote',
    'figcaption', 'dt', 'dd', 'caption',
    '.markdown-body p', '.markdown-body li',
    '.comment-body p', '.js-comment-body p',
].join(', ');

const OBSERVER_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption';

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
                return this.children.find((child) => child.className === 'st-immersive-translation') || null;
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

async function loadImmersiveHarness({ initialElements = [] } = {}) {
    const source = await readWorkspaceFile('content/modules/immersive.js');
    const sentMessages = [];
    let observerCallback = null;

    const document = {
        body: {},
        contains(target) {
            return Boolean(target?.__attached);
        },
        querySelectorAll(selector) {
            return initialElements.filter((el) => el.matches(selector));
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

    return {
        ST: context.window.SmartTranslator,
        getImmersiveMinLength: context.getImmersiveMinLength,
        sentMessages,
        getObserverCallback() {
            return observerCallback;
        },
    };
}

function createContainer(tagName, { parentDisplay = 'block', display = 'block' } = {}) {
    const parentNode = {
        __computedStyle: { display: parentDisplay },
        inserted: null,
        insertBefore(node, referenceNode) {
            this.inserted = { node, referenceNode };
            node.parentNode = this;
        },
    };

    const container = {
        __attached: true,
        __tagName: tagName.toLowerCase(),
        __computedStyle: { display },
        nextElementSibling: null,
        parentNode,
        children: [],
        __classes: [],
        classList: {
            add(...classes) {
                classes.forEach((cls) => {
                    if (!container.__classes.includes(cls)) container.__classes.push(cls);
                });
            },
            contains(cls) {
                return container.__classes.includes(cls);
            },
            remove(...classes) {
                container.__classes = container.__classes.filter((cls) => !classes.includes(cls));
            },
        },
        appendChild(node) {
            this.children.push(node);
            node.parentNode = this;
        },
        querySelector(selector) {
            if (selector !== '.st-immersive-translation') return null;
            return this.children.find((child) => child.className === 'st-immersive-translation') || null;
        },
        matches(selector) {
            return selector.split(',').map((part) => part.trim()).includes(tagName);
        },
    };

    return { container, parentNode };
}

function getTranslateTexts(sentMessages) {
    const batchPayload = sentMessages.find((payload) => payload.action === 'translateBatch');
    assert.ok(batchPayload);
    return Array.from(batchPayload.texts);
}

test('content CSS defines a lightweight override for cell-injected immersive translations', async () => {
    const contentCss = await readWorkspaceFile('content/content.css');

    assert.match(
        contentCss,
        /td > \.st-immersive-translation,\s*th > \.st-immersive-translation,\s*li > \.st-immersive-translation,\s*figcaption > \.st-immersive-translation,\s*dt > \.st-immersive-translation,\s*dd > \.st-immersive-translation,\s*caption > \.st-immersive-translation\s*\{[^}]*background:\s*transparent;[^}]*border-left:\s*2px solid var\(--accent\);[^}]*padding:\s*0 0 0 8px;[^}]*margin:\s*4px 0 0 0;[^}]*border-radius:\s*0;[^}]*box-shadow:\s*none;[^}]*font-size:\s*0\.9em;/,
    );
});

test('injectTranslation uses the cell-internal path for figcaption, dt, dd, and caption while keeping block wrappers for paragraphs', async () => {
    const { ST } = await loadImmersiveHarness();

    for (const [tagName, parentDisplay, display] of [
        ['figcaption', 'block', 'block'],
        ['dt', 'block', 'block'],
        ['dd', 'block', 'block'],
        ['caption', 'table', 'table-caption'],
    ]) {
        const { container, parentNode } = createContainer(tagName, { parentDisplay, display });

        ST.injectTranslation(container, `${tagName} translation`);

        assert.equal(parentNode.inserted, null);
        assert.equal(container.classList.contains('st-translated-inline'), true);
        assert.equal(container.children.length, 1);
        assert.equal(container.children[0].className, 'st-immersive-translation');
    }

    const { container: paragraph, parentNode } = createContainer('p', {
        parentDisplay: 'block',
        display: 'block',
    });
    ST.injectTranslation(paragraph, 'paragraph translation');

    assert.equal(paragraph.children.length, 0);
    assert.equal(paragraph.classList.contains('st-translated'), true);
    assert.ok(parentNode.inserted);
    assert.equal(parentNode.inserted.node.className, 'st-immersive-wrapper');
});

test('initial scan selects figcaption, dt, dd, and caption, but not summary', async () => {
    const figcaption = createNode('figcaption', { text: 'Short caption' });
    const dt = createNode('dt', { text: 'API' });
    const dd = createNode('dd', { text: 'Application programming interface' });
    const caption = createNode('caption', { text: 'Table heading' });
    const summary = createNode('summary', { text: 'Folded title' });

    const { ST, sentMessages } = await loadImmersiveHarness({
        initialElements: [figcaption, dt, dd, caption, summary],
    });

    await ST.toggleImmersive();

    assert.deepEqual(getTranslateTexts(sentMessages), [
        'Short caption',
        'API',
        'Application programming interface',
        'Table heading',
    ]);
});

test('observer generic selector collects figcaption, dt, dd, and caption while excluding summary', async () => {
    const figcaption = createNode('figcaption', { text: 'Observed caption' });
    const dt = createNode('dt', { text: 'Observed term' });
    const dd = createNode('dd', { text: 'Observed definition' });
    const caption = createNode('caption', { text: 'Observed table title' });
    const summary = createNode('summary', { text: 'Observed folded title' });
    const addedRoot = createNode('section', { children: [figcaption, dt, dd, caption, summary] });

    const { ST, sentMessages, getObserverCallback } = await loadImmersiveHarness();
    ST.state.isImmersiveEnabled = true;
    ST.state.immersiveRunId = 1;
    ST.startMutationObserver();

    await getObserverCallback()([
        {
            type: 'childList',
            addedNodes: [addedRoot],
        },
    ]);

    assert.deepEqual(getTranslateTexts(sentMessages), [
        'Observed caption',
        'Observed term',
        'Observed definition',
        'Observed table title',
    ]);
});

test('getImmersiveMinLength uses the low threshold for the new semantic elements but not summary', async () => {
    const { getImmersiveMinLength } = await loadImmersiveHarness();

    assert.equal(getImmersiveMinLength(createNode('figcaption', { text: 'x' }), false), 2);
    assert.equal(getImmersiveMinLength(createNode('dt', { text: 'x' }), false), 2);
    assert.equal(getImmersiveMinLength(createNode('dd', { text: 'x' }), false), 2);
    assert.equal(getImmersiveMinLength(createNode('caption', { text: 'x' }), false), 2);
    assert.equal(getImmersiveMinLength(createNode('summary', { text: 'x' }), false), 20);
});

test('source file extends both initial and observer selectors with semantic elements but leaves summary out', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(
        immersive,
        /const GENERIC_SELECTORS = 'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption';/,
    );
    assert.match(
        immersive,
        /node\.querySelectorAll\(GENERIC_SELECTORS\)/,
    );
    assert.doesNotMatch(immersive, /GENERIC_SELECTORS[^\\n]*summary/);
    assert.doesNotMatch(immersive, /DISCORD_GENERIC_SELECTORS[^\\n]*summary/);
});
