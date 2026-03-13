import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('sidebar and float-window surface wrapped translate errors in their result areas', async () => {
    const sidebar = await readWorkspaceFile('content/modules/sidebar.js');
    const floatWindow = await readWorkspaceFile('content/modules/float-window.js');

    assert.match(
        sidebar,
        /if \(response && response\.text\) \{[\s\S]*?\} else \{\s*resultCard\.classList\.add\('active'\);\s*resultContent\.textContent = `翻译失败: \$\{response\?\.error \|\| '未知错误'\}`;\s*resultContent\.style\.color = 'var\(--error\)';\s*\}/,
    );
    assert.match(
        floatWindow,
        /if \(response && response\.text\) \{[\s\S]*?\} else \{\s*resultArea\.classList\.add\('active'\);\s*resultText\.textContent = `翻译失败: \$\{response\?\.error \|\| '未知错误'\}`;\s*resultText\.style\.color = 'var\(--error\)';\s*\}/,
    );
});

test('sidebar copy button captures its original icon once outside the click handler', async () => {
    const sidebar = await readWorkspaceFile('content/modules/sidebar.js');

    assert.match(
        sidebar,
        /const originalIcon = copyBtn\.innerHTML;\s*copyBtn\.onclick = \(\) => \{/,
    );
    assert.doesNotMatch(
        sidebar,
        /copyBtn\.onclick = \(\) => \{\s*navigator\.clipboard\.writeText\(resultContent\.innerText\);\s*const originalIcon = copyBtn\.innerHTML;/,
    );
});

test('content script no longer exposes an unused refreshSettings message handler', async () => {
    const content = await readWorkspaceFile('content/content.js');

    assert.doesNotMatch(content, /case 'refreshSettings':/);
});
