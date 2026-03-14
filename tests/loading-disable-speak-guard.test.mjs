import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('popup setLoading disables and restores clear paste and swap controls', async () => {
    const popup = await readWorkspaceFile('popup/popup.js');

    assert.match(
        popup,
        /elements\.targetLang\.disabled = true;\s*elements\.btnClear\.disabled = true;\s*elements\.btnPaste\.disabled = true;\s*elements\.btnSwap\.disabled = true;\s*elements\.btnTranslate\.innerHTML = `/,
    );
    assert.match(
        popup,
        /elements\.targetLang\.disabled = false;\s*elements\.btnClear\.disabled = false;\s*elements\.btnPaste\.disabled = false;\s*elements\.btnSwap\.disabled = false;\s*elements\.btnTranslate\.innerHTML = `/,
    );
});

test('popup speak button guards against re-entry and restores disabled state in finally', async () => {
    const popup = await readWorkspaceFile('popup/popup.js');

    assert.match(
        popup,
        /elements\.btnSpeak\.addEventListener\('click', async \(\) => \{\s*if \(!currentResult \|\| elements\.btnSpeak\.disabled\) return;\s*elements\.btnSpeak\.disabled = true;\s*try \{\s*await speak\(currentResult, elements\.targetLang\.value\);[\s\S]*?finally \{\s*elements\.btnSpeak\.disabled = false;\s*\}\s*\}\);/,
    );
});

test('sidebar translate flow disables the full input control group during in-flight translation', async () => {
    const sidebar = await readWorkspaceFile('content/modules/sidebar.js');

    assert.match(
        sidebar,
        /translateBtn\.innerText = '翻译中\.\.\.';\s*translateBtn\.disabled = true;\s*input\.disabled = true;\s*sourceLangSelect\.disabled = true;\s*targetLangSelect\.disabled = true;\s*clearBtn\.disabled = true;\s*swapBtn\.disabled = true;/,
    );
    assert.match(
        sidebar,
        /translateBtn\.innerText = '翻译';\s*translateBtn\.disabled = false;\s*input\.disabled = false;\s*sourceLangSelect\.disabled = false;\s*targetLangSelect\.disabled = false;\s*clearBtn\.disabled = false;\s*swapBtn\.disabled = false;/,
    );
});

test('sidebar speak buttons route through a runSpeak guard helper', async () => {
    const sidebar = await readWorkspaceFile('content/modules/sidebar.js');

    assert.match(
        sidebar,
        /const runSpeak = async \(btn, fn\) => \{\s*if \(btn\.disabled\) return;\s*btn\.disabled = true;\s*try \{\s*await fn\(\);[\s\S]*?finally \{\s*btn\.disabled = false;\s*\}\s*\};/,
    );
    assert.match(
        sidebar,
        /speakSourceBtn\.onclick = \(\) => runSpeak\(speakSourceBtn, \(\) => speak\(input\.value, sourceLangSelect\.value\)\);/,
    );
    assert.match(
        sidebar,
        /speakResultBtn\.onclick = \(\) => runSpeak\(speakResultBtn, \(\) => speak\(resultContent\.innerText, targetLangSelect\.value\)\);/,
    );
});

test('float window translate flow and speak buttons use the same disable-and-guard model', async () => {
    const floatWindow = await readWorkspaceFile('content/modules/float-window.js');

    assert.match(
        floatWindow,
        /translateBtn\.innerText = '\.\.\.';\s*translateBtn\.disabled = true;\s*input\.disabled = true;\s*targetLangSelect\.disabled = true;\s*clearBtn\.disabled = true;/,
    );
    assert.match(
        floatWindow,
        /translateBtn\.innerText = '快译';\s*translateBtn\.disabled = false;\s*input\.disabled = false;\s*targetLangSelect\.disabled = false;\s*clearBtn\.disabled = false;/,
    );
    assert.match(
        floatWindow,
        /const runSpeak = async \(btn, fn\) => \{\s*if \(btn\.disabled\) return;\s*btn\.disabled = true;\s*try \{\s*await fn\(\);[\s\S]*?finally \{\s*btn\.disabled = false;\s*\}\s*\};/,
    );
    assert.match(
        floatWindow,
        /speakSourceBtn\.onclick = \(\) => runSpeak\(speakSourceBtn, \(\) => speak\(input\.value, 'auto'\)\);/,
    );
    assert.match(
        floatWindow,
        /speakResultBtn\.onclick = \(\) => runSpeak\(speakResultBtn, \(\) => speak\(resultText\.innerText, targetLangSelect\.value\)\);/,
    );
});
