import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('immersive inline translation path appends directly without separator or inline style override', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(
        immersive,
        /if \(isFlexItem \|\| isGridItem \|\| isInline\) \{\s*setNodePageColor\(container,\s*originalColor\);\s*setOriginalTextAttr\(container,\s*originalText\);\s*container\.classList\.add\('st-translated-inline'\);\s*container\.appendChild\(transEl\);\s*\}/,
    );
    assert.doesNotMatch(immersive, /transEl\.style\.cssText = 'display: inline;/);
    assert.doesNotMatch(immersive, /container\.appendChild\(separator\);/);
});

test('immersive block heading translations sync font size and font weight from the source heading', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(
        immersive,
        /if \(container\.matches\('h1, h2, h3, h4, h5, h6'\)\) \{\s*const headingStyle = window\.getComputedStyle\(container\);\s*blockTransEl\.style\.fontSize = `calc\(\$\{headingStyle\.fontSize\} \* 0\.85\)`;\s*blockTransEl\.style\.fontWeight = headingStyle\.fontWeight;\s*\}/,
    );
});
