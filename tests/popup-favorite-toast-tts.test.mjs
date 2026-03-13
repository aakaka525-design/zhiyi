import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('popup favorite flow checks addFavorite result and syncs icon state separately from showResult', async () => {
    const popup = await readWorkspaceFile('popup/popup.js');

    assert.match(
        popup,
        /const result = await StorageManager\.addFavorite\(\{[\s\S]*if \(result\) \{\s*showToast\('已添加到收藏'\);\s*\} else \{\s*showToast\('已在收藏中'\);\s*\}\s*syncFavoriteState\(\);/,
    );
    assert.match(
        popup,
        /async function syncFavoriteState\(\) \{\s*const text = elements\.sourceText\.value\.trim\(\);\s*if \(!text\) \{\s*elements\.btnFavorite\.querySelector\('svg'\)\.style\.fill = 'none';\s*return;\s*\}\s*const isFav = await StorageManager\.isFavorite\(text\);\s*elements\.btnFavorite\.querySelector\('svg'\)\.style\.fill = isFav \? 'var\(--warning\)' : 'none';\s*\}/,
    );
    assert.match(
        popup,
        /await StorageManager\.addHistory\(\{[\s\S]*provider: result\.provider,[\s\S]*\}\);\s*await syncFavoriteState\(\);/,
    );
    assert.match(
        popup,
        /function showResult\(text\) \{/,
    );
    assert.doesNotMatch(
        popup,
        /async function showResult\(text\)/,
    );
    assert.doesNotMatch(
        popup,
        /showToast\('已添加到收藏'\);\s*elements\.btnFavorite\.querySelector\('svg'\)\.style\.fill = 'var\(--warning\)'/,
    );
});

test('content toast uses dedicated keyframes that preserve centered x-offset', async () => {
    const css = await readWorkspaceFile('content/content.css');

    assert.match(
        css,
        /#st-toast\s*\{[\s\S]*left:\s*50%;[\s\S]*transform:\s*translateX\(-50%\);[\s\S]*animation:\s*st-toast-fade-in 0\.3s ease;[\s\S]*\}/,
    );
    assert.match(
        css,
        /@keyframes st-toast-fade-in \{\s*from \{\s*opacity:\s*0;\s*transform:\s*translate\(-50%, 8px\);\s*\}\s*to \{\s*opacity:\s*1;\s*transform:\s*translate\(-50%, 0\);\s*\}\s*\}/,
    );
    assert.doesNotMatch(
        css,
        /#st-toast\s*\{[\s\S]*left:\s*0;[\s\S]*right:\s*0;[\s\S]*width:\s*fit-content;[\s\S]*margin:\s*0 auto;[\s\S]*\}/,
    );
});

test('glm tts handler no longer logs debug output on success paths', async () => {
    const tts = await readWorkspaceFile('background/modules/tts.js');

    assert.doesNotMatch(tts, /\[TTS\] GLM 后台请求:/);
    assert.doesNotMatch(tts, /\[TTS\] GLM 成功, 数据长度:/);
    assert.match(tts, /\[TTS\] GLM 响应错误:/);
    assert.match(tts, /\[TTS\] GLM TTS 失败:/);
});
