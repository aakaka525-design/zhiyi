import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

async function loadSelectionModuleContext() {
    const source = await readWorkspaceFile('content/modules/selection.js');
    const sandbox = {
        console,
        window: {
            SmartTranslator: {
                state: { settings: {}, selection: {} },
                ui: {},
            },
            getSelection: () => ({ rangeCount: 0 }),
            innerWidth: 1280,
            innerHeight: 720,
        },
        document: {},
        navigator: {},
        setTimeout,
        clearTimeout,
    };

    vm.createContext(sandbox);
    new vm.Script(source).runInContext(sandbox);
    return sandbox;
}

test('selection bubble placement clamps horizontal overflow inside viewport padding', async () => {
    const { calculateBubblePosition } = await loadSelectionModuleContext();

    assert.equal(typeof calculateBubblePosition, 'function');
    const position = calculateBubblePosition(
        { left: 900, top: 100, bottom: 130 },
        380,
        120,
        1024,
        768,
    );

    assert.equal(position.left, 634);
    assert.equal(position.top, 140);
});

test('selection bubble placement flips above the selection when bottom overflow would occur', async () => {
    const { calculateBubblePosition } = await loadSelectionModuleContext();

    assert.equal(typeof calculateBubblePosition, 'function');
    const position = calculateBubblePosition(
        { left: 120, top: 700, bottom: 730 },
        380,
        120,
        1024,
        768,
    );

    assert.equal(position.left, 120);
    assert.equal(position.top, 570);
});

test('selection showBubble uses measured bubble size for viewport-aware positioning', async () => {
    const source = await readWorkspaceFile('content/modules/selection.js');

    assert.match(source, /document\.body\.appendChild\(ST\.ui\.bubble\);[\s\S]*calculateBubblePosition\(\s*rect,\s*ST\.ui\.bubble\.offsetWidth\s*\|\|\s*380,\s*ST\.ui\.bubble\.offsetHeight\s*\|\|\s*120,/);
});

test('popup stylesheet relies on shared theme spin keyframes instead of redefining them locally', async () => {
    const popupHtml = await readWorkspaceFile('popup/popup.html');
    const popupJs = await readWorkspaceFile('popup/popup.js');
    const popupCss = await readWorkspaceFile('popup/popup.css');

    assert.match(popupHtml, /<link rel="stylesheet" href="\.\.\/options\/theme\.css">/);
    assert.match(popupJs, /style="animation: spin 1s linear infinite"/);
    assert.doesNotMatch(popupCss, /@keyframes spin/);
});

test('content and shared theme stylesheets use higher-contrast tertiary text tokens', async () => {
    const contentCss = await readWorkspaceFile('content/content.css');
    const themeCss = await readWorkspaceFile('options/theme.css');

    assert.match(contentCss, /--text-tertiary:\s*#767676;/);
    assert.match(themeCss, /--text-tertiary:\s*#767676;/);
    assert.match(themeCss, /body\.dark-mode\s*\{[\s\S]*--text-tertiary:\s*#949494;/);
});
