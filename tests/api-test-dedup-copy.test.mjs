import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('options API connection tests disable buttons while requests are in flight', async () => {
    const options = await readWorkspaceFile('options/options.js');

    assert.match(
        options,
        /btn\.classList\.add\('loading'\);\s*btn\.disabled = true;\s*statusEl\.textContent = '';\s*statusEl\.className = 'test-status';/,
    );
    assert.match(
        options,
        /\} finally \{\s*btn\.classList\.remove\('loading'\);\s*btn\.disabled = false;\s*\}/,
    );
});

test('sidebar copy feedback awaits clipboard success before showing copied state', async () => {
    const sidebar = await readWorkspaceFile('content/modules/sidebar.js');

    assert.match(
        sidebar,
        /copyBtn\.onclick = async \(\) => \{\s*try \{\s*await navigator\.clipboard\.writeText\(resultContent\.innerText\);\s*copyBtn\.innerHTML = '<span style="font-size: 10px; color: var\(--accent\);">已复制<\/span>';/,
    );
    assert.match(
        sidebar,
        /\} catch \(err\) \{\s*console\.error\('复制失败:', err\);\s*\}/,
    );
});
