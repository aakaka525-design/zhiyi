import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('113 adds a narrowed LinkedIn metadata helper and wires it into all three generic filtering paths', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(
        immersive,
        /const isLinkedIn = window\.location\.hostname === 'linkedin\.com' \|\|\s*window\.location\.hostname === 'www\.linkedin\.com' \|\|\s*window\.location\.hostname\.endsWith\('\.linkedin\.com'\);/s,
    );
    assert.match(immersive, /const LINKEDIN_METADATA_ANCESTORS = \[\s*'\[data-job-id\]',\s*\];/s);
    assert.match(immersive, /function isLinkedInMetadataContext\(el\) \{\s*if \(!isLinkedIn\) return false;[\s\S]*el\.closest\(sel\)/);

    const linkedInChecks = immersive.match(/if \(isLinkedInMetadataContext\((p|el)\)\) return false;/g) || [];
    assert.equal(linkedInChecks.length, 3);
});
