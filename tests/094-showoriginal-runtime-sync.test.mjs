import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('content script syncs showOriginal replace-mode class from storage changes', async () => {
    const content = await readWorkspaceFile('content/content.js');

    assert.match(
        content,
        /function syncShowOriginalMode\(\) \{\s*if \(!ST\.state\.isImmersiveEnabled\) return;\s*if \(ST\.state\.settings\?\.showOriginal === false\) \{\s*document\.body\.classList\.add\('st-replace-mode'\);\s*\} else \{\s*document\.body\.classList\.remove\('st-replace-mode'\);\s*\}\s*\}/,
    );

    assert.match(
        content,
        /if \(areaName === 'local' && changes\.settings\) \{\s*ST\.state\.settings = mergeDefaults\(changes\.settings\.newValue\);\s*applyContentTheme\(ST\.state\.settings\?\.darkMode\);[\s\S]*ST\.syncLanguageSelects\?\.\(\);\s*syncShowOriginalMode\(\);\s*console\.log\('\[智译\] 设置已自动更新'\);/,
    );
});

test('showOriginal runtime sync only operates while immersive mode is active', async () => {
    const content = await readWorkspaceFile('content/content.js');

    assert.match(content, /if \(!ST\.state\.isImmersiveEnabled\) return;/);
    assert.doesNotMatch(
        content,
        /chrome\.storage\.onChanged\.addListener\([\s\S]*document\.body\.classList\.(add|remove)\('st-replace-mode'\);[\s\S]*if \(!ST\.state\.isImmersiveEnabled\) return;[\s\S]*\}\);/,
    );
});
