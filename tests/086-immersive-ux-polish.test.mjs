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
    };

    for (const child of children) {
        node.appendChild(child);
    }

    return node;
}

async function loadImmersiveHarness() {
    const source = await readWorkspaceFile('content/modules/immersive.js');
    const document = {
        body: createNode('body'),
        querySelectorAll() {
            return [];
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
window.__immersive086Test = {
  injectLoadingPlaceholder,
  removeLoadingPlaceholder,
};`;

    vm.runInNewContext(instrumented, context, { filename: 'immersive.js' });

    return {
        ST: context.window.SmartTranslator,
        testApi: context.window.__immersive086Test,
    };
}

function createContainer(tagName, { parentDisplay = 'block', display = 'block' } = {}) {
    const parentNode = createNode('section', { display: parentDisplay });
    const container = createNode(tagName, { text: 'Original text', display });
    parentNode.appendChild(container);
    return { container, parentNode };
}

test('086 content CSS defines inline-only immersive translation override', async () => {
    const contentCss = await readWorkspaceFile('content/content.css');

    assert.match(
        contentCss,
        /span\.st-immersive-translation\s*\{[\s\S]*background:\s*transparent;[\s\S]*border-left:\s*2px solid var\(--accent\);[\s\S]*font-size:\s*0\.9em;/,
    );
});

test('086 content CSS keeps immersive loading visible via pseudo-text while preserving shared bounce keyframes', async () => {
    const contentCss = await readWorkspaceFile('content/content.css');

    assert.match(
        contentCss,
        /\.st-immersive-loading::before\s*\{[\s\S]*content:\s*'翻译中\.\.\.';[\s\S]*font-size:\s*0\.85rem;[\s\S]*line-height:\s*1\.6;/,
    );
    assert.match(contentCss, /@keyframes st-loading-breathe\s*\{/);
    assert.doesNotMatch(contentCss, /\.st-immersive-loading span\s*\{/);
    assert.match(contentCss, /@keyframes st-bounce\s*\{/);
});

test('086 runtime keeps inline inject as span and cell-internal inject as div', async () => {
    const { ST } = await loadImmersiveHarness();

    const { container: inlineContainer, parentNode: inlineParent } = createContainer('span', {
        parentDisplay: 'block',
        display: 'inline',
    });
    ST.injectTranslation(inlineContainer, '译文');

    assert.equal(inlineParent.children.length, 1);
    assert.equal(inlineContainer.children.length, 1);
    assert.equal(inlineContainer.children[0].tagName, 'SPAN');
    assert.equal(inlineContainer.children[0].className, 'st-immersive-translation');

    const { container: cellContainer, parentNode: cellParent } = createContainer('td', {
        parentDisplay: 'table-row',
        display: 'table-cell',
    });
    ST.injectTranslation(cellContainer, '单元格译文');

    assert.equal(cellParent.children.length, 1);
    assert.equal(cellContainer.children.length, 1);
    assert.equal(cellContainer.children[0].tagName, 'DIV');
    assert.equal(cellContainer.children[0].className, 'st-immersive-translation');
});

test('086 loading helper DOM structure remains a single empty DIV loader', async () => {
    const { testApi } = await loadImmersiveHarness();
    const container = createNode('p', { text: 'Loading target' });

    testApi.injectLoadingPlaceholder(container);
    testApi.injectLoadingPlaceholder(container);

    const loader = container.querySelector('.st-immersive-loading');
    assert.ok(loader);
    assert.equal(container.querySelectorAll('.st-immersive-loading').length, 1);
    assert.equal(loader.tagName, 'DIV');
    assert.equal(loader.children.length, 0);
    assert.equal(loader.textContent, '');
});
