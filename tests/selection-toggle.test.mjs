import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('selection handlers bail out when enableSelection is disabled', async () => {
    const selection = await readWorkspaceFile('content/modules/selection.js');

    assert.match(
        selection,
        /ST\.handleMouseUp = function \(e\) \{\s*if \(!ST\.state\.settings\?\.enableSelection\) return;\s*if \(e\.detail >= 2\) return;\s*if \(ST\.isPluginElement\(e\.target\)\) return;/,
    );
    assert.match(
        selection,
        /ST\.handleDoubleClick = function \(e\) \{\s*if \(!ST\.state\.settings\?\.enableSelection\) return;\s*if \(e\.target\.matches\('input, textarea, \[contenteditable="true"\]'\)\) \{\s*return;\s*\}\s*ST\.removeIcon\(\);/,
    );
});

test('options showToast removes existing toasts before creating a new one', async () => {
    const options = await readWorkspaceFile('options/options.js');

    assert.match(
        options,
        /function showToast\(message, type = 'success'\) \{\s*document\.querySelectorAll\('\.toast'\)\.forEach\(el => el\.remove\(\)\);\s*const toast = document\.createElement\('div'\);/,
    );
});

test('enableHover legacy default is removed from storage and content defaults', async () => {
    const storage = await readWorkspaceFile('src/core/storage.js');
    const content = await readWorkspaceFile('content/content.js');

    assert.doesNotMatch(storage, /enableHover:\s*false/);
    assert.doesNotMatch(content, /enableHover:\s*false/);
});
