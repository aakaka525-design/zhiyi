import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

async function loadImmersiveHarness() {
    const source = await readWorkspaceFile('content/modules/immersive.js');

    const document = {
        contains(target) {
            return Boolean(target?.__attached);
        },
        createElement(tagName) {
            return {
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
            };
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

test('immersive injectTranslation appends li translations inside the list item', async () => {
    const { ST } = await loadImmersiveHarness();
    const { container, parentNode } = createContainer('li', {
        parentDisplay: 'block',
        display: 'list-item',
    });

    ST.injectTranslation(container, '列表项译文');

    assert.equal(parentNode.inserted, null);
    assert.equal(container.classList.contains('st-translated-inline'), true);
    assert.equal(container.children.length, 1);
    assert.equal(container.children[0].className, 'st-immersive-translation');
    assert.equal(container.children[0].innerText, '列表项译文');
});

test('immersive injectTranslation keeps td and th on the same internal injection path', async () => {
    const { ST } = await loadImmersiveHarness();

    for (const tagName of ['td', 'th']) {
        const { container, parentNode } = createContainer(tagName, {
            parentDisplay: 'table-row',
            display: 'table-cell',
        });

        ST.injectTranslation(container, `${tagName} 译文`);

        assert.equal(parentNode.inserted, null);
        assert.equal(container.classList.contains('st-translated-inline'), true);
        assert.equal(container.children.length, 1);
        assert.equal(container.children[0].className, 'st-immersive-translation');
    }
});

test('immersive injectTranslation keeps wrapper sibling insertion for regular block elements', async () => {
    const { ST } = await loadImmersiveHarness();

    for (const tagName of ['p', 'blockquote']) {
        const { container, parentNode } = createContainer(tagName, {
            parentDisplay: 'block',
            display: 'block',
        });

        ST.injectTranslation(container, `${tagName} 译文`);

        assert.equal(container.children.length, 0);
        assert.equal(container.classList.contains('st-translated'), true);
        assert.ok(parentNode.inserted);
        assert.equal(parentNode.inserted.node.className, 'st-immersive-wrapper');
        assert.equal(parentNode.inserted.node.children.length, 1);
        assert.equal(parentNode.inserted.node.children[0].className, 'st-immersive-translation');
    }
});
