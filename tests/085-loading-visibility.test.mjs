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

async function loadImmersiveHarness({ roots = [], sendMessageImpl } = {}) {
    const source = await readWorkspaceFile('content/modules/immersive.js');
    const sentMessages = [];

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
            immersiveRunId: 0,
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
            sentMessages.push(payload);
            if (sendMessageImpl) return sendMessageImpl(payload);
            return { results: payload.texts.map((text) => `ZH:${text}`) };
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
window.__immersive085Test = {
  injectLoadingPlaceholder,
  removeLoadingPlaceholder,
};`;

    vm.runInNewContext(instrumented, context, { filename: 'immersive.js' });

    return {
        ST: context.window.SmartTranslator,
        sentMessages,
        testApi: context.window.__immersive085Test,
    };
}

function countLoaders(nodes) {
    return nodes.filter((node) => node.querySelector('.st-immersive-loading')).length;
}

test('085 content loader CSS keeps loading visible without mutating source text semantics', async () => {
    const css = await readWorkspaceFile('content/content.css');

    assert.match(
        css,
        /\.st-immersive-loading\s*\{[\s\S]*display:\s*block;[\s\S]*padding:\s*0 0 0 10px;[\s\S]*margin:\s*2px 0;[\s\S]*border-left:\s*2px solid var\(--accent\);[\s\S]*animation:\s*st-loading-breathe 1\.5s infinite ease-in-out;/,
    );
    assert.match(
        css,
        /\.st-immersive-loading::before\s*\{[\s\S]*content:\s*'翻译中\.\.\.';[\s\S]*font-size:\s*0\.85rem;[\s\S]*line-height:\s*1\.6;/,
    );
    assert.doesNotMatch(css, /\.st-immersive-loading span\s*\{/);
    assert.doesNotMatch(css, /@keyframes st-bar-pulse\s*\{/);
});

test('085 initial scan pre-injects loading for all candidates and then removes it batch by batch', async () => {
    const paragraphs = Array.from({ length: 12 }, (_, index) =>
        createNode('p', { text: `Paragraph ${index + 1} long enough for immersive translation.` }),
    );

    const pendingResolvers = [];
    const { ST } = await loadImmersiveHarness({
        roots: paragraphs,
        sendMessageImpl(payload) {
            return new Promise((resolve) => {
                pendingResolvers.push(() => resolve({ results: payload.texts.map((text) => `ZH:${text}`) }));
            });
        },
    });

    const run = ST.toggleImmersive();
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(countLoaders(paragraphs), paragraphs.length);

    pendingResolvers[0]();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 120));

    const firstBatch = paragraphs.slice(0, 10);
    const remaining = paragraphs.slice(10);
    assert.equal(countLoaders(firstBatch), 0);
    assert.equal(countLoaders(remaining), remaining.length);

    pendingResolvers[1]();
    await run;

    assert.equal(countLoaders(paragraphs), 0);
});

test('085 loading placeholders do not change element innerText and close cleanup still removes them', async () => {
    const paragraph = createNode('p', { text: 'Original paragraph text' });
    const { ST, testApi } = await loadImmersiveHarness({ roots: [paragraph] });

    testApi.injectLoadingPlaceholder(paragraph);
    assert.equal(paragraph.innerText, 'Original paragraph text');

    ST.state.isImmersiveEnabled = true;
    await ST.toggleImmersive();
    assert.equal(paragraph.querySelector('.st-immersive-loading'), null);
});

test('085 source keeps batch-level loading injection while pre-injecting only cache misses', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(
        immersive,
        /ST\.showToast\(`找到 \$\{paragraphs\.length\} 个段落，开始翻译\.\.\.`\);\s*const \{ cacheHits, cacheMisses \} = splitCachedTranslations\(paragraphs, targetLang\);\s*injectCachedTranslations\(cacheHits\);\s*cacheMisses\.forEach\(p => injectLoadingPlaceholder\(p\)\);/s,
    );
    assert.equal((immersive.match(/batch\.forEach\(\w+ => injectLoadingPlaceholder\(\w+\)\);/g) || []).length, 3);
});
