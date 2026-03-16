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
        if (part.startsWith('.')) return node.__classes.includes(part.slice(1));
        if (part.startsWith('#')) return node.id === part.slice(1);
        return part.toLowerCase() === node.__tagName;
    });
}

function createNode(tagName, {
    id = '',
    text = '',
    classes = [],
    children = [],
    display = 'block',
    visibility = 'visible',
} = {}) {
    let ownText = text;
    const attributes = new Map();

    const node = {
        __tagName: tagName.toLowerCase(),
        __classes: [...classes],
        tagName: tagName.toUpperCase(),
        nodeType: 1,
        id,
        __attached: true,
        __computedStyle: { display, visibility, color: 'rgb(0, 0, 0)' },
        parentNode: null,
        children: [],
        style: {
            setProperty(name, value) {
                this[name] = value;
            },
            removeProperty(name) {
                delete this[name];
            },
        },
        classList: {
            contains(cls) {
                return node.__classes.includes(cls);
            },
            add(...classesToAdd) {
                classesToAdd.forEach((cls) => {
                    if (!node.__classes.includes(cls)) node.__classes.push(cls);
                });
            },
            remove(...classesToRemove) {
                node.__classes = node.__classes.filter((cls) => !classesToRemove.includes(cls));
            },
        },
        get className() {
            return node.__classes.join(' ');
        },
        set className(value) {
            node.__classes = value ? String(value).split(/\s+/).filter(Boolean) : [];
        },
        get innerText() {
            return [ownText, ...node.children.map((child) => child.innerText)].join('').trim();
        },
        set innerText(value) {
            ownText = value;
        },
        get textContent() {
            return [ownText, ...node.children.map((child) => child.textContent)].join('');
        },
        set textContent(value) {
            ownText = value;
        },
        get nextElementSibling() {
            if (!node.parentNode) return null;
            const siblings = node.parentNode.children;
            const index = siblings.indexOf(node);
            return siblings[index + 1] || null;
        },
        appendChild(child) {
            child.parentNode = node;
            child.__attached = true;
            node.children.push(child);
            return child;
        },
        insertBefore(child, before) {
            child.parentNode = node;
            child.__attached = true;
            const index = node.children.indexOf(before);
            if (index === -1) {
                node.children.push(child);
            } else {
                node.children.splice(index, 0, child);
            }
            return child;
        },
        removeChild(child) {
            const index = node.children.indexOf(child);
            if (index !== -1) {
                node.children.splice(index, 1);
                child.parentNode = null;
                child.__attached = false;
            }
        },
        remove() {
            if (node.parentNode) {
                node.parentNode.removeChild(node);
            } else {
                node.__attached = false;
            }
        },
        setAttribute(name, value) {
            attributes.set(name, String(value));
        },
        getAttribute(name) {
            return attributes.get(name) || null;
        },
        removeAttribute(name) {
            attributes.delete(name);
        },
        querySelector(selector) {
            return node.querySelectorAll(selector)[0] || null;
        },
        querySelectorAll(selector) {
            const result = [];
            for (const child of node.children) {
                if (child.matches(selector)) result.push(child);
                result.push(...child.querySelectorAll(selector));
            }
            return result;
        },
        matches(selector) {
            return selectorMatches(node, selector);
        },
        closest(selector) {
            let current = node;
            while (current) {
                if (typeof current.matches === 'function' && current.matches(selector)) return current;
                current = current.parentNode;
            }
            return null;
        },
        cloneNode(deep = false) {
            const clone = createNode(tagName, {
                id,
                text: ownText,
                classes: [...node.__classes],
                display,
                visibility,
            });
            for (const [name, value] of attributes.entries()) {
                clone.setAttribute(name, value);
            }
            if (deep) {
                for (const child of node.children) {
                    clone.appendChild(child.cloneNode(true));
                }
            }
            return clone;
        },
        getBoundingClientRect() {
            return { top: 20, bottom: 40, left: 20, right: 220, width: 200, height: 20 };
        },
    };

    children.forEach((child) => node.appendChild(child));
    return node;
}

async function loadImmersiveHarness({ roots = [], sendMessageImpl } = {}) {
    const source = await readWorkspaceFile('content/modules/immersive.js');
    const sentMessages = [];
    let observerCallback = null;

    const body = createNode('body');

    const document = {
        body,
        querySelectorAll(selector) {
            const result = [];
            const seen = new Set();
            const visit = (node) => {
                if (node.matches(selector) && !seen.has(node)) {
                    seen.add(node);
                    result.push(node);
                }
                for (const child of node.children) visit(child);
            };
            roots.filter((root) => root.__attached !== false).forEach(visit);
            return result;
        },
        contains(target) {
            return Boolean(target?.__attached);
        },
        createElement(tagName) {
            return createNode(tagName);
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
        detectLanguage() {
            return 'en';
        },
        isPluginElement() {
            return false;
        },
        async sendMessage(payload) {
            sentMessages.push(payload);
            if (sendMessageImpl) return sendMessageImpl(payload);
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
            location: { hostname: 'example.com', pathname: '/' },
            innerWidth: 1280,
            innerHeight: 800,
            getComputedStyle(target) {
                return target?.__computedStyle || {
                    display: 'block',
                    visibility: 'visible',
                    color: 'rgb(0, 0, 0)',
                };
            },
            addEventListener() {},
            removeEventListener() {},
        },
        document,
        console: { log() {}, error() {}, warn() {} },
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
        Map,
        Set,
    };

    const instrumented = `${source}
window.__immersive112Test = {
  cacheTranslation,
  getCachedTranslation,
  translationCache,
};`;

    vm.runInNewContext(instrumented, context, { filename: 'immersive.js' });

    return {
        ST: context.window.SmartTranslator,
        sentMessages,
        testApi: context.window.__immersive112Test,
        getObserverCallback() {
            return observerCallback;
        },
    };
}

function getTranslateBatchCalls(sentMessages) {
    return sentMessages.filter((payload) => payload.action === 'translateBatch');
}

function getInjectedTranslation(container) {
    return container.querySelector('.st-immersive-translation') ||
        container.nextElementSibling?.querySelector('.st-immersive-translation') ||
        null;
}

test('112 defines run-scoped translation cache helpers and clears cache on immersive close', async () => {
    const source = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(source, /const translationCache = new Map\(\);/);
    assert.match(source, /function cacheTranslation\(targetLang, sourceText, translation\)/);
    assert.match(source, /function getCachedTranslation\(targetLang, sourceText\)/);
    assert.match(source, /translationCache\.clear\(\);/);
});

test('112 cache hit injects translation without issuing a new batch request', async () => {
    const text = 'This cached paragraph should reuse its translation immediately.';
    const paragraph = createNode('p', { text });
    const feed = createNode('section', { children: [paragraph] });
    const { ST, sentMessages, testApi, getObserverCallback } = await loadImmersiveHarness({ roots: [feed] });

    testApi.cacheTranslation('zh', text, `ZH:${text}`);
    ST.state.isImmersiveEnabled = true;
    ST.state.immersiveRunId = 1;
    ST.startMutationObserver();

    await getObserverCallback()([
        {
            type: 'childList',
            addedNodes: [paragraph],
        },
    ]);

    assert.equal(getTranslateBatchCalls(sentMessages).length, 0);
    assert.ok(getInjectedTranslation(paragraph));
});

test('112 cache miss still issues translateBatch normally', async () => {
    const paragraph = createNode('p', {
        text: 'This uncached paragraph should still go through translateBatch.',
    });
    const feed = createNode('section', { children: [paragraph] });
    const { ST, sentMessages } = await loadImmersiveHarness({ roots: [feed] });

    await ST.toggleImmersive();

    assert.equal(getTranslateBatchCalls(sentMessages).length, 1);
    assert.ok(getInjectedTranslation(paragraph));
});

test('112 immersive close clears cached translations', async () => {
    const { ST, testApi } = await loadImmersiveHarness();

    testApi.cacheTranslation('zh', 'Cache me', 'ZH:Cache me');
    assert.equal(testApi.getCachedTranslation('zh', 'Cache me'), 'ZH:Cache me');

    ST.state.isImmersiveEnabled = true;
    await ST.toggleImmersive();

    assert.equal(testApi.getCachedTranslation('zh', 'Cache me'), null);
    assert.equal(testApi.translationCache.size, 0);
});
