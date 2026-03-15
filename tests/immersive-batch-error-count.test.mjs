import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function loadImmersiveHarness(results) {
    const source = await readFile(new URL('../content/modules/immersive.js', import.meta.url), 'utf8');
    const paragraphs = [
        'This is the first paragraph for translation.',
        'This is the second paragraph for translation.',
        'This is the third paragraph for translation.',
    ].map((text) => ({
        innerText: text,
        children: [],
        className: '',
        nextElementSibling: null,
        parentNode: null,
        appendChild(child) {
            child.parentNode = this;
            this.children.push(child);
        },
        querySelector(selector) {
            if (!selector.startsWith('.')) return null;
            return this.children.find((child) => child.className === selector.slice(1)) || null;
        },
        closest() {
            return null;
        },
        matches() {
            return false;
        },
        querySelector() {
            return null;
        },
        contains() {
            return false;
        },
    }));
    const toasts = [];
    const progressUpdates = [];
    const injections = [];
    let startedObserver = false;

    const ST = {
        state: {
            isImmersiveEnabled: false,
            settings: { targetLang: 'zh' },
        },
        observers: {},
        showToast(message) {
            toasts.push(message);
        },
        showProgress() {},
        hideProgress() {},
        updateProgress(value) {
            progressUpdates.push(value);
        },
        detectLanguage() {
            return 'en';
        },
        isPluginElement() {
            return false;
        },
        async sendMessage() {
            return { results };
        },
    };

    const context = {
        window: {
            SmartTranslator: ST,
            location: { hostname: 'example.com' },
            getComputedStyle() {
                return { display: 'block', visibility: 'visible' };
            },
        },
        document: {
            querySelectorAll() {
                return paragraphs;
            },
            createElement() {
                return {
                    className: '',
                    innerHTML: '',
                    parentNode: null,
                    remove() {
                        if (this.parentNode?.children) {
                            this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
                        }
                    },
                };
            },
        },
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

    context.window.SmartTranslator.injectTranslation = (_paragraph, translation) => {
        injections.push(translation);
    };
    context.window.SmartTranslator.startMutationObserver = () => {
        startedObserver = true;
    };
    context.window.SmartTranslator.stopMutationObserver = () => {};

    return {
        ST: context.window.SmartTranslator,
        toasts,
        progressUpdates,
        injections,
        get startedObserver() {
            return startedObserver;
        },
    };
}

test('immersive batch treats all-success results as zero failures', async () => {
    const harness = await loadImmersiveHarness(['译文 A', '译文 B', '译文 C']);

    await harness.ST.toggleImmersive();

    assert.deepEqual(harness.injections, ['译文 A', '译文 B', '译文 C']);
    assert.equal(harness.toasts.at(-1), '翻译完成！共 3 个段落');
    assert.equal(harness.progressUpdates.at(-1), 100);
    assert.equal(harness.startedObserver, true);
});

test('immersive batch counts partial falsy results as failures', async () => {
    const harness = await loadImmersiveHarness(['译文 A', '', '译文 C']);

    await harness.ST.toggleImmersive();

    assert.deepEqual(harness.injections, ['译文 A', '译文 C']);
    assert.equal(harness.toasts.at(-1), '翻译完成，1 个段落失败');
    assert.equal(harness.progressUpdates.at(-1), 100);
});

test('immersive batch counts all falsy results as failures', async () => {
    const harness = await loadImmersiveHarness(['', '', '']);

    await harness.ST.toggleImmersive();

    assert.deepEqual(harness.injections, []);
    assert.equal(harness.toasts.at(-1), '翻译完成，3 个段落失败');
    assert.equal(harness.progressUpdates.at(-1), 100);
});

test('immersive batch counts missing result slots as failures', async () => {
    const harness = await loadImmersiveHarness(['译文 A']);

    await harness.ST.toggleImmersive();

    assert.deepEqual(harness.injections, ['译文 A']);
    assert.equal(harness.toasts.at(-1), '翻译完成，2 个段落失败');
    assert.equal(harness.progressUpdates.at(-1), 100);
});
