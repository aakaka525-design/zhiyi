import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('immersive observer releases pending translations in finally and matches the initial min-length split', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(
        immersive,
        /const minLength = isTwitter \? 5 : 20;\s*if \(text\.length < minLength\) return false;/,
    );
    assert.match(
        immersive,
        /const response = await ST\.sendMessage\(\{[\s\S]*action: 'translateBatch'[\s\S]*if \(response && response\.results\) \{[\s\S]*ST\.injectTranslation\(el, translation\);[\s\S]*\}/,
    );
    assert.match(
        immersive,
        /catch \(err\) \{\s*console\.error\('\[智译\] 动态内容翻译失败:', err\);\s*\} finally \{\s*newElements\.forEach\(el => ST\.pendingTranslations\.delete\(el\)\);\s*\}/,
    );
    assert.doesNotMatch(
        immersive,
        /if \(translation\) \{[\s\S]*ST\.injectTranslation\(el, translation\);[\s\S]*ST\.pendingTranslations\.delete\(el\);/,
    );
    assert.doesNotMatch(
        immersive,
        /catch \(err\) \{[^}]*newElements\.forEach\(el => ST\.pendingTranslations\.delete\(el\)\);/,
    );
});

test('content toast visuals come from CSS tokens instead of JS style.cssText', async () => {
    const utils = await readWorkspaceFile('content/modules/utils.js');
    const css = await readWorkspaceFile('content/content.css');

    assert.doesNotMatch(utils, /toast\.style\.cssText\s*=/);
    assert.match(
        utils,
        /const toast = document\.createElement\('div'\);\s*toast\.id = 'st-toast';\s*toast\.textContent = message;\s*document\.body\.appendChild\(toast\);/,
    );
    assert.match(
        utils,
        /setTimeout\(\(\) => \{\s*toast\.style\.opacity = '0';\s*toast\.style\.transition = 'opacity 0\.3s';\s*setTimeout\(\(\) => toast\.remove\(\), 300\);\s*\}, 3000\);/,
    );

    assert.match(
        css,
        /#st-toast\s*\{[\s\S]*position:\s*fixed;[\s\S]*bottom:\s*30px;[\s\S]*left:\s*50%;[\s\S]*transform:\s*translateX\(-50%\);[\s\S]*padding:\s*12px 24px;[\s\S]*background:\s*var\(--accent\);[\s\S]*color:\s*#fff;[\s\S]*border:\s*1px solid rgba\(255, 255, 255, 0\.2\);[\s\S]*border-radius:\s*12px;[\s\S]*font-size:\s*14px;[\s\S]*font-weight:\s*500;[\s\S]*font-family:\s*-apple-system, BlinkMacSystemFont, sans-serif;[\s\S]*box-shadow:\s*0 4px 20px rgba\(0, 0, 0, 0\.15\);[\s\S]*z-index:\s*2147483647;[\s\S]*animation:\s*st-fade-in 0\.3s ease;[\s\S]*\}/,
    );
    assert.doesNotMatch(css, /rgba\(141, 163, 153, 0\.95\)/);
});
