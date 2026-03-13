import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('popup error state toggles classes and hides actions via CSS', async () => {
    const js = await readWorkspaceFile('popup/popup.js');
    const css = await readWorkspaceFile('popup/popup.css');

    assert.match(
        js,
        /function showResult\(text\) \{\s*elements\.resultSection\.classList\.add\('active'\);\s*elements\.resultSection\.classList\.remove\('error-state'\);[\s\S]*\}/,
    );
    assert.match(
        js,
        /function clearResult\(\) \{\s*currentResult = '';\s*elements\.resultSection\.classList\.remove\('active', 'error-state'\);[\s\S]*\}/,
    );
    assert.match(
        js,
        /function showError\(message\) \{\s*elements\.resultSection\.classList\.add\('active', 'error-state'\);[\s\S]*\}/,
    );
    assert.match(
        css,
        /\.result-section\.error-state \.result-actions\s*\{\s*display:\s*none;\s*\}/,
    );
});

test('content error states use design tokens instead of hard-coded red values', async () => {
    const sidebar = await readWorkspaceFile('content/modules/sidebar.js');
    const selection = await readWorkspaceFile('content/modules/selection.js');
    const floatWindow = await readWorkspaceFile('content/modules/float-window.js');

    assert.match(sidebar, /resultContent\.style\.color = 'var\(--error\)'/);
    assert.doesNotMatch(sidebar, /resultContent\.style\.color = '#ff5252'/);

    assert.match(selection, /container\.style\.color = isError \? 'var\(--error\)' : '';/);
    assert.doesNotMatch(selection, /container\.style\.color = isError \? '#ff5252' : '';/);

    assert.match(
        floatWindow,
        /resultText\.innerText = response\.text;\s*resultText\.style\.color = '';/,
    );
    assert.match(
        floatWindow,
        /resultText\.innerText = '错误: ' \+ err\.message;\s*resultText\.style\.color = 'var\(--error\)';/,
    );
});

test('sidebar and float-window system TTS resolve auto or missing languages before speaking', async () => {
    const sidebar = await readWorkspaceFile('content/modules/sidebar.js');
    const floatWindow = await readWorkspaceFile('content/modules/float-window.js');

    assert.match(
        sidebar,
        /const speakSystem = \(text, lang, speed\) => \{\s*const langMap = \{ zh: 'zh-CN', en: 'en-US', ja: 'ja-JP', ko: 'ko-KR' \};\s*const resolvedLang = !lang \|\| lang === 'auto' \? ST\.detectLanguage\(text\) : lang;[\s\S]*utterance\.lang = langMap\[resolvedLang\] \|\| resolvedLang;/,
    );
    assert.match(
        floatWindow,
        /const speed = settings\.ttsSpeed \|\| 1\.0;\s*const resolvedLang = !lang \|\| lang === 'auto' \? ST\.detectLanguage\(text\) : lang;[\s\S]*const langMap = \{ zh: 'zh-CN', en: 'en-US', ja: 'ja-JP', ko: 'ko-KR' \};[\s\S]*utterance\.lang = langMap\[resolvedLang\] \|\| resolvedLang;/,
    );
});

test('isPluginElement treats the floating ball container as extension-owned UI', async () => {
    const utils = await readWorkspaceFile('content/modules/utils.js');

    assert.match(utils, /el\.closest\('#st-floating-ball-container'\) \|\|/);
});

test('content stylesheet keeps a single sidebar heading comment block', async () => {
    const css = await readWorkspaceFile('content/content.css');
    const matches = css.match(/侧边栏 \(Sidebar\) 样式/g) || [];

    assert.equal(matches.length, 1);
});
