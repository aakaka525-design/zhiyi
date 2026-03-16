import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('104 floating ball redesign baseline now reflects capsule actions instead of radial menu fan-out', async () => {
    const source = await readWorkspaceFile('content/modules/floating-ball.js');

    assert.doesNotMatch(source, /Math\.cos|Math\.sin/);
    assert.match(source, /className = 'st-capsule-btn'/);
    assert.match(source, /<span>\$\{item\.label\}<\/span>/);
    assert.match(source, /container\.classList\.toggle\('expand-left', expandLeft\);/);
    assert.match(source, /container\.classList\.toggle\('expand-right', !expandLeft\);/);
    assert.doesNotMatch(source, /data-tooltip/);
    assert.match(source, /label:\s*'全页翻译'/);
    assert.match(source, /label:\s*'侧边栏'/);
    assert.match(source, /label:\s*'翻译小窗'/);
});

test('104 floating ball css baseline now uses glass capsule controls without tooltip rules', async () => {
    const css = await readWorkspaceFile('content/content.css');

    assert.match(css, /\.st-capsule\s*\{[\s\S]*max-width:\s*0;[\s\S]*opacity:\s*0;/);
    assert.match(css, /#st-floating-ball-container\.capsule-open \.st-capsule\s*\{[\s\S]*max-width:\s*300px;[\s\S]*opacity:\s*1;/);
    assert.match(css, /\.st-capsule-btn\s*\{[\s\S]*height:\s*34px;[\s\S]*background:\s*rgba\(0,\s*0,\s*0,\s*0\.55\);[\s\S]*backdrop-filter:\s*blur\(8px\);/);
    assert.match(css, /\.st-capsule-btn:hover\s*\{[\s\S]*background:\s*rgba\(0,\s*0,\s*0,\s*0\.7\);/);
    assert.match(css, /\.st-capsule-handle\s*\{[\s\S]*cursor:\s*grab;/);
    assert.doesNotMatch(css, /\.st-orb-menu-item/);
    assert.doesNotMatch(css, /\.st-orb-label/);
});
