import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('float-window result header uses shared action wrapper and exposes async copy button', async () => {
    const floatWindow = await readWorkspaceFile('content/modules/float-window.js');

    assert.match(
        floatWindow,
        /<div class="st-result-actions">[\s\S]*?id="st-float-speak-result"[\s\S]*?id="st-float-copy-result"[\s\S]*?<\/div>/,
    );
    assert.match(
        floatWindow,
        /const copyResultBtn = ST\.ui\.floatWindow\.querySelector\('#st-float-copy-result'\);/,
    );
    assert.match(
        floatWindow,
        /const originalCopyIcon = copyResultBtn\.innerHTML;\s*copyResultBtn\.onclick = async \(\) => \{\s*try \{\s*await navigator\.clipboard\.writeText\(resultText\.innerText\);[\s\S]*?copyResultBtn\.innerHTML = '<span style="font-size: 10px; color: var\(--accent\);">已复制<\/span>';/,
    );
});

test('content stylesheet hides sidebar and float-window result actions in error state', async () => {
    const css = await readWorkspaceFile('content/content.css');

    assert.match(
        css,
        /\.st-sidebar-result-card\.error-state \.st-result-actions,\s*\.st-float-result\.error-state \.st-result-actions\s*\{\s*display:\s*none;\s*\}/,
    );
});

test('sidebar translation paths clear error-state on success and add it on failure', async () => {
    const sidebar = await readWorkspaceFile('content/modules/sidebar.js');

    assert.match(
        sidebar,
        /if \(response && response\.text\) \{\s*resultCard\.classList\.add\('active'\);\s*resultCard\.classList\.remove\('error-state'\);[\s\S]*?\} else \{\s*resultCard\.classList\.add\('active', 'error-state'\);/,
    );
    assert.match(
        sidebar,
        /catch \(err\) \{\s*resultCard\.classList\.add\('active', 'error-state'\);/,
    );
    assert.match(
        sidebar,
        /historyItem\.onclick = \(\) => \{[\s\S]*?resultCard\.classList\.add\('active'\);\s*resultCard\.classList\.remove\('error-state'\);/,
    );
});

test('float-window translation paths clear error-state on success and add it on failure', async () => {
    const floatWindow = await readWorkspaceFile('content/modules/float-window.js');

    assert.match(
        floatWindow,
        /if \(response && response\.text\) \{\s*resultArea\.classList\.add\('active'\);\s*resultArea\.classList\.remove\('error-state'\);[\s\S]*?\} else \{\s*resultArea\.classList\.add\('active', 'error-state'\);/,
    );
    assert.match(
        floatWindow,
        /catch \(err\) \{\s*resultArea\.classList\.add\('active', 'error-state'\);/,
    );
});
