import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('float window source speech resolves auto language before selecting Google TTS voice', async () => {
    const source = await readWorkspaceFile('content/modules/float-window.js');

    assert.match(source, /speakSourceBtn\.onclick = \(\) => speak\(input\.value, 'auto'\);/);
    assert.match(
        source,
        /const resolvedLang = !lang \|\| lang === 'auto' \? ST\.detectLanguage\(text\) : lang;/,
    );
    assert.match(
        source,
        /voice:\s*settings\.ttsVoiceGoogle \|\| ST\.getDefaultGoogleTtsVoice\(resolvedLang\)/,
    );
});

test('sidebar Google TTS resolves auto language before selecting the default voice', async () => {
    const source = await readWorkspaceFile('content/modules/sidebar.js');

    assert.match(
        source,
        /const speakGoogle = async \(text, lang, settings\) => \{[\s\S]*const resolvedLang = !lang \|\| lang === 'auto' \? ST\.detectLanguage\(text\) : lang;[\s\S]*const voice = settings\.ttsVoiceGoogle \|\| ST\.getDefaultGoogleTtsVoice\(resolvedLang\);/,
    );
});

test('sidebar history entries store language metadata and restore select state when clicked', async () => {
    const source = await readWorkspaceFile('content/modules/sidebar.js');

    assert.match(source, /historyItem\.dataset\.sourceLang = item\.sourceLang \|\| '';/);
    assert.match(source, /historyItem\.dataset\.targetLang = item\.targetLang \|\| '';/);
    assert.match(
        source,
        /const sl = historyItem\.dataset\.sourceLang;[\s\S]*const tl = historyItem\.dataset\.targetLang;/,
    );
    assert.match(source, /if \(sl\) sourceLangSelect\.value = sl;[\s\S]*else sourceLangSelect\.value = 'auto';/);
    assert.match(source, /if \(tl\) \{[\s\S]*targetLangSelect\.value = tl;[\s\S]*resultLang\.innerText = `翻译结果 \(\$\{tl\}\)`;/);
    assert.match(source, /else \{[\s\S]*resultLang\.innerText = '翻译结果';/);
});

test('sidebar translate success writes history before refreshing the history list', async () => {
    const source = await readWorkspaceFile('content/modules/sidebar.js');

    assert.match(
        source,
        /await ST\.sendMessage\(\{\s*action:\s*'addHistory',[\s\S]*source:\s*text,[\s\S]*target:\s*response\.text,[\s\S]*sourceLang:\s*sourceLangSelect\.value,[\s\S]*targetLang:\s*targetLangSelect\.value,[\s\S]*provider:\s*response\.provider \|\| '',[\s\S]*\}\);/,
    );
    assert.match(
        source,
        /await ST\.sendMessage\(\{[\s\S]*action:\s*'addHistory'[\s\S]*\}\);\s*await ST\.refreshSidebarHistory\(\);/,
    );
});
