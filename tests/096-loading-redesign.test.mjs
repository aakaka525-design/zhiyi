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
            const visit = (node) => {
                if (node.matches(selector)) {
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
        console: { log() {}, error() {}, warn() {} },
        MutationObserver: class {
            disconnect() {}
            observe() {}
        },
        Node: { ELEMENT_NODE: 1 },
        setTimeout,
        clearTimeout,
    };

    const instrumented = `${source}
window.__immersive096Test = {
  injectLoadingPlaceholder,
  removeLoadingPlaceholder,
};`;

    vm.runInNewContext(instrumented, context, { filename: 'immersive.js' });

    return {
        ST: context.window.SmartTranslator,
        testApi: context.window.__immersive096Test,
    };
}

test('096 content CSS switches immersive loading to pseudo-text redesign', async () => {
    const css = await readWorkspaceFile('content/content.css');

    assert.match(css, /\.st-immersive-loading::before\s*\{[\s\S]*content:\s*'翻译中\.\.\.';[\s\S]*font-size:\s*0\.85rem;/);
    assert.match(css, /@keyframes st-loading-breathe\s*\{/);
    assert.doesNotMatch(css, /@keyframes st-bar-pulse\s*\{/);
    assert.doesNotMatch(css, /\.st-immersive-loading span\s*\{/);
});

test('096 loading placeholder uses an empty DIV and keeps source text untouched', async () => {
    const paragraph = createNode('p', { text: 'Original paragraph text' });
    const { testApi } = await loadImmersiveHarness({ roots: [paragraph] });

    testApi.injectLoadingPlaceholder(paragraph);

    const loader = paragraph.querySelector('.st-immersive-loading');
    assert.ok(loader);
    assert.equal(loader.tagName, 'DIV');
    assert.equal(loader.textContent, '');
    assert.equal(paragraph.innerText, 'Original paragraph text');
});

test('096 immersive close cleanup still removes redesigned loading placeholders', async () => {
    const loader = createNode('div', { classes: ['st-immersive-loading'] });
    const root = createNode('section', { children: [loader] });
    const { ST } = await loadImmersiveHarness({ roots: [root] });

    await ST.toggleImmersive();

    assert.equal(loader.__attached, false);
});
