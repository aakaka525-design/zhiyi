import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('109 adds a narrow GitHub metadata exclusion helper and wires it into the three generic filtering paths', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(immersive, /const isGitHub = window\.location\.hostname === 'github\.com';/);
    assert.match(immersive, /const GITHUB_METADATA_ANCESTORS = \[/);
    assert.match(immersive, /'\.react-directory-row'/);
    assert.match(immersive, /'\.js-navigation-item'/);
    assert.match(immersive, /'\[data-testid="repos-file-tree"\]'/);
    assert.match(immersive, /'\.file-info'/);
    assert.match(immersive, /'\.Breadcrumb'/);
    assert.doesNotMatch(immersive, /'\.Box-row'/);
    assert.doesNotMatch(immersive, /'\.commit-tease'/);
    assert.doesNotMatch(immersive, /'\.pagehead-actions'/);
    assert.doesNotMatch(immersive, /'\.branch-name'/);
    assert.doesNotMatch(immersive, /'\.tag-name'/);
    assert.match(
        immersive,
        /function isGitHubMetadataContext\(el\)\s*\{\s*if \(!isGitHub\) return false;[\s\S]*?if \(el\.closest\(sel\)\) return true;[\s\S]*?return false;\s*\}/,
    );

    assert.match(
        immersive,
        /if \(isExcludedByImmersiveContext\(p\)\) return false;\s*if \(containsHardProtectedContent\(p\)\) return false;\s*if \(isGitHubMetadataContext\(p\)\) return false;\s*(?:if \(isLinkedInMetadataContext\(p\)\) return false;\s*)?/,
    );
    assert.match(
        immersive,
        /if \(!isTwitter\) \{\s*if \(isExcludedByImmersiveContext\(el\)\) return false;\s*if \(containsHardProtectedContent\(el\)\) return false;\s*if \(isGitHubMetadataContext\(el\)\) return false;\s*(?:if \(isLinkedInMetadataContext\(el\)\) return false;\s*)?if \(ST\.isPluginElement\(el\)\) return false;\s*\}/,
    );
    assert.match(
        immersive,
        /if \(!isTwitter\) \{\s*if \(isExcludedByImmersiveContext\(el\)\) return false;\s*if \(containsHardProtectedContent\(el\)\) return false;\s*if \(isGitHubMetadataContext\(el\)\) return false;\s*(?:if \(isLinkedInMetadataContext\(el\)\) return false;\s*)?if \(ST\.isPluginElement\(el\)\) return false;\s*\}/,
    );
});
