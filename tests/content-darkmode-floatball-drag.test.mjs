import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('content script applies scoped dark theme overrides from settings and storage changes', async () => {
    const content = await readWorkspaceFile('content/content.js');
    const css = await readWorkspaceFile('content/content.css');

    assert.match(
        content,
        /function applyContentTheme\(enabled\) \{\s*if \(enabled\) \{\s*document\.documentElement\.setAttribute\('data-st-theme', 'dark'\);\s*\} else \{\s*document\.documentElement\.removeAttribute\('data-st-theme'\);\s*\}\s*\}/,
    );
    assert.match(
        content,
        /async function init\(\) \{\s*await loadSettings\(\);\s*applyContentTheme\(ST\.state\.settings\?\.darkMode\);\s*bindEvents\(\);/,
    );
    assert.match(
        content,
        /if \(areaName === 'local' && changes\.settings\) \{\s*ST\.state\.settings = mergeDefaults\(changes\.settings\.newValue\);\s*applyContentTheme\(ST\.state\.settings\?\.darkMode\);[\s\S]*syncShowOriginalMode\(\);/,
    );

    assert.match(
        css,
        /:root\[data-st-theme="dark"\] #smart-translator-bubble,\s*[\r\n]+:root\[data-st-theme="dark"\] \.st-immersive-wrapper,\s*[\r\n]+:root\[data-st-theme="dark"\] #st-sidebar,\s*[\r\n]+:root\[data-st-theme="dark"\] #st-sidebar-toggle-btn,\s*[\r\n]+:root\[data-st-theme="dark"\] #st-float-window,\s*[\r\n]+:root\[data-st-theme="dark"\] #st-page-progress,\s*[\r\n]+:root\[data-st-theme="dark"\] #st-floating-ball-container,\s*[\r\n]+:root\[data-st-theme="dark"\] #smart-translator-icon,\s*[\r\n]+:root\[data-st-theme="dark"\] \.st-immersive-translation,\s*[\r\n]+:root\[data-st-theme="dark"\] \.st-translation-separator,\s*[\r\n]+:root\[data-st-theme="dark"\] #st-toast,\s*[\r\n]+:root\[data-st-theme="dark"\] #st-original-bubble\s*\{/,
    );
    assert.match(css, /--surface:\s*rgba\(30,\s*34,\s*43,\s*0\.95\);/);
    assert.match(css, /--text-primary:\s*#E8E8E8;/);
    assert.match(css, /--border-color:\s*rgba\(255,\s*255,\s*255,\s*0\.08\);/);
});

test('floating ball drag follows the original grab offset instead of snapping to center', async () => {
    const floatingBall = await readWorkspaceFile('content/modules/floating-ball.js');

    assert.match(
        floatingBall,
        /const rect = handle\.getBoundingClientRect\(\);[\s\S]*dragOffset = \{\s*x: e\.clientX - rect\.left,?\s*y: e\.clientY - rect\.top,?\s*\};/,
    );
    assert.match(
        floatingBall,
        /let newLeft = clientX - dragOffset\.x;\s*let newTop = clientY - dragOffset\.y;/,
    );
    assert.doesNotMatch(
        floatingBall,
        /let newLeft = clientX - 20;\s*\/\/ Center approximation\s*let newTop = clientY - 20;/,
    );
});
