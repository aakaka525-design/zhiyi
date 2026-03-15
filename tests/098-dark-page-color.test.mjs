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
        return part.toLowerCase() === node.__tagName;
    });
}

function createStyle(initial = {}) {
    const store = new Map(Object.entries(initial));
    return {
        setProperty(name, value) {
            store.set(name, String(value));
        },
        getPropertyValue(name) {
            return store.get(name) || '';
        },
        removeProperty(name) {
            const current = store.get(name) || '';
            store.delete(name);
            return current;
        },
    };
}

function createNode(tagName, {
    text = '',
    classes = [],
    children = [],
    display = 'block',
    visibility = 'visible',
    color = 'rgb(51, 51, 51)',
    style = {},
} = {}) {
    let ownText = text;

    const node = {
        __tagName: tagName.toLowerCase(),
        __classes: [...classes],
        tagName: tagName.toUpperCase(),
        nodeType: 1,
        __attached: true,
        __computedStyle: { display, visibility, color },
        parentNode: null,
        children: [],
        style: createStyle(style),
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
                text: ownText,
                classes: [...node.__classes],
                display,
                visibility,
                color,
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
            settings: { targetLang: 'zh', showOriginal: false },
            isImmersiveEnabled: true,
            immersiveRunId: 1,
        },
        observers: {},
        pendingTranslations: new Set(),
        stopMutationObserver() {},
        startMutationObserver() {},
        showToast() {},
        showProgress() {},
        hideProgress() {},
        updateProgress() {},
        detectLanguage() {
            return 'en';
        },
        isPluginElement() {
            return false;
        },
        async sendMessage(payload) {
            if (payload.action === 'translateBatch') {
                return { results: payload.texts.map((text) => `ZH:${text}`) };
            }
            return {};
        },
    };

    const context = {
        window: {
            SmartTranslator: ST,
            location: { hostname: 'example.com' },
            getComputedStyle(target) {
                return target?.__computedStyle || { display: 'block', visibility: 'visible', color: 'rgb(51, 51, 51)' };
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
        Promise,
        WeakMap,
    };

    vm.runInNewContext(source, context, { filename: 'immersive.js' });

    return {
        ST: context.window.SmartTranslator,
    };
}

test('098 injectTranslation captures page color and replace-mode CSS uses the fallback variable', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');
    const css = await readWorkspaceFile('content/content.css');

    assert.match(immersive, /setNodePageColor\(container,\s*originalColor\);/);
    assert.match(immersive, /setNodePageColor\(wrapper,\s*originalColor\);/);
    assert.match(
        css,
        /body\.st-replace-mode \.st-immersive-translation\s*\{[\s\S]*color:\s*var\(--st-page-color,\s*var\(--text-primary\)\);/,
    );
    assert.match(
        css,
        /body\.st-replace-mode \.st-translated-inline > \.st-immersive-translation\s*\{[\s\S]*color:\s*var\(--st-page-color,\s*var\(--text-primary\)\)\s*!important;/,
    );
});

test('098 inline injection stores --st-page-color on the container', async () => {
    const parent = createNode('div');
    const inline = createNode('span', { text: 'Hello', display: 'inline', color: 'rgb(200, 200, 200)' });
    parent.appendChild(inline);
    const { ST } = await loadImmersiveHarness({ roots: [parent] });

    ST.injectTranslation(inline, '你好');

    assert.equal(inline.style.getPropertyValue('--st-page-color'), 'rgb(200, 200, 200)');
    assert.equal(inline.classList.contains('st-translated-inline'), true);
});

test('098 block injection stores --st-page-color on the wrapper', async () => {
    const root = createNode('div');
    const paragraph = createNode('p', { text: 'Hello block', color: 'rgb(220, 220, 220)' });
    root.appendChild(paragraph);
    const { ST } = await loadImmersiveHarness({ roots: [root] });

    ST.injectTranslation(paragraph, '块级译文');

    const wrapper = paragraph.nextElementSibling;
    assert.ok(wrapper);
    assert.equal(wrapper.classList.contains('st-immersive-wrapper'), true);
    assert.equal(wrapper.style.getPropertyValue('--st-page-color'), 'rgb(220, 220, 220)');
});

test('098 toggleImmersive cleanup removes --st-page-color from translated inline containers', async () => {
    const root = createNode('div');
    const translatedInline = createNode('td', {
        classes: ['st-translated-inline'],
        style: { '--st-page-color': 'rgb(240, 240, 240)' },
    });
    const translation = createNode('div', { classes: ['st-immersive-translation'], text: '译文' });
    translatedInline.appendChild(translation);
    root.appendChild(translatedInline);

    const { ST } = await loadImmersiveHarness({ roots: [root] });
    await ST.toggleImmersive();

    assert.equal(translatedInline.style.getPropertyValue('--st-page-color'), '');
    assert.equal(translatedInline.classList.contains('st-translated-inline'), false);
});
