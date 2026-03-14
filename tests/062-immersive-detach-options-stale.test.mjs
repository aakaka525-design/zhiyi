import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('injectTranslation bails out immediately when the target container is detached from document', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(
        immersive,
        /ST\.injectTranslation = function \(container, translation\) \{\s*if \(!document\.contains\(container\)\) return;\s*const nextSibling = container\.nextElementSibling;/,
    );
});

test('options saveSettings sends only changed fields through patchSettings', async () => {
    const options = await readWorkspaceFile('options/options.js');

    assert.match(
        options,
        /async function saveSettings\(\) \{\s*const current = collectCurrentSettings\(\);\s*const diff = \{\};\s*for \(const key of Object\.keys\(current\)\) \{\s*if \(current\[key\] !== initialSettingsSnapshot\[key\]\) \{\s*diff\[key\] = current\[key\];\s*\}\s*\}\s*if \(Object\.keys\(diff\)\.length === 0\) \{\s*setDirtyState\(false\);\s*return;\s*\}\s*try \{\s*const response = await chrome\.runtime\.sendMessage\(\{ action: 'patchSettings', updates: diff \}\);/s,
    );
    assert.doesNotMatch(
        options,
        /async function saveSettings\(\)[\s\S]*chrome\.runtime\.sendMessage\(\{ action: 'patchSettings', updates: settings \}\)/s,
    );
});

test('options saveSettings merges diff into the snapshot baseline after a successful save', async () => {
    const options = await readWorkspaceFile('options/options.js');

    assert.match(
        options,
        /initialSettingsSnapshot = buildSettingsSnapshot\(\{ \.\.\.initialSettingsSnapshot, \.\.\.diff \}\);/,
    );
    assert.doesNotMatch(
        options,
        /async function saveSettings\(\)[\s\S]*initialSettingsSnapshot = settings;/s,
    );
    assert.doesNotMatch(
        options,
        /async function saveSettings\(\)[\s\S]*initialSettingsSnapshot = current;/s,
    );
});
