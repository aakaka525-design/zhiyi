import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('106 floating ball source replaces menu fan-out with capsule structure and handle-based drag', async () => {
    const source = await readWorkspaceFile('content/modules/floating-ball.js');

    assert.doesNotMatch(source, /Math\.cos|Math\.sin/);
    assert.doesNotMatch(source, /st-orb-menu-item/);
    assert.match(source, /className = 'st-capsule'/);
    assert.match(source, /className = 'st-capsule-handle'/);
    assert.match(source, /className = 'st-capsule-btn'/);
    assert.match(source, /capsule-open/);
    assert.match(source, /handle\.addEventListener\('mousedown', onMouseDown\)/);
    assert.doesNotMatch(source, /ball\.addEventListener\('mousedown', onMouseDown\)/);
    assert.match(source, /ball\.addEventListener\('click', \(e\) => \{/);
    assert.match(source, /container\.classList\.toggle\('expand-left', expandLeft\);/);
    assert.match(source, /container\.classList\.toggle\('expand-right', !expandLeft\);/);
});

test('106 content CSS defines capsule layout and removes 104 menu rules', async () => {
    const css = await readWorkspaceFile('content/content.css');

    assert.match(css, /\.st-capsule\s*\{[\s\S]*max-width:\s*0;[\s\S]*opacity:\s*0;[\s\S]*overflow:\s*hidden;[\s\S]*pointer-events:\s*none;/);
    assert.match(css, /#st-floating-ball-container\.capsule-open \.st-capsule\s*\{[\s\S]*max-width:\s*300px;[\s\S]*opacity:\s*1;[\s\S]*pointer-events:\s*auto;/);
    assert.match(css, /#st-floating-ball-container\.expand-left\s*\{[\s\S]*flex-direction:\s*row-reverse;/);
    assert.match(css, /#st-floating-ball-container\.expand-right\s*\{[\s\S]*flex-direction:\s*row;/);
    assert.match(css, /\.st-capsule-btn\s*\{[\s\S]*background:\s*rgba\(0,\s*0,\s*0,\s*0\.55\);[\s\S]*backdrop-filter:\s*blur\(8px\);/);
    assert.match(css, /\.st-capsule-handle\s*\{[\s\S]*cursor:\s*grab;/);
    assert.match(css, /\.st-orb-progress\s*\{[\s\S]*opacity:\s*0;[\s\S]*pointer-events:\s*none;/);
    assert.doesNotMatch(css, /\.st-orb-menu-item/);
    assert.doesNotMatch(css, /\.st-orb-label/);
});

test('106 shared progress helpers wire the floating-ball progress ring', async () => {
    const utils = await readWorkspaceFile('content/modules/utils.js');

    assert.match(utils, /const progress = document\.querySelector\('\.st-orb-progress'\);/);
    assert.match(utils, /const circle = document\.querySelector\('\.st-orb-progress circle'\);/);
    assert.match(utils, /const circumference = 125\.6;/);
    assert.match(utils, /circle\.style\.strokeDashoffset = circumference \* \(1 - percent \/ 100\);/);
    assert.match(utils, /if \(progress\) progress\.style\.opacity = '1';/);
    assert.match(utils, /const progress = document\.querySelector\('\.st-orb-progress'\);[\s\S]*setTimeout\(\(\) => \{[\s\S]*if \(progress\) \{[\s\S]*progress\.style\.opacity = '0';/);
});
