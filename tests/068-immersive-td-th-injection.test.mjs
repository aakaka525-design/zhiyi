import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

async function loadImmersiveHarness() {
    const source = await readWorkspaceFile('content/modules/immersive.js');
    const created = [];

    const document = {
        contains(target) {
            return Boolean(target?.__attached);
        },
        createElement(tagName) {
            const el = {
                tagName: tagName.toUpperCase(),
                className: '',
                innerText: '',
                style: {},
                children: [],
                parentNode: null,
                appendChild(child) {
                    this.children.push(child);
                    child.parentNode = this;
                },
                querySelector() {
                    return null;
                },
                querySelectorAll() {
                    return [];
                },
            };
            created.push(el);
            return el;
        },
        querySelectorAll() {
            return [];
        },
    };

    const ST = {
        state: {
            settings: { targetLang: 'zh' },
        },
        observers: {},
        pendingTranslations: new Set(),
        isPluginElement() {
            return false;
        },
        detectLanguage() {
            return 'en';
        },
    };

    const context = {
        window: {
            SmartTranslator: ST,
            location: { hostname: 'example.com' },
            getComputedStyle(target) {
                return target?.__computedStyle || { display: 'block', visibility: 'visible' };
            },
        },
        document,
        console: {
            log() {},
            error() {},
            warn() {},
        },
        MutationObserver: class {
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
        __computedStyle: { display },
        innerText: 'Original text',
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
        querySelectorAll() {
            return [];
        },
        matches(selector) {
            return selector.split(',').map((part) => part.trim()).includes(tagName);
        },
    };

    return { container, parentNode };
}

test('immersive injectTranslation appends td/th translations inside the cell instead of inserting a sibling wrapper', async () => {
    const { ST } = await loadImmersiveHarness();
    const { container, parentNode } = createContainer('td', {
        parentDisplay: 'table-row',
        display: 'table-cell',
    });

    ST.injectTranslation(container, '单元格译文');

    assert.equal(parentNode.inserted, null);
    assert.equal(container.classList.contains('st-translated-inline'), true);
    assert.equal(container.children.length, 1);
    assert.equal(container.children[0].className, 'st-immersive-translation');
    assert.equal(container.children[0].innerText, '单元格译文');
});

test('immersive injectTranslation keeps wrapper sibling insertion for regular block elements', async () => {
    const { ST } = await loadImmersiveHarness();
    const { container, parentNode } = createContainer('p', {
        parentDisplay: 'block',
        display: 'block',
    });

    ST.injectTranslation(container, '段落译文');

    assert.equal(container.children.length, 0);
    assert.equal(container.classList.contains('st-translated'), true);
    assert.ok(parentNode.inserted);
    assert.equal(parentNode.inserted.node.className, 'st-immersive-wrapper');
    assert.equal(parentNode.inserted.node.children.length, 1);
    assert.equal(parentNode.inserted.node.children[0].className, 'st-immersive-translation');
    assert.equal(parentNode.inserted.node.children[0].innerText, '段落译文');
});

test('immersive mutation observer selector includes td and th for dynamic table content', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(
        immersive,
        /const GENERIC_SELECTORS = 'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption';/,
    );
    assert.match(
        immersive,
        /node\.querySelectorAll\(GENERIC_SELECTORS\)/,
    );
});

test('immersive mutation observer reuses querySelector translation dedupe alongside wrapper sibling checks', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(
        immersive,
        /if \(el\.nextElementSibling\?\.classList\.contains\('st-immersive-wrapper'\)\) return false;\s*if \(el\.querySelector\('\.st-immersive-translation'\)\) return false;\s*if \(ST\.pendingTranslations\.has\(el\)\) return false;/,
    );
});
