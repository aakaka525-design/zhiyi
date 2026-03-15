import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('ST.sendMessage supports optional timeout opt-in and translate callers pass explicit translation timeouts', async () => {
    const utils = await readWorkspaceFile('content/modules/utils.js');
    const sidebar = await readWorkspaceFile('content/modules/sidebar.js');
    const floatWindow = await readWorkspaceFile('content/modules/float-window.js');

    assert.match(
        utils,
        /ST\.sendMessage = function \(message, timeoutMs = 0, timeoutMessage = '请求超时'\) \{\s*const request = new Promise\(\(resolve, reject\) => \{\s*chrome\.runtime\.sendMessage\(message, \(response\) => \{\s*if \(chrome\.runtime\.lastError\) \{\s*reject\(chrome\.runtime\.lastError\);\s*\} else \{\s*resolve\(response\);\s*\}\s*\}\);\s*\}\);\s*if \(timeoutMs <= 0\) return request;\s*let timeoutId;\s*return Promise\.race\(\[\s*request,\s*new Promise\(\(_, reject\) => \{\s*timeoutId = setTimeout\(\(\) => reject\(new Error\(timeoutMessage\)\), timeoutMs\);\s*\}\),\s*\]\)\.finally\(\(\) => clearTimeout\(timeoutId\)\);\s*\};/,
    );

    assert.match(
        sidebar,
        /const response = await ST\.sendMessage\(\{\s*action: 'translate',\s*text: text,\s*from: sourceLangSelect\.value,\s*to: targetLangSelect\.value\s*\}, 30000, '翻译请求超时'\);/,
    );

    assert.match(
        floatWindow,
        /const response = await ST\.sendMessage\(\{\s*action: 'translate',\s*text: text,\s*to: targetLangSelect\.value\s*\}, 30000, '翻译请求超时'\);/,
    );
});

test('content storage change handler syncs sidebar and float-window language selects from the latest settings', async () => {
    const content = await readWorkspaceFile('content/content.js');

    assert.match(
        content,
        /if \(areaName === 'local' && changes\.settings\) \{\s*ST\.state\.settings = mergeDefaults\(changes\.settings\.newValue\);\s*applyContentTheme\(ST\.state\.settings\?\.darkMode\);[\s\S]*ST\.syncLanguageSelects\?\.\(\);\s*syncShowOriginalMode\(\);[\s\S]*console\.log\('\[智译\] 设置已自动更新'\);/,
    );

    assert.match(
        content,
        /ST\.syncLanguageSelects = function \(\) \{\s*const s = ST\.state\.settings;\s*if \(!s\) return;\s*const sidebar = document\.getElementById\('st-sidebar'\);\s*if \(sidebar\) \{\s*const src = sidebar\.querySelector\('#st-sidebar-source-lang'\);\s*const tgt = sidebar\.querySelector\('#st-sidebar-target-lang'\);\s*if \(src && s\.sourceLang\) src\.value = s\.sourceLang;\s*if \(tgt && s\.targetLang\) tgt\.value = s\.targetLang;\s*\}\s*const fw = document\.getElementById\('st-float-window'\);\s*if \(fw\) \{\s*const tgt = fw\.querySelector\('#st-float-target-lang'\);\s*if \(tgt && s\.targetLang\) tgt\.value = s\.targetLang;\s*\}\s*\};/,
    );
});
