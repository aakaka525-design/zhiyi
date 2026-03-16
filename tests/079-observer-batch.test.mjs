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

test('initial immersive scan reuses IMMERSIVE_BATCH_SIZE for the cache-miss batch loop, slice, and gap checks', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(immersive, /const \{ cacheHits, cacheMisses \} = splitCachedTranslations\(paragraphs, targetLang\);/);
    assert.match(immersive, /for \(let i = 0; i < cacheMisses\.length; i \+= IMMERSIVE_BATCH_SIZE\) \{/);
    assert.match(immersive, /const batch = cacheMisses\.slice\(i, i \+ IMMERSIVE_BATCH_SIZE\);/);
    assert.match(immersive, /if \(i \+ IMMERSIVE_BATCH_SIZE < cacheMisses\.length\) \{/);
});

test('observer translation path batches cache misses instead of sending the full filtered array at once', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(immersive, /const \{ cacheHits, cacheMisses \} = splitCachedTranslations\(newElements, targetLang\);/);
    assert.match(immersive, /for \(let i = 0; i < cacheMisses\.length; i \+= IMMERSIVE_BATCH_SIZE\) \{/);
    assert.match(immersive, /const batch = cacheMisses\.slice\(i, i \+ IMMERSIVE_BATCH_SIZE\);/);
    assert.match(immersive, /const texts = batch\.map\(el => el\.innerText\.trim\(\)\);/);
    assert.doesNotMatch(immersive, /const texts = newElements\.map\(el => el\.innerText\.trim\(\)\);/);
});

test('observer path manages pendingTranslations per batch and keeps the shared 100ms batch gap', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(immersive, /batch\.forEach\(el => ST\.pendingTranslations\.add\(el\)\);/);
    assert.match(immersive, /finally \{\s*batch\.forEach\(el => removeLoadingPlaceholder\(el\)\);\s*batch\.forEach\(el => ST\.pendingTranslations\.delete\(el\)\);\s*\}/s);
    assert.doesNotMatch(immersive, /newElements\.forEach\(el => ST\.pendingTranslations\.add\(el\)\);/);
    assert.doesNotMatch(immersive, /newElements\.forEach\(el => ST\.pendingTranslations\.delete\(el\)\);/);
    assert.match(immersive, /if \(i \+ IMMERSIVE_BATCH_SIZE < cacheMisses\.length\) \{\s*await new Promise\(resolve => setTimeout\(resolve, 100\)\);\s*\}/s);
});
