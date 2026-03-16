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
        if (part.startsWith('[') && part.endsWith(']')) {
            return false;
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
        get innerHTML() {
            return node.__innerHTML || '';
        },
        set innerHTML(value) {
            node.__innerHTML = value;
            node.children = [];
            if (value === '<span></span><span></span><span></span>') {
                node.appendChild(createNode('span'));
                node.appendChild(createNode('span'));
                node.appendChild(createNode('span'));
            }
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
window.__immersive087Test = {
  injectLoadingPlaceholder,
};`;

    vm.runInNewContext(instrumented, context, { filename: 'immersive.js' });

    return {
        ST: context.window.SmartTranslator,
        document,
        testApi: context.window.__immersive087Test,
    };
}

function createContainer(tagName, { parentDisplay = 'block', display = 'block' } = {}) {
    const parentNode = createNode('section', { display: parentDisplay });
    const container = createNode(tagName, { text: 'Original text', display });
    parentNode.appendChild(container);
    return { container, parentNode };
}

test('087 static wiring covers replace-mode CSS, immersive tags, and options showOriginal controls', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');
    const contentCss = await readWorkspaceFile('content/content.css');
    const optionsHtml = await readWorkspaceFile('options/options.html');
    const optionsJs = await readWorkspaceFile('options/options.js');

    assert.match(contentCss, /body\.st-replace-mode \.st-translated\s*\{[\s\S]*opacity:\s*0;[\s\S]*max-height:\s*0;[\s\S]*pointer-events:\s*none;/);
    assert.doesNotMatch(contentCss, /body\.st-replace-mode \.st-translated:has\(\+ \.st-immersive-wrapper:hover\),[\s\S]*body\.st-replace-mode \.st-translated:hover\s*\{/);
    assert.doesNotMatch(contentCss, /body\.st-replace-mode \.st-translated\s*\{[^}]*display:\s*none/);
    assert.doesNotMatch(contentCss, /body\.st-replace-mode \.st-translated\s*\{[^}]*clip-path:/);
    assert.match(contentCss, /body\.st-replace-mode \.st-translated-inline\s*\{[\s\S]*font-size:\s*0\s*!important;/);
    assert.match(contentCss, /\.st-translated-inline > \*:not\(\.st-immersive-translation\):not\(\.st-immersive-loading\)\s*\{[^}]*clip-path:\s*inset\(50%\)\s*!important;[^}]*\}/);
    assert.doesNotMatch(contentCss, /\.st-translated-inline > \*:not\(\.st-immersive-translation\):not\(\.st-immersive-loading\)\s*\{[^}]*display:\s*none/);
    assert.match(contentCss, /pointer-events:\s*none\s*!important;/);
    assert.match(contentCss, /:not\(\.st-immersive-loading\)/);
    assert.match(contentCss, /body\.st-replace-mode \.st-translated-inline > \.st-immersive-translation\s*\{[\s\S]*font-size:\s*0\.9rem\s*!important;/);

    assert.match(immersive, /st-translated-inline/);
    assert.match(immersive, /st-translated/);
    assert.match(immersive, /st-replace-mode/);

    assert.match(optionsHtml, /id="show-original"/);
    assert.match(optionsJs, /showOriginal/);
});

test('087 injectTranslation tags block, inline, and cell-internal containers for replace mode', async () => {
    const { ST } = await loadImmersiveHarness();

    const { container: paragraph } = createContainer('p', { parentDisplay: 'block', display: 'block' });
    ST.injectTranslation(paragraph, '段落译文');
    assert.equal(paragraph.classList.contains('st-translated'), true);

    const { container: inlineContainer } = createContainer('span', { parentDisplay: 'block', display: 'inline' });
    ST.injectTranslation(inlineContainer, '行内译文');
    assert.equal(inlineContainer.classList.contains('st-translated-inline'), true);

    const { container: cellContainer } = createContainer('td', { parentDisplay: 'table-row', display: 'table-cell' });
    ST.injectTranslation(cellContainer, '单元格译文');
    assert.equal(cellContainer.classList.contains('st-translated-inline'), true);
});

test('087 toggleImmersive close path removes replace-mode and translated marker classes', async () => {
    const root = createNode('section');
    const translated = createNode('p', { classes: ['st-translated'] });
    const translatedInline = createNode('td', { classes: ['st-translated-inline'] });
    const translation = createNode('div', { classes: ['st-immersive-translation'] });
    const wrapper = createNode('div', { classes: ['st-immersive-wrapper'] });
    translatedInline.appendChild(translation);
    root.appendChild(translated);
    root.appendChild(translatedInline);
    root.appendChild(wrapper);

    const { ST, document } = await loadImmersiveHarness({ roots: [root] });
    document.body.classList.add('st-replace-mode');

    await ST.toggleImmersive();

    assert.equal(document.body.classList.contains('st-replace-mode'), false);
    assert.equal(translated.classList.contains('st-translated'), false);
    assert.equal(translatedInline.classList.contains('st-translated-inline'), false);
});

test('087 replace-mode path keeps source child nodes and loader nodes in DOM', async () => {
    const root = createNode('section');
    const td = createNode('td', { display: 'table-cell' });
    const strong = createNode('strong', { text: 'Price' });
    td.appendChild(strong);
    root.appendChild(td);

    const { ST, testApi } = await loadImmersiveHarness({ roots: [root] });
    testApi.injectLoadingPlaceholder(td);
    ST.injectTranslation(td, '价格详情');

    assert.equal(td.classList.contains('st-translated-inline'), true);
    assert.ok(td.querySelector('strong'));
    assert.ok(td.querySelector('.st-immersive-loading'));
});
