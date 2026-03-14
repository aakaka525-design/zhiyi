import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('selection double-click path skips the second mouseup and clears any leftover icon before showing the bubble', async () => {
    const selection = await readWorkspaceFile('content/modules/selection.js');

    assert.match(
        selection,
        /ST\.handleMouseUp = function \(e\) \{\s*if \(!ST\.state\.settings\?\.enableSelection\) return;\s*if \(e\.detail >= 2\) return;\s*if \(ST\.isPluginElement\(e\.target\)\) return;/,
    );
    assert.match(
        selection,
        /ST\.handleDoubleClick = function \(e\) \{\s*if \(!ST\.state\.settings\?\.enableSelection\) return;\s*if \(e\.target\.matches\('input, textarea, \[contenteditable="true"\]'\)\) \{\s*return;\s*\}\s*ST\.removeIcon\(\);\s*if \(ST\.isPluginElement\(e\.target\)\) \{\s*return;\s*\}/,
    );
});

test('float-window exposes a shared clamp helper and reuses it for drag end, resize, and reopen', async () => {
    const floatWindow = await readWorkspaceFile('content/modules/float-window.js');

    assert.match(
        floatWindow,
        /ST\.ui\.clampFloatWindowPosition = \(\) => \{\s*const el = ST\.ui\.floatWindow;\s*if \(!el \|\| el\.style\.right !== 'auto'\) return;\s*const left = parseInt\(el\.style\.left, 10\);\s*const top = parseInt\(el\.style\.top, 10\);\s*if \(isNaN\(left\) \|\| isNaN\(top\)\) return;\s*const w = el\.offsetWidth;\s*const minVisible = 50;\s*el\.style\.left = `\$\{Math\.max\(minVisible - w, Math\.min\(window\.innerWidth - minVisible, left\)\)\}px`;\s*el\.style\.top = `\$\{Math\.max\(0, Math\.min\(window\.innerHeight - header\.offsetHeight, top\)\)\}px`;\s*\};/,
    );
    assert.match(
        floatWindow,
        /const handleDragEnd = \(\) => \{\s*isDragging = false;\s*document\.removeEventListener\('mousemove', handleDragMove\);\s*document\.removeEventListener\('mouseup', handleDragEnd\);\s*ST\.ui\.clampFloatWindowPosition\?\.\(\);\s*\};/,
    );
    assert.match(
        floatWindow,
        /window\.addEventListener\('resize', \(\) => \{\s*if \(ST\.ui\.floatWindow\?\.classList\.contains\('active'\)\) \{\s*ST\.ui\.clampFloatWindowPosition\?\.\(\);\s*\}\s*\}\);/,
    );
    assert.match(
        floatWindow,
        /const isActive = ST\.ui\.floatWindow\.classList\.toggle\('active'\);\s*if \(isActive\) \{\s*ST\.ui\.clampFloatWindowPosition\?\.\(\);\s*setTimeout\(\(\) => \{\s*ST\.ui\.floatWindow\.querySelector\('#st-float-input'\)\.focus\(\);\s*\}, 100\);\s*\}/,
    );
});
