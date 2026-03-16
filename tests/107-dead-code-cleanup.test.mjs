import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('107 storage defaults no longer carry dead fontSize setting', async () => {
    const source = await readWorkspaceFile('src/core/storage.js');

    assert.doesNotMatch(
        source,
        /const DEFAULT_SETTINGS = \{[\s\S]*fontSize:\s*14,[\s\S]*\};/,
    );
});

test('107 content mergeDefaults no longer backfills dead fontSize setting', async () => {
    const source = await readWorkspaceFile('content/content.js');

    assert.doesNotMatch(
        source,
        /const defaults = \{[\s\S]*fontSize:\s*14,[\s\S]*\};/,
    );
});
