import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('selection bubble extracts source and target language once for translate and history persistence', async () => {
    const selection = await readWorkspaceFile('content/modules/selection.js');

    assert.match(
        selection,
        /const sourceLang = ST\.detectLanguage\(text\);\s*const targetLang = ST\.state\.settings\?\.targetLang \|\| 'zh';/,
    );
    assert.match(
        selection,
        /const response = await ST\.sendMessage\(\{\s*action: 'translate',\s*text: text,\s*from: sourceLang,\s*to: targetLang\s*\}, 30000, '翻译请求超时'\);/,
    );
    assert.match(
        selection,
        /ST\.sendMessage\(\{\s*action: 'addHistory',\s*item: \{\s*source: text,\s*target: response\.text,\s*sourceLang,\s*targetLang,\s*provider: response\.provider \|\| '',\s*\}\s*\}\);/,
    );
    assert.doesNotMatch(
        selection,
        /await ST\.sendMessage\(\{\s*action: 'addHistory'/,
    );
});

test('selection bubble copy button awaits clipboard success before showing copied feedback', async () => {
    const selection = await readWorkspaceFile('content/modules/selection.js');

    assert.match(
        selection,
        /copyBtn\.onclick = async \(\) => \{\s*try \{\s*await navigator\.clipboard\.writeText\(response\.text\);\s*copyBtn\.style\.color = 'var\(--accent\)';\s*setTimeout\(\(\) => copyBtn\.style\.color = '', 1000\);\s*\} catch \(err\) \{\s*console\.error\('复制失败:', err\);\s*\}\s*\};/,
    );
});

test('selection bubble hides actions in error states and restores them for successful results', async () => {
    const selection = await readWorkspaceFile('content/modules/selection.js');

    assert.match(
        selection,
        /if \(ST\.ui\.bubble !== myBubble\) return;\s*const resultDiv = myBubble\.querySelector\('\.st-bubble-result'\);\s*if \(!resultDiv\) return;\s*if \(response && response\.text\) \{\s*renderBubbleMessage\(resultDiv, response\.text\);\s*const actionsEl = myBubble\.querySelector\('\.st-bubble-actions'\);\s*if \(actionsEl\) actionsEl\.style\.display = '';[\s\S]*?\} else \{\s*renderBubbleMessage\(resultDiv, `翻译失败: \$\{response\?\.error \|\| '未知错误'\}`, true\);\s*const actionsEl = myBubble\.querySelector\('\.st-bubble-actions'\);\s*if \(actionsEl\) actionsEl\.style\.display = 'none';\s*\}/,
    );
    assert.match(
        selection,
        /catch \(err\) \{\s*if \(ST\.ui\.bubble !== myBubble\) return;\s*const resultDiv = myBubble\.querySelector\('\.st-bubble-result'\);\s*if \(resultDiv\) \{\s*renderBubbleMessage\(resultDiv, `请求失败: \$\{err\.message \|\| '未知错误'\}`, true\);\s*\}\s*const actionsEl = myBubble\.querySelector\('\.st-bubble-actions'\);\s*if \(actionsEl\) actionsEl\.style\.display = 'none';\s*\}/,
    );
});
