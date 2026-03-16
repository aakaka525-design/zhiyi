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
        /const EXCLUDE_SELECTORS = \[\s*'nav', 'header', 'footer', 'aside',[\s\S]*'\.sidebar', '\.menu', '\.toolbar',[\s\S]*'pre', 'code', 'kbd', 'samp', 'var',[\s\S]*'\[translate="no"\]', '\[role="code"\]',[\s\S]*'\.highlight'[\s\S]*\];/,
    );
    assert.match(
        immersive,
        /function isExcludedByImmersiveContext\(el\)\s*\{[\s\S]*for \(const selector of EXCLUDE_SELECTORS\) \{[\s\S]*if \(el\.matches\(selector\)\) return true;[\s\S]*const ancestor = el\.closest\(selector\);[\s\S]*if \(\(ancestor\.tagName === 'HEADER' \|\| ancestor\.tagName === 'FOOTER'\) &&[\s\S]*ancestor\.closest\('article, section'\)\) \{[\s\S]*continue;[\s\S]*\}[\s\S]*return true;[\s\S]*\}[\s\S]*return false;[\s\S]*\}/,
    );
    assert.match(
        immersive,
        /if \(p\.isContentEditable\) return false;\s*if \(isExcludedByImmersiveContext\(p\)\) return false;\s*if \(containsHardProtectedContent\(p\)\) return false;\s*if \(isGitHubMetadataContext\(p\)\) return false;\s*if \(isLinkedInMetadataContext\(p\)\) return false;/,
    );
    assert.match(
        immersive,
        /if \(el\.isContentEditable\) return false;\s*if \(!isTwitter\) \{\s*if \(isExcludedByImmersiveContext\(el\)\) return false;\s*if \(containsHardProtectedContent\(el\)\) return false;\s*if \(isGitHubMetadataContext\(el\)\) return false;\s*if \(isLinkedInMetadataContext\(el\)\) return false;\s*if \(ST\.isPluginElement\(el\)\) return false;\s*\}/,
    );
    assert.doesNotMatch(
        immersive,
        /const excludeSelectors = \[/,
    );
});
