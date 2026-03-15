import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('selection ignores immersive translation nodes without broadening shared isPluginElement semantics', async () => {
    const selection = await readWorkspaceFile('content/modules/selection.js');
    const utils = await readWorkspaceFile('content/modules/utils.js');

    assert.match(
        selection,
        /function isImmersiveElement\(el\) \{\s*return el\.closest\('\.st-immersive-wrapper'\) \|\|\s*el\.classList\?\.contains\('st-immersive-translation'\) \|\|\s*el\.classList\?\.contains\('st-translation-separator'\);\s*\}/,
    );
    assert.match(
        selection,
        /ST\.handleMouseUp = function \(e\) \{\s*if \(!ST\.state\.settings\?\.enableSelection\) return;\s*if \(e\.detail >= 2\) return;\s*if \(ST\.isPluginElement\(e\.target\)\) return;\s*if \(isImmersiveElement\(e\.target\)\) return;/,
    );
    assert.match(
        selection,
        /if \(ST\.isPluginElement\(e\.target\)\) \{\s*return;\s*\}\s*if \(isImmersiveElement\(e\.target\)\) return;/,
    );
    assert.doesNotMatch(utils, /st-immersive-wrapper|st-immersive-translation|st-translation-separator/);
});

test('options immediate toggles save only their own fields and preserve unrelated dirty state', async () => {
    const options = await readWorkspaceFile('options/options.js');

    assert.match(
        options,
        /async function saveImmediateToggle\(partialSettings\) \{\s*try \{\s*await chrome\.runtime\.sendMessage\(\{ action: 'patchSettings', updates: partialSettings \}\);\s*initialSettingsSnapshot = buildSettingsSnapshot\(\{ \.\.\.initialSettingsSnapshot, \.\.\.partialSettings \}\);\s*refreshDirtyState\(\);\s*showToast\('已自动保存'\);\s*\} catch \(err\) \{\s*console\.error\('\[智译\] 保存开关设置失败:', err\);\s*showToast\('自动保存失败: ' \+ err\.message, 'error'\);\s*\}\s*\}/,
    );
    assert.match(
        options,
        /elements\.enableDarkMode\.addEventListener\('change', \(e\) => \{\s*applyDarkMode\(e\.target\.checked\);\s*saveImmediateToggle\(\{ darkMode: e\.target\.checked \}\);\s*\}\);/,
    );
    assert.match(
        options,
        /elements\.enableDebugMode\.addEventListener\('change', async \(e\) => \{\s*await saveImmediateToggle\(\{ debugMode: e\.target\.checked \}\);\s*console\.log\('\[智译\] 调试模式:', e\.target\.checked \? '已开启' : '已关闭'\);\s*\}\);/,
    );
    assert.doesNotMatch(
        options,
        /elements\.enableDarkMode\.addEventListener\('change', \(e\) => \{\s*applyDarkMode\(e\.target\.checked\);\s*saveSettings\(\);/,
    );
    assert.doesNotMatch(
        options,
        /elements\.enableDebugMode\.addEventListener\('change', async \(e\) => \{\s*await saveSettings\(\);/,
    );
});
