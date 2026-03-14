import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('options renders a global save button container outside tab sections', async () => {
    const html = await readWorkspaceFile('options/options.html');
    const css = await readWorkspaceFile('options/options.css');

    assert.match(
        html,
        /<div class="options-actions">\s*<button class="btn btn-primary" id="save-btn">保存并应用配置<\/button>\s*<\/div>/,
    );
    assert.doesNotMatch(
        html,
        /<button class="btn btn-primary" style="margin-top: 20px;" id="save-btn">保存并应用配置<\/button>/,
    );
    assert.match(
        css,
        /\.options-actions\s*\{\s*max-width:\s*900px;\s*margin:\s*20px auto 0;\s*\}/,
    );
});

test('floating ball resize listener re-clamps even while hidden', async () => {
    const floatingBall = await readWorkspaceFile('content/modules/floating-ball.js');

    assert.match(
        floatingBall,
        /window\.addEventListener\('resize', \(\) => \{\s*if \(!container\) return;\s*const currentTop = parseInt\(container\.style\.top, 10\) \|\| window\.innerHeight \* 0\.8;\s*const isRight = container\.style\.right === '0px';\s*dockToEdge\(currentTop, isRight\);\s*\}\);/,
    );
    assert.doesNotMatch(
        floatingBall,
        /container\.style\.display === 'none'/,
    );
});
