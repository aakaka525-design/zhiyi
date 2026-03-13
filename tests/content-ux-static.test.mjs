import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('content stylesheet defines scoped tokens for extension-owned UI containers', async () => {
    const css = await readWorkspaceFile('content/content.css');

    assert.doesNotMatch(css, /:root\s*\{[\s\S]*--accent:/);
    assert.match(
        css,
        /#smart-translator-bubble,\s*[\r\n]+\.st-immersive-wrapper,\s*[\r\n]+#st-sidebar,\s*[\r\n]+#st-sidebar-toggle-btn,\s*[\r\n]+#st-float-window,\s*[\r\n]+#st-page-progress,\s*[\r\n]+#st-floating-ball-container,\s*[\r\n]+(?:\.st-immersive-translation,\s*[\r\n]+\.st-translation-separator,\s*[\r\n]+)?#st-toast\s*\{/,
    );
    assert.match(css, /--accent:\s*#/);
    assert.match(css, /--accent-light:\s*#/);
    assert.match(css, /--accent-glow:\s*rgba\(/);
    assert.match(css, /--bg-secondary:\s*#/);
    assert.match(css, /--bg-tertiary:\s*#/);
    assert.match(css, /--text-primary:\s*#/);
    assert.match(css, /--text-secondary:\s*#/);
    assert.match(css, /--text-tertiary:\s*#/);
    assert.match(css, /--border-color:\s*rgba\(/);
    assert.match(css, /--transition:\s*all /);
    assert.match(css, /--error:\s*#/);
});

test('floating ball menu exposes the float window entry', async () => {
    const source = await readWorkspaceFile('content/modules/floating-ball.js');

    assert.match(source, /id:\s*'btn-float-window'/);
    assert.match(source, /title:\s*'翻译小窗'/);
    assert.match(source, /action:\s*\(\)\s*=>\s*ST\.toggleFloatWindow\s*&&\s*ST\.toggleFloatWindow\(\)/);
});

test('sidebar removes local shortcut listener and labels the shortcut as default', async () => {
    const source = await readWorkspaceFile('content/modules/sidebar.js');

    assert.doesNotMatch(source, /document\.addEventListener\('keydown'/);
    assert.match(source, /默认快捷键:\s*<span/);
});

test('float window removes the local Alt+W shortcut listener', async () => {
    const source = await readWorkspaceFile('content/modules/float-window.js');

    assert.doesNotMatch(source, /document\.addEventListener\('keydown'/);
});
