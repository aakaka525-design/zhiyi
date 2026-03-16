import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('110 adds .sr-only to the shared exclude selectors and adds the GitHub folders-and-files table wrapper to metadata exclusions', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(immersive, /const EXCLUDE_SELECTORS = \[/);
    assert.match(immersive, /'\.sr-only'/);
    assert.doesNotMatch(immersive, /screen-reader-heading/);

    assert.match(immersive, /const GITHUB_METADATA_ANCESTORS = \[/);
    assert.match(immersive, /'\[aria-labelledby="folders-and-files"\]'/);
});
