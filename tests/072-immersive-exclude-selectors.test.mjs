import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

function createNode(tagName, { parentNode = null, classes = [] } = {}) {
    return {
        __tagName: tagName.toLowerCase(),
        tagName: tagName.toUpperCase(),
        parentNode,
        matches(selector) {
            return selector.split(',').map((part) => part.trim()).some((part) => {
                if (!part) return false;
                if (part.startsWith('.')) return classes.includes(part.slice(1));
                return part.toLowerCase() === this.__tagName;
            });
        },
        closest(selector) {
            let current = this;
            while (current) {
                if (typeof current.matches === 'function' && current.matches(selector)) {
                    return current;
                }
                current = current.parentNode;
            }
            return null;
        },
    };
}

function createImmersiveElement(tagName, text, {
    ancestors = [],
    display = 'block',
    visibility = 'visible',
    isContentEditable = false,
} = {}) {
    let parentNode = null;
    for (const ancestorTag of ancestors) {
        parentNode = createNode(ancestorTag, { parentNode });
    }

    return {
        ...createNode(tagName, { parentNode }),
        __attached: true,
        __computedStyle: { display, visibility },
        innerText: text,
        isContentEditable,
        nextElementSibling: null,
        children: [],
        appendChild(child) {
            this.children.push(child);
            child.parentNode = this;
        },
        querySelector() {
            return null;
        },
        contains() {
            return false;
        },
    };
}

async function loadImmersiveHarness({ initialElements = [] } = {}) {
    const source = await readWorkspaceFile('content/modules/immersive.js');
    const sentMessages = [];
    let observerCallback = null;

    const document = {
        body: {},
        contains(target) {
            return Boolean(target?.__attached);
        },
        querySelectorAll() {
            return initialElements;
        },
        createElement(tagName) {
            return {
                tagName: tagName.toUpperCase(),
                className: '',
                innerText: '',
                innerHTML: '',
                style: {},
                children: [],
                parentNode: null,
                appendChild(child) {
                    this.children.push(child);
                    child.parentNode = this;
                },
            };
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
        isPluginElement() {
            return false;
        },
        detectLanguage() {
            return 'en';
        },
        async sendMessage(payload) {
            sentMessages.push(payload);
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
    };

    vm.runInNewContext(source, context, { filename: 'immersive.js' });
    context.window.SmartTranslator.injectTranslation = () => {};

    return {
        ST: context.window.SmartTranslator,
        sentMessages,
        getObserverCallback() {
            return observerCallback;
        },
    };
}

function findTranslateTexts(sentMessages) {
    const batchPayload = sentMessages.find((payload) => payload.action === 'translateBatch');
    assert.ok(batchPayload);
    return Array.from(batchPayload.texts);
}

test('immersive initial scan excludes contenteditable content without affecting normal paragraphs', async () => {
    const editableParagraph = createImmersiveElement(
        'p',
        'Editable paragraph that must never be translated.',
        { isContentEditable: true },
    );
    const normalParagraph = createImmersiveElement(
        'p',
        'Normal paragraph that should still be translated after filtering.',
    );

    const { ST, sentMessages } = await loadImmersiveHarness({
        initialElements: [editableParagraph, normalParagraph],
    });

    await ST.toggleImmersive();

    assert.deepEqual(findTranslateTexts(sentMessages), [
        'Normal paragraph that should still be translated after filtering.',
    ]);
});

test('immersive initial scan only relaxes header/footer inside article or section while keeping aside and nav excluded', async () => {
    const siteHeaderTitle = createImmersiveElement('h1', 'Site Title', {
        ancestors: ['header'],
    });
    const articleHeaderTitle = createImmersiveElement('h1', 'Article Title', {
        ancestors: ['article', 'header'],
    });
    const sectionHeaderTitle = createImmersiveElement('h2', 'Section Title', {
        ancestors: ['section', 'header'],
    });
    const siteFooterSource = createImmersiveElement(
        'p',
        'Site footer copyright information that should remain excluded.',
        { ancestors: ['footer'] },
    );
    const articleFooterSource = createImmersiveElement(
        'p',
        'Article footer source information that should now be translated.',
        { ancestors: ['article', 'footer'] },
    );
    const articleAsideNote = createImmersiveElement(
        'p',
        'Article aside note that must stay excluded for now.',
        { ancestors: ['article', 'aside'] },
    );
    const navParagraph = createImmersiveElement(
        'p',
        'Navigation paragraph that must remain excluded.',
        { ancestors: ['nav'] },
    );

    const { ST, sentMessages } = await loadImmersiveHarness({
        initialElements: [
            siteHeaderTitle,
            articleHeaderTitle,
            sectionHeaderTitle,
            siteFooterSource,
            articleFooterSource,
            articleAsideNote,
            navParagraph,
        ],
    });

    await ST.toggleImmersive();

    assert.deepEqual(findTranslateTexts(sentMessages), [
        'Article Title',
        'Section Title',
        'Article footer source information that should now be translated.',
    ]);
});

test('immersive observer path mirrors contenteditable and contextual header/footer exclusions', async () => {
    const editableParagraph = createImmersiveElement(
        'p',
        'Editable observer paragraph that must never be translated.',
        { isContentEditable: true },
    );
    const articleHeaderTitle = createImmersiveElement('h1', 'Late Article Title', {
        ancestors: ['article', 'header'],
    });
    const articleFooterSource = createImmersiveElement(
        'p',
        'Late article footer source that should be translated.',
        { ancestors: ['article', 'footer'] },
    );
    const articleAsideNote = createImmersiveElement(
        'p',
        'Late article aside note that must stay excluded.',
        { ancestors: ['article', 'aside'] },
    );

    const { ST, sentMessages, getObserverCallback } = await loadImmersiveHarness();
    ST.state.isImmersiveEnabled = true;
    ST.state.immersiveRunId = 1;
    ST.startMutationObserver();

    const observerCallback = getObserverCallback();
    assert.equal(typeof observerCallback, 'function');

    await observerCallback([
        {
            type: 'childList',
            addedNodes: [
                {
                    nodeType: 1,
                    matches() {
                        return false;
                    },
                    querySelectorAll() {
                        return [
                            editableParagraph,
                            articleHeaderTitle,
                            articleFooterSource,
                            articleAsideNote,
                        ];
                    },
                },
            ],
        },
    ]);

    assert.deepEqual(findTranslateTexts(sentMessages), [
        'Late Article Title',
        'Late article footer source that should be translated.',
    ]);
});
