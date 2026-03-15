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
        if (part.startsWith('.')) {
            return node.__classes.includes(part.slice(1));
        }
        if (part.startsWith('#')) {
            return node.id === part.slice(1);
        }
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

    const node = {
        __tagName: tagName.toLowerCase(),
        __classes: [...classes],
        tagName: tagName.toUpperCase(),
        nodeType: 1,
        id,
        __attached: true,
        __computedStyle: { display, visibility },
        parentNode: null,
        children: [],
        style: {},
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
        querySelector(selector) {
            return node.querySelectorAll(selector)[0] || null;
        },
        querySelectorAll(selector) {
            const result = [];
            for (const child of node.children) {
                if (child.matches(selector)) {
                    result.push(child);
                }
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
                if (typeof current.matches === 'function' && current.matches(selector)) {
                    return current;
                }
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
            if (deep) {
                for (const child of node.children) {
                    clone.appendChild(child.cloneNode(true));
                }
            }
            return clone;
        },
    };

    for (const child of children) {
        node.appendChild(child);
    }

    return node;
}

async function loadImmersiveHarness({ roots = [], sendMessageImpl, stateOverrides = {} } = {}) {
    const source = await readWorkspaceFile('content/modules/immersive.js');
    let observerCallback = null;

    const document = {
        body: createNode('body'),
        querySelectorAll(selector) {
            const result = [];
            const seen = new Set();
            const visit = (node) => {
                if (node.matches(selector) && !seen.has(node)) {
                    seen.add(node);
                    result.push(node);
                }
                for (const child of node.children) {
                    visit(child);
                }
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
            immersiveRunId: 1,
            ...stateOverrides,
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
        Promise,
        WeakMap,
    };

    const instrumented = `${source}
window.__immersive089Test = {
  rescanUntranslatedElements,
};`;

    vm.runInNewContext(instrumented, context, { filename: 'immersive.js' });

    return {
        ST: context.window.SmartTranslator,
        testApi: context.window.__immersive089Test,
        getObserverCallback() {
            return observerCallback;
        },
    };
}

test('089 static wiring covers failed marker css, success removal, and close cleanup', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');
    const contentCss = await readWorkspaceFile('content/content.css');

    assert.match(contentCss, /\.st-translate-failed\s*\{[^}]*outline:\s*1px dashed var\(--error,\s*#E57373\);[^}]*outline-offset:\s*-1px;[^}]*\}/);
    assert.match(immersive, /function markTranslateFailed\(el\)\s*\{\s*el\?\.classList\?\.add\?\.\('st-translate-failed'\);/);
    assert.match(immersive, /function clearTranslateFailed\(el\)\s*\{\s*el\?\.classList\?\.remove\?\.\('st-translate-failed'\);/);
    assert.ok((immersive.match(/markTranslateFailed\(/g) || []).length >= 5);
    assert.match(immersive, /clearTranslateFailed\(p\);\s*const sourceText = p\.innerText\.trim\(\);\s*ST\.injectTranslation/);
    assert.match(immersive, /document\.querySelectorAll\('\.st-translate-failed'\)\.forEach\(el => \{\s*clearTranslateFailed\(el\);/);
});

test('089 initial scan marks entire batch as failed when translateBatch throws', async () => {
    const paragraphs = [
        createNode('p', { text: 'First paragraph with enough text to translate.' }),
        createNode('p', { text: 'Second paragraph with enough text to translate.' }),
    ];
    const { ST } = await loadImmersiveHarness({
        roots: paragraphs,
        sendMessageImpl(payload) {
            if (payload.action === 'translateBatch') {
                throw new Error('boom');
            }
            return {};
        },
    });

    await ST.toggleImmersive();

    assert.equal(paragraphs[0].classList.contains('st-translate-failed'), true);
    assert.equal(paragraphs[1].classList.contains('st-translate-failed'), true);
});

test('089 partial batch failures mark only falsy slots and successful results clear old failed markers', async () => {
    const paragraphs = [
        createNode('p', { text: 'First paragraph with enough text to translate.', classes: ['st-translate-failed'] }),
        createNode('p', { text: 'Second paragraph with enough text to translate.' }),
        createNode('p', { text: 'Third paragraph with enough text to translate.' }),
    ];
    const { ST } = await loadImmersiveHarness({
        roots: paragraphs,
        sendMessageImpl(payload) {
            if (payload.action === 'translateBatch') {
                return { results: ['译文一', null, '译文三'] };
            }
            return {};
        },
    });

    await ST.toggleImmersive();

    assert.equal(paragraphs[0].classList.contains('st-translate-failed'), false);
    assert.equal(paragraphs[1].classList.contains('st-translate-failed'), true);
    assert.equal(paragraphs[2].classList.contains('st-translate-failed'), false);
});

test('089 observer and rescan paths also mark failed elements', async () => {
    const observed = [
        createNode('p', { text: 'Observed paragraph one with enough text.' }),
        createNode('p', { text: 'Observed paragraph two with enough text.' }),
    ];
    const rescanned = [
        createNode('p', { text: 'Rescan paragraph one with enough text.' }),
        createNode('p', { text: 'Rescan paragraph two with enough text.' }),
    ];

    const { ST, testApi, getObserverCallback } = await loadImmersiveHarness({
        roots: rescanned,
        stateOverrides: {
            isImmersiveEnabled: true,
        },
        sendMessageImpl(payload) {
            if (payload.action === 'translateBatch') {
                throw new Error('batch fail');
            }
            return {};
        },
    });

    ST.startMutationObserver();
    const observerCallback = getObserverCallback();
    await observerCallback([{ type: 'childList', addedNodes: observed }]);

    assert.equal(observed[0].classList.contains('st-translate-failed'), true);
    assert.equal(observed[1].classList.contains('st-translate-failed'), true);

    await testApi.rescanUntranslatedElements(1, 'zh', false, false, false);

    assert.equal(rescanned[0].classList.contains('st-translate-failed'), true);
    assert.equal(rescanned[1].classList.contains('st-translate-failed'), true);
});

test('089 toggleImmersive close path clears failed markers', async () => {
    const paragraph = createNode('p', {
        text: 'Paragraph with failed translation marker.',
        classes: ['st-translate-failed'],
    });
    const { ST } = await loadImmersiveHarness({
        roots: [paragraph],
        stateOverrides: {
            isImmersiveEnabled: true,
        },
    });

    await ST.toggleImmersive();

    assert.equal(paragraph.classList.contains('st-translate-failed'), false);
});
