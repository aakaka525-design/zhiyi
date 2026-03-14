import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('sidebar isolates addHistory failures from the main translate error path', async () => {
    const sidebar = await readWorkspaceFile('content/modules/sidebar.js');

    assert.match(
        sidebar,
        /resultLang\.innerText = `翻译结果 \(\$\{targetLangSelect\.value\}\)`;\s*try \{\s*await ST\.sendMessage\(\{\s*action: 'addHistory',[\s\S]*\}\);\s*\} catch \(historyErr\) \{\s*console\.error\('\[智译\] 保存历史失败:', historyErr\);\s*\}\s*await ST\.refreshSidebarHistory\(\);/,
    );
});

test('popup isolates addHistory and syncFavoriteState failures after showing the result', async () => {
    const popup = await readWorkspaceFile('popup/popup.js');

    assert.match(
        popup,
        /currentResult = result\.text;\s*showResult\(result\.text\);\s*try \{\s*await StorageManager\.addHistory\(\{[\s\S]*provider: result\.provider,[\s\S]*\}\);\s*await syncFavoriteState\(\);\s*\} catch \(auxErr\) \{\s*console\.error\('\[智译\] 辅助操作失败:', auxErr\);\s*\}/,
    );
});

test('immersive observer reuses shared exclude selectors and plugin-element filtering', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(
        immersive,
        /const EXCLUDE_SELECTORS = \[\s*'nav', 'header', 'footer', 'aside',[\s\S]*'\.sidebar', '\.menu', '\.toolbar'\s*\];/,
    );
    assert.match(
        immersive,
        /for \(const selector of EXCLUDE_SELECTORS\) \{\s*if \(p\.closest\(selector\) \|\| p\.matches\(selector\)\) return false;\s*\}/,
    );
    assert.match(
        immersive,
        /if \(!isTwitter\) \{\s*for \(const selector of EXCLUDE_SELECTORS\) \{\s*if \(el\.closest\(selector\) \|\| el\.matches\(selector\)\) return false;\s*\}\s*if \(ST\.isPluginElement\(el\)\) return false;\s*\}/,
    );
    assert.doesNotMatch(
        immersive,
        /const excludeSelectors = \[/,
    );
});
