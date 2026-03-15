import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('immersive module defines a shared IMMERSIVE_BATCH_SIZE constant and removes the old local batchSize variable', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(immersive, /const IMMERSIVE_BATCH_SIZE = 10;/);
    assert.doesNotMatch(immersive, /const batchSize = 10;/);
});

test('initial immersive scan reuses IMMERSIVE_BATCH_SIZE in the loop, slice, and batch gap checks', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(immersive, /for \(let i = 0; i < paragraphs\.length; i \+= IMMERSIVE_BATCH_SIZE\) \{/);
    assert.match(immersive, /const batch = paragraphs\.slice\(i, i \+ IMMERSIVE_BATCH_SIZE\);/);
    assert.match(immersive, /if \(i \+ IMMERSIVE_BATCH_SIZE < paragraphs\.length\) \{/);
});

test('observer translation path batches new elements instead of sending the full array at once', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(immersive, /for \(let i = 0; i < newElements\.length; i \+= IMMERSIVE_BATCH_SIZE\) \{/);
    assert.match(immersive, /const batch = newElements\.slice\(i, i \+ IMMERSIVE_BATCH_SIZE\);/);
    assert.match(immersive, /const texts = batch\.map\(el => el\.innerText\.trim\(\)\);/);
    assert.doesNotMatch(immersive, /const texts = newElements\.map\(el => el\.innerText\.trim\(\)\);/);
});

test('observer path manages pendingTranslations per batch and keeps the shared 100ms batch gap', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(immersive, /batch\.forEach\(el => ST\.pendingTranslations\.add\(el\)\);/);
    assert.match(immersive, /finally \{\s*batch\.forEach\(el => removeLoadingPlaceholder\(el\)\);\s*batch\.forEach\(el => ST\.pendingTranslations\.delete\(el\)\);\s*\}/s);
    assert.doesNotMatch(immersive, /newElements\.forEach\(el => ST\.pendingTranslations\.add\(el\)\);/);
    assert.doesNotMatch(immersive, /newElements\.forEach\(el => ST\.pendingTranslations\.delete\(el\)\);/);
    assert.match(immersive, /if \(i \+ IMMERSIVE_BATCH_SIZE < newElements\.length\) \{\s*await new Promise\(resolve => setTimeout\(resolve, 100\)\);\s*\}/s);
});
