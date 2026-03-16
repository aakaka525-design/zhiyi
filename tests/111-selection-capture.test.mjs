import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('111 content bindEvents moves only mouseup to capture phase and keeps mousedown/dblclick on default registration', async () => {
    const content = await readWorkspaceFile('content/content.js');

    assert.match(content, /document\.addEventListener\('mouseup', ST\.handleMouseUp, true\);/);
    assert.match(content, /document\.addEventListener\('mousedown', ST\.handleMouseDown\);/);
    assert.match(content, /document\.addEventListener\('dblclick', ST\.handleDoubleClick\);/);
    assert.doesNotMatch(content, /document\.addEventListener\('mousedown', ST\.handleMouseDown, true\);/);
    assert.doesNotMatch(content, /document\.addEventListener\('dblclick', ST\.handleDoubleClick, true\);/);
});
