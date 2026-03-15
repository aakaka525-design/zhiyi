import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

async function loadImmersiveHarness() {
    const source = await readWorkspaceFile('content/modules/immersive.js');
    const bodyClasses = [];
    const paragraphs = [
        'This is the first paragraph for translation.',
        'This is the second paragraph for translation.',
        'This is the third paragraph for translation.',
    ].map((text) => ({
        innerText: text,
        children: [],
        className: '',
        classList: {
            add() {},
            remove() {},
            contains() {
                return false;
            },
        },
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
        remove() {},
    }));

    const toasts = [];
    const sendMessageCalls = [];
    const pendingResponses = [];
    let observerStarts = 0;
    let observerStops = 0;

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
        updateProgress() {},
        detectLanguage() {
            return 'en';
        },
        isPluginElement() {
            return false;
        },
        async sendMessage(request) {
            sendMessageCalls.push(request);
            return await new Promise((resolve) => {
                pendingResponses.push(resolve);
            });
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
            body: {
                classList: {
                    add(...classes) {
                        classes.forEach((cls) => {
                            if (!bodyClasses.includes(cls)) bodyClasses.push(cls);
                        });
                    },
                    remove(...classes) {
                        for (const cls of classes) {
                            const index = bodyClasses.indexOf(cls);
                            if (index !== -1) bodyClasses.splice(index, 1);
                        }
                    },
                    contains(cls) {
                        return bodyClasses.includes(cls);
                    },
                },
            },
            querySelectorAll(selector) {
                if (
                    selector.includes('.st-immersive-translation') ||
                    selector.includes('.st-immersive-wrapper') ||
                    selector.includes('.st-translated')
                ) {
                    return [];
                }
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

    context.window.SmartTranslator.injectTranslation = () => {};
    context.window.SmartTranslator.startMutationObserver = () => {
        observerStarts += 1;
    };
    context.window.SmartTranslator.stopMutationObserver = () => {
        observerStops += 1;
    };

    return {
        ST: context.window.SmartTranslator,
        toasts,
        sendMessageCalls,
        pendingResponses,
        get observerStarts() {
            return observerStarts;
        },
        get observerStops() {
            return observerStops;
        },
    };
}

test('immersive stale run skips completion toast and observer restart after cancel then reopen', async () => {
    const harness = await loadImmersiveHarness();

    const run1 = harness.ST.toggleImmersive();
    await Promise.resolve();
    await harness.ST.toggleImmersive();
    const run2 = harness.ST.toggleImmersive();
    await Promise.resolve();

    assert.equal(harness.sendMessageCalls.length, 2);

    harness.pendingResponses[0]({ results: ['译文 A', '译文 B', '译文 C'] });
    await run1;

    assert.equal(harness.observerStarts, 0);
    assert.ok(harness.toasts.includes('已关闭沉浸式翻译'));
    assert.equal(harness.toasts.some((message) => message.startsWith('翻译完成')), false);

    harness.pendingResponses[1]({ results: ['译文 D', '译文 E', '译文 F'] });
    await run2;
});

test('context menu handlers await tab messaging and downgrade failures to console warnings', async () => {
    const menus = await readWorkspaceFile('background/modules/menus.js');

    assert.match(
        menus,
        /case 'translate-selection':\s*if \(info\.selectionText && tab\?\.id\) \{\s*try \{\s*await chrome\.tabs\.sendMessage\(tab\.id, \{\s*action: 'showTranslation',\s*text: info\.selectionText,\s*\}\);\s*\} catch \(err\) \{\s*console\.warn\('右键翻译失败:', err\);\s*\}\s*\}\s*break;/,
    );
    assert.match(
        menus,
        /case 'translate-page':\s*if \(tab\?\.id\) \{\s*try \{\s*await chrome\.tabs\.sendMessage\(tab\.id, \{\s*action: 'toggleImmersive',\s*\}\);\s*\} catch \(err\) \{\s*console\.warn\('右键沉浸翻译失败:', err\);\s*\}\s*\}\s*break;/,
    );
});

test('float-window drag clamps movement to the viewport while keeping the header reachable', async () => {
    const floatWindow = await readWorkspaceFile('content/modules/float-window.js');

    assert.match(
        floatWindow,
        /const handleDragMove = \(e\) => \{\s*if \(!isDragging\) return;\s*const dx = e\.clientX - startX;\s*const dy = e\.clientY - startY;\s*const w = ST\.ui\.floatWindow\.offsetWidth;\s*const minVisible = 50;\s*const newLeft = Math\.max\(minVisible - w, Math\.min\(window\.innerWidth - minVisible, initialX \+ dx\)\);\s*const newTop = Math\.max\(0, Math\.min\(window\.innerHeight - header\.offsetHeight, initialY \+ dy\)\);\s*ST\.ui\.floatWindow\.style\.left = `\$\{newLeft\}px`;\s*ST\.ui\.floatWindow\.style\.top = `\$\{newTop\}px`;\s*ST\.ui\.floatWindow\.style\.right = 'auto';\s*\};/,
    );
});
