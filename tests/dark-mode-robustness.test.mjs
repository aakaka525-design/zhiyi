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

async function loadSelectionModule({ selectionRect = null, rangeRect = null, innerWidth = 1200 } = {}) {
    const body = {
        children: [],
        appendChild(node) {
            this.children.push(node);
            return node;
        },
    };

    const selection = {
        rangeCount: rangeRect ? 1 : 0,
        getRangeAt() {
            return {
                getBoundingClientRect() {
                    return rangeRect;
                },
            };
        },
    };

    const context = {
        window: {
            innerWidth,
            getSelection() {
                return selection;
            },
            SmartTranslator: {
                ui: {},
                state: {
                    selection: { rect: selectionRect },
                    settings: { targetLang: 'zh' },
                },
                sendMessage: async () => ({ text: 'translated' }),
                detectLanguage: () => 'en',
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
        cleanup() {},
    };
}

test('popup dark mode wiring reads settings.darkMode and popup surfaces use theme variables', async () => {
    const script = await readWorkspaceFile('popup/popup.js');
    const css = await readWorkspaceFile('popup/popup.css');

    assert.match(script, /settings\.darkMode/);
    assert.match(script, /classList\.add\('dark-mode'\)/);
    assert.match(script, /classList\.remove\('dark-mode'\)/);

    assert.match(
        css,
        /\.input-section:focus-within\s*\{[\s\S]*background:\s*var\(--bg-card-solid\)/,
    );
    assert.match(
        css,
        /\.result-section\s*\{[\s\S]*background:\s*var\(--bg-card-solid\)/,
    );
    assert.match(
        css,
        /\.quick-btn\s*\{[\s\S]*background:\s*var\(--bg-card-solid\)/,
    );
});

test('options dark mode surfaces avoid hardcoded white backgrounds on key panels', async () => {
    const css = await readWorkspaceFile('options/options.css');

    assert.match(
        css,
        /\.nav-item:hover\s*\{[\s\S]*background:\s*var\(--bg-card-solid\)/,
    );
    assert.match(
        css,
        /\.nav-item\.active\s*\{[\s\S]*background:\s*var\(--bg-card-solid\)/,
    );
    assert.match(
        css,
        /\.content-area\s*\{[\s\S]*background:\s*var\(--bg-card-solid\)/,
    );
    assert.match(
        css,
        /\.input\s*\{[\s\S]*background:\s*var\(--bg-input\)/,
    );
    assert.match(
        css,
        /\.history-item\s*\{[\s\S]*background:\s*var\(--bg-card-solid\)/,
    );
});

test('showBubble falls back to the current selection range rect when cached rect is missing', async () => {
    const { ST, cleanup } = await loadSelectionModule({
        selectionRect: null,
        rangeRect: { left: 44, bottom: 88, width: 12, height: 16 },
    });

    try {
        await ST.showBubble('hello');

        assert.equal(ST.ui.bubble.style.top, '98px');
        assert.equal(ST.ui.bubble.style.left, '44px');
        assert.equal(
            ST.ui.bubble.querySelector('.st-bubble-result').textContent,
            'translated',
        );
    } finally {
        cleanup();
    }
});

test('showBubble falls back to a safe viewport position when no valid selection rect exists', async () => {
    const { ST, cleanup } = await loadSelectionModule({
        selectionRect: null,
        rangeRect: null,
        innerWidth: 1000,
    });

    try {
        await ST.showBubble('hello');

        assert.equal(ST.ui.bubble.style.top, '100px');
        assert.equal(ST.ui.bubble.style.left, '350px');
    } finally {
        cleanup();
    }
});

test('popup status indicator is neutral by default and both extension pages use dynamic version placeholders', async () => {
    const popupHtml = await readWorkspaceFile('popup/popup.html');
    const optionsHtml = await readWorkspaceFile('options/options.html');

    assert.doesNotMatch(popupHtml, /<span class="status-dot active"><\/span>/);
    assert.match(popupHtml, /<span class="status-dot"><\/span>/);
    assert.match(popupHtml, /<span class="version" id="app-version"><\/span>/);
    assert.match(optionsHtml, /<span id="app-version"><\/span>/);
    assert.doesNotMatch(optionsHtml, /版本 v1\.0\.0/);
});

test('popup and options scripts populate version text from the manifest and options select arrow avoids hardcoded gray svg stroke', async () => {
    const popupScript = await readWorkspaceFile('popup/popup.js');
    const optionsScript = await readWorkspaceFile('options/options.js');
    const optionsCss = await readWorkspaceFile('options/options.css');

    assert.match(popupScript, /chrome\.runtime\.getManifest\(\)\.version/);
    assert.match(popupScript, /app-version/);
    assert.match(optionsScript, /chrome\.runtime\.getManifest\(\)\.version/);
    assert.match(optionsScript, /app-version/);

    assert.doesNotMatch(optionsCss, /%236A6A6A/);
    assert.match(optionsCss, /linear-gradient\(/);
    assert.match(optionsCss, /var\(--text-secondary\)/);
});
