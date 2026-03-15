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
        if (part === '[data-testid="tweetText"]') {
            return node.dataset?.testid === 'tweetText';
        }
        if (part === '[id^="message-content-"]') {
            return typeof node.id === 'string' && node.id.startsWith('message-content-');
        }
        if (part.startsWith('.')) {
            return node.__classes.includes(part.slice(1));
        }
        return part.toLowerCase() === node.__tagName;
    });
}

function createNode(tagName, {
    id = '',
    text = '',
    classes = [],
    dataset = {},
    children = [],
    display = 'block',
    visibility = 'visible',
    isContentEditable = false,
} = {}) {
    let ownText = text;

    const node = {
        __tagName: tagName.toLowerCase(),
        __classes: [...classes],
        tagName: tagName.toUpperCase(),
        nodeType: 1,
        id,
        dataset,
        isContentEditable,
        __attached: true,
        __computedStyle: { display, visibility },
        parentNode: null,
        children: [],
        classList: {
            contains(cls) {
                return node.__classes.includes(cls);
            },
            add(cls) {
                if (!node.__classes.includes(cls)) node.__classes.push(cls);
            },
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
                dataset: { ...dataset },
                display,
                visibility,
                isContentEditable,
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

async function loadImmersiveHarness({ roots = [], hostname = 'example.com', sendMessageImpl } = {}) {
    const source = await readWorkspaceFile('content/modules/immersive.js');
    const sentMessages = [];
    let observerCallback = null;
    const listeners = new Map();

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
        isPluginElement() {
            return false;
        },
        detectLanguage() {
            return 'en';
        },
        async sendMessage(payload) {
            sentMessages.push(payload);
            if (sendMessageImpl) {
                return sendMessageImpl(payload);
            }
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
            location: { hostname },
            getComputedStyle(target) {
                return target?.__computedStyle || { display: 'block', visibility: 'visible' };
            },
            addEventListener(type, handler) {
                listeners.set(type, handler);
            },
            removeEventListener(type, handler) {
                if (listeners.get(type) === handler) listeners.delete(type);
            },
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
window.__immersive083Test = {
  hashText,
  translatedSources,
  hasOwnTranslationArtifacts,
  getOwnCleanSourceText,
  removeOwnTranslationArtifacts,
  rescanUntranslatedElements,
  filterContainedImmersiveElements,
};`;

    vm.runInNewContext(instrumented, context, { filename: 'immersive.js' });

    return {
        ST: context.window.SmartTranslator,
        testApi: context.window.__immersive083Test,
        sentMessages,
        getListener(type) {
            return listeners.get(type);
        },
        getObserverCallback() {
            return observerCallback;
        },
    };
}

function getTranslateTexts(sentMessages) {
    return sentMessages
        .filter((payload) => payload.action === 'translateBatch')
        .flatMap((payload) => Array.from(payload.texts));
}

test('083 defines shared selector constants and the rescan structure', async () => {
    const source = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(source, /const GENERIC_SELECTORS = 'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption';/);
    assert.match(source, /const DISCORD_GENERIC_SELECTORS = 'p, h1, h2, h3, h4, h5, h6, td, th, blockquote, figcaption, dt, dd, caption';/);
    assert.match(source, /const INITIAL_SCAN_EXTRA_SELECTORS = '\.markdown-body p, \.markdown-body li, \.comment-body p, \.js-comment-body p';/);
    assert.match(source, /let rescanInFlight = false;/);
    assert.match(source, /ST\.observers\.scrollHandler = handleImmersiveScroll;/);
    assert.match(source, /translatedSources\.set\((p|el), hashText\(sourceText\)\)/);
});

test('hashText is deterministic and getOwnCleanSourceText strips only direct translation children', async () => {
    const directTranslation = createNode('span', {
        text: 'ZH:direct',
        classes: ['st-immersive-translation'],
    });
    const nestedTranslation = createNode('span', {
        text: 'ZH:nested',
        classes: ['st-immersive-translation'],
    });
    const nestedWrapper = createNode('em', {
        text: 'child',
        children: [nestedTranslation],
    });
    const paragraph = createNode('p', {
        text: 'Original',
        children: [directTranslation, nestedWrapper],
    });

    const { testApi } = await loadImmersiveHarness();

    assert.equal(testApi.hashText('abc'), testApi.hashText('abc'));
    assert.notEqual(testApi.hashText('abc'), testApi.hashText('abcd'));
    assert.equal(testApi.getOwnCleanSourceText(paragraph), 'OriginalchildZH:nested');
});

test('removeOwnTranslationArtifacts removes only direct translation children and wrapper siblings', async () => {
    const directTranslation = createNode('span', {
        text: 'ZH:direct',
        classes: ['st-immersive-translation'],
    });
    const nestedTranslation = createNode('span', {
        text: 'ZH:nested',
        classes: ['st-immersive-translation'],
    });
    const nestedChild = createNode('span', {
        text: 'child',
        children: [nestedTranslation],
    });
    const paragraph = createNode('p', {
        text: 'Original',
        children: [directTranslation, nestedChild],
    });
    const wrapper = createNode('div', {
        classes: ['st-immersive-wrapper'],
        children: [createNode('div', { text: 'ZH:block', classes: ['st-immersive-translation'] })],
    });
    const parent = createNode('section', {
        children: [paragraph, wrapper],
    });

    const { testApi } = await loadImmersiveHarness({ roots: [parent] });
    testApi.removeOwnTranslationArtifacts(paragraph);

    assert.equal(paragraph.querySelector('.st-immersive-translation'), nestedTranslation);
    assert.equal(paragraph.children.includes(directTranslation), false);
    assert.equal(wrapper.__attached, false);
});

test('rescan skips a parent that only contains descendant translations from a child', async () => {
    const translatedSpan = createNode('span', {
        text: 'ZH:child',
        classes: ['st-immersive-translation'],
    });
    const childParagraph = createNode('p', {
        text: 'Child',
        children: [translatedSpan],
    });
    const blockquote = createNode('blockquote', {
        text: 'Parent text',
        children: [childParagraph],
    });

    const { testApi, sentMessages } = await loadImmersiveHarness({
        roots: [blockquote],
    });

    assert.equal(testApi.hasOwnTranslationArtifacts(blockquote), false);
    testApi.translatedSources?.set?.(childParagraph, testApi.hashText('Child'));

    await testApi.rescanUntranslatedElements(1, 'zh', false, false, false);

    assert.deepEqual(getTranslateTexts(sentMessages), []);
});

test('rescan removes stale block wrappers and re-translates updated source text', async () => {
    const paragraph = createNode('p', { text: 'Original text' });
    const wrapper = createNode('div', {
        classes: ['st-immersive-wrapper'],
        children: [createNode('div', { text: 'ZH:old', classes: ['st-immersive-translation'] })],
    });
    const parent = createNode('section', {
        children: [paragraph, wrapper],
    });

    const { testApi, sentMessages } = await loadImmersiveHarness({
        roots: [parent],
    });

    testApi.translatedSources?.set?.(paragraph, testApi.hashText('Original text'));
    paragraph.innerText = 'New text';

    await testApi.rescanUntranslatedElements(1, 'zh', false, false, false);

    assert.equal(wrapper.__attached, false);
    assert.deepEqual(getTranslateTexts(sentMessages), ['New text']);
});

test('scroll rescan handler prevents async re-entry while a previous rescan is in flight', async () => {
    const paragraph = createNode('p', { text: 'Scroll text that should translate once.' });
    let releaseSendMessage;
    const sendMessagePromise = new Promise((resolve) => {
        releaseSendMessage = () => resolve({ results: ['ZH:Scroll text that should translate once.'] });
    });

    const { ST, sentMessages, getListener } = await loadImmersiveHarness({
        roots: [paragraph],
        sendMessageImpl(payload) {
            if (payload.action === 'translateBatch') {
                return sendMessagePromise;
            }
            return {};
        },
    });

    ST.startMutationObserver();
    const scrollHandler = getListener('scroll');
    assert.equal(typeof scrollHandler, 'function');

    scrollHandler();
    scrollHandler();

    assert.equal(sentMessages.filter((payload) => payload.action === 'translateBatch').length, 1);

    releaseSendMessage();
    await Promise.resolve();
    await Promise.resolve();
});
