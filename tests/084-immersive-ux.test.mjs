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
            add(cls) {
                if (!node.__classes.includes(cls)) node.__classes.push(cls);
            },
            remove(...classes) {
                node.__classes = node.__classes.filter((cls) => !classes.includes(cls));
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
        get innerHTML() {
            return node.__innerHTML || '';
        },
        set innerHTML(value) {
            node.__innerHTML = value;
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

async function loadImmersiveHarness({ roots = [] } = {}) {
    const source = await readWorkspaceFile('content/modules/immersive.js');

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
            isImmersiveEnabled: true,
            immersiveRunId: 1,
        },
        observers: {},
        pendingTranslations: new Set(),
        stopMutationObserver() {},
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
            disconnect() {}
            observe() {}
        },
        Node: { ELEMENT_NODE: 1 },
        setTimeout,
        clearTimeout,
    };

    const instrumented = `${source}
window.__immersive084Test = {
  injectLoadingPlaceholder,
  removeLoadingPlaceholder,
};`;

    vm.runInNewContext(instrumented, context, { filename: 'immersive.js' });

    return {
        ST: context.window.SmartTranslator,
        testApi: context.window.__immersive084Test,
    };
}

function createContainer(tagName, { parentDisplay = 'block', display = 'block' } = {}) {
    const parentNode = createNode('section', { display: parentDisplay });
    const container = createNode(tagName, { text: 'Original text', display });
    parentNode.appendChild(container);
    return { container, parentNode };
}

test('084 inline path appends translation directly without separator or inline override', async () => {
    const { ST } = await loadImmersiveHarness();
    const { container, parentNode } = createContainer('span', {
        parentDisplay: 'block',
        display: 'inline',
    });

    ST.injectTranslation(container, '译文');

    assert.equal(parentNode.children.length, 1);
    assert.equal(container.children.length, 1);
    assert.equal(container.children[0].className, 'st-immersive-translation');
    assert.equal(container.querySelector('.st-translation-separator'), null);
    assert.equal(container.children[0].style.cssText, undefined);
});

test('084 cell-internal and block-wrapper paths keep their existing behavior', async () => {
    const { ST } = await loadImmersiveHarness();

    const { container: cell, parentNode: cellParent } = createContainer('td', {
        parentDisplay: 'table-row',
        display: 'table-cell',
    });
    ST.injectTranslation(cell, '单元格译文');
    assert.equal(cellParent.children.length, 1);
    assert.equal(cell.children.length, 1);
    assert.equal(cell.children[0].tagName, 'DIV');
    assert.equal(cell.children[0].className, 'st-immersive-translation');

    const { container: paragraph, parentNode } = createContainer('p', {
        parentDisplay: 'block',
        display: 'block',
    });
    ST.injectTranslation(paragraph, '段落译文');
    assert.equal(paragraph.children.length, 0);
    assert.equal(parentNode.children.length, 2);
    assert.equal(parentNode.children[1].className, 'st-immersive-wrapper');
});

test('084 loading helpers append one loader and remove it cleanly', async () => {
    const { testApi } = await loadImmersiveHarness();
    const container = createNode('p', { text: 'Loading target' });

    testApi.injectLoadingPlaceholder(container);
    testApi.injectLoadingPlaceholder(container);

    const loaders = container.querySelectorAll('.st-immersive-loading');
    assert.equal(loaders.length, 1);

    testApi.removeLoadingPlaceholder(container);
    assert.equal(container.querySelector('.st-immersive-loading'), null);
});

test('084 toggleImmersive close path removes loading placeholders together with translation artifacts', async () => {
    const translation = createNode('span', { classes: ['st-immersive-translation'] });
    const separator = createNode('span', { classes: ['st-translation-separator'] });
    const loader = createNode('span', { classes: ['st-immersive-loading'] });
    const wrapper = createNode('div', { classes: ['st-immersive-wrapper'] });

    const root = createNode('section', { children: [translation, separator, loader, wrapper] });
    const { ST } = await loadImmersiveHarness({ roots: [root] });

    await ST.toggleImmersive();

    assert.equal(translation.__attached, false);
    assert.equal(separator.__attached, false);
    assert.equal(loader.__attached, false);
    assert.equal(wrapper.__attached, false);
    assert.equal(ST.state.isImmersiveEnabled, false);
});

test('084 source defines loading helpers, three batch call sites, and CSS loader rules', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');
    const contentCss = await readWorkspaceFile('content/content.css');

    assert.match(immersive, /function injectLoadingPlaceholder\(el\)/);
    assert.match(immersive, /function removeLoadingPlaceholder\(el\)/);
    assert.equal((immersive.match(/batch\.forEach\(\w+ => injectLoadingPlaceholder\(\w+\)\);/g) || []).length, 3);
    assert.equal((immersive.match(/batch\.forEach\(\w+ => removeLoadingPlaceholder\(\w+\)\);/g) || []).length, 3);
    assert.match(immersive, /\.st-immersive-loading/);

    assert.match(contentCss, /\.st-immersive-loading\s*\{/);
    assert.match(contentCss, /\.st-immersive-loading::before\s*\{/);
    assert.match(contentCss, /@keyframes st-loading-breathe\s*\{/);
    assert.match(contentCss, /@keyframes st-bounce\s*\{/);
});
