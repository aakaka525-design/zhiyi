import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

function createFakeElement() {
    return {
        style: {},
        innerHTML: '',
        textContent: '',
        id: '',
        removed: false,
        queryCache: new Map(),
        querySelector(selector) {
            if (!this.queryCache.has(selector)) {
                this.queryCache.set(selector, createFakeElement());
            }
            return this.queryCache.get(selector);
        },
        remove() {
            this.removed = true;
        },
    };
}

async function loadSelectionHarness({ detectedLang = 'en', targetLang = 'zh' } = {}) {
    const body = {
        children: [],
        appendChild(node) {
            this.children.push(node);
            return node;
        },
    };

    const actions = [];

    const context = {
        window: {
            innerWidth: 1200,
            innerHeight: 800,
            getSelection() {
                return { rangeCount: 0 };
            },
            SmartTranslator: {
                ui: {},
                state: {
                    selection: {
                        rect: null,
                    },
                    settings: {
                        targetLang,
                    },
                },
                detectLanguage() {
                    return detectedLang;
                },
                async sendMessage(payload) {
                    actions.push(payload.action);
                    return { text: 'translated' };
                },
            },
        },
        document: {
            body,
            createElement() {
                return createFakeElement();
            },
        },
        navigator: {
            clipboard: {
                async writeText() {},
            },
        },
        console: { log() {}, error() {}, warn() {} },
        setTimeout,
        clearTimeout,
    };
    context.globalThis = context;
    context.document.defaultView = context.window;

    const source = await readWorkspaceFile('content/modules/selection.js');
    vm.runInNewContext(source, context, { filename: 'selection.js' });

    return {
        ST: context.window.SmartTranslator,
        body,
        getActions() {
            return [...actions];
        },
    };
}

test('090 showBubble checks same-language equality before bubble DOM creation', async () => {
    const selection = await readWorkspaceFile('content/modules/selection.js');

    assert.match(
        selection,
        /ST\.showBubble = async function \(text\) \{\s*const sourceLang = ST\.detectLanguage\(text\);\s*const targetLang = ST\.state\.settings\?\.targetLang \|\| 'zh';\s*if \(sourceLang === targetLang\) return;\s*if \(ST\.ui\.bubble\) ST\.removeBubble\(\);\s*ST\.ui\.bubble = document\.createElement\('div'\);/s,
    );
});

test('090 same-language selections do not create a bubble or send a translate request', async () => {
    const { ST, body, getActions } = await loadSelectionHarness({
        detectedLang: 'zh',
        targetLang: 'zh',
    });

    await ST.showBubble('中文文本');

    assert.equal(ST.ui.bubble ?? null, null);
    assert.equal(body.children.length, 0);
    assert.deepEqual(getActions(), []);
});

test('090 different-language selections still create a bubble and send translate request', async () => {
    const { ST, body, getActions } = await loadSelectionHarness({
        detectedLang: 'en',
        targetLang: 'zh',
    });

    await ST.showBubble('English text');

    assert.notEqual(ST.ui.bubble ?? null, null);
    assert.equal(body.children.length, 1);
    assert.deepEqual(getActions(), ['translate', 'addHistory']);
});
