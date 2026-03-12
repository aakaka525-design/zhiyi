import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readOptionsScript() {
    return readFile(new URL('../options/options.js', import.meta.url), 'utf8');
}

test('options script wires shortcut guidance through clipboard copy', async () => {
    const source = await readOptionsScript();

    assert.match(source, /shortcutSettingsBtn/);
    assert.match(source, /navigator\.clipboard\.writeText/);
    assert.match(source, /SHORTCUT_SETTINGS_URL/);
});

test('options script includes beforeunload protection for dirty settings', async () => {
    const source = await readOptionsScript();

    assert.match(source, /beforeunload/);
    assert.match(source, /preventDefault\(\)/);
    assert.match(source, /returnValue = ''/);
});
