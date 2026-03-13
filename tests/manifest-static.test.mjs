import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('manifest does not expose internal resources through web_accessible_resources', async () => {
    const manifestUrl = new URL('../manifest.json', import.meta.url);
    const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));

    assert.equal(manifest.web_accessible_resources, undefined);
});
