import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('float-window Enter shortcut ignores IME composition state', async () => {
    const floatWindow = await readWorkspaceFile('content/modules/float-window.js');

    assert.match(
        floatWindow,
        /input\.addEventListener\('keydown', \(e\) => \{\s*if \(e\.key === 'Enter' && !e\.shiftKey && !e\.isComposing\) \{\s*e\.preventDefault\(\);\s*translateBtn\.click\(\);\s*\}\s*\}\);/,
    );
});

test('sidebar swap reuses the visible successful result for reverse translation', async () => {
    const sidebar = await readWorkspaceFile('content/modules/sidebar.js');

    assert.match(
        sidebar,
        /swapBtn\.onclick = \(\) => \{\s*const s = sourceLangSelect\.value;\s*const t = targetLangSelect\.value;\s*if \(s !== 'auto'\) \{\s*sourceLangSelect\.value = t;\s*targetLangSelect\.value = s;\s*if \(resultCard\.classList\.contains\('active'\) && !resultContent\.style\.color\) \{\s*input\.value = resultContent\.innerText;\s*\}\s*\}\s*\};/,
    );
});

test('popup paste clears stale translation result state after inserting clipboard text', async () => {
    const popup = await readWorkspaceFile('popup/popup.js');

    assert.match(
        popup,
        /elements\.btnPaste\.addEventListener\('click', async \(\) => \{\s*try \{\s*const text = await navigator\.clipboard\.readText\(\);\s*elements\.sourceText\.value = text;\s*updateCharCount\(\);\s*clearResult\(\);\s*\} catch \(err\) \{\s*console\.error\('粘贴失败:', err\);\s*\}\s*\}\);/,
    );
});
