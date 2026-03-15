import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('093 saveImmediateToggle shows success and error toast feedback', async () => {
    const options = await readWorkspaceFile('options/options.js');

    assert.match(
        options,
        /async function saveImmediateToggle\(partialSettings\) \{\s*try \{\s*await chrome\.runtime\.sendMessage\(\{ action: 'patchSettings', updates: partialSettings \}\);\s*initialSettingsSnapshot = buildSettingsSnapshot\(\{ \.\.\.initialSettingsSnapshot, \.\.\.partialSettings \}\);\s*refreshDirtyState\(\);\s*showToast\('已自动保存'\);\s*\} catch \(err\) \{\s*console\.error\('\[智译\] 保存开关设置失败:', err\);\s*showToast\('自动保存失败: ' \+ err\.message, 'error'\);\s*\}\s*\}/s,
    );
});

test('093 darkMode, debugMode, and showOriginal all continue to use saveImmediateToggle', async () => {
    const options = await readWorkspaceFile('options/options.js');

    assert.match(
        options,
        /elements\.enableDarkMode\.addEventListener\('change', \(e\) => \{\s*applyDarkMode\(e\.target\.checked\);\s*saveImmediateToggle\(\{ darkMode: e\.target\.checked \}\);\s*\}\);/,
    );
    assert.match(
        options,
        /elements\.enableDebugMode\.addEventListener\('change', async \(e\) => \{\s*await saveImmediateToggle\(\{ debugMode: e\.target\.checked \}\);\s*console\.log\('\[智译\] 调试模式:', e\.target\.checked \? '已开启' : '已关闭'\);\s*\}\);/,
    );
    assert.match(
        options,
        /elements\.showOriginal\.addEventListener\('change', \(e\) => \{\s*saveImmediateToggle\(\{ showOriginal: e\.target\.checked \}\);\s*\}\);/,
    );
});
