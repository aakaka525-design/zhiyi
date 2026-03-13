import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('popup char count state is centralized in updateCharCount with a CSS class toggle', async () => {
    const source = await readWorkspaceFile('popup/popup.js');
    const css = await readWorkspaceFile('popup/popup.css');

    assert.match(
        source,
        /function updateCharCount\(\)\s*\{[\s\S]*elements\.charCount\.textContent = `\$\{len\} \/ \$\{MAX_CHARS\}`;[\s\S]*elements\.charCount\.classList\.toggle\('over-limit', len > MAX_CHARS\);[\s\S]*\}/,
    );
    assert.match(
        source,
        /elements\.sourceText\.addEventListener\('input', \(\) => \{\s*updateCharCount\(\);\s*\}\);/,
    );
    assert.doesNotMatch(source, /elements\.charCount\.style\.color = 'var\(--(?:error|text-muted)\)'/);
    assert.match(css, /\.char-count\.over-limit\s*\{[\s\S]*color:\s*var\(--error\);/);
});

test('popup loading state disables source text and both language selectors', async () => {
    const source = await readWorkspaceFile('popup/popup.js');

    const setLoadingSection = source.match(/function setLoading\(loading\)\s*\{[\s\S]*?\n\}/)?.[0] || '';

    assert.match(setLoadingSection, /elements\.sourceText\.disabled = true;/);
    assert.match(setLoadingSection, /elements\.sourceLang\.disabled = true;/);
    assert.match(setLoadingSection, /elements\.targetLang\.disabled = true;/);
    assert.match(setLoadingSection, /elements\.sourceText\.disabled = false;/);
    assert.match(setLoadingSection, /elements\.sourceLang\.disabled = false;/);
    assert.match(setLoadingSection, /elements\.targetLang\.disabled = false;/);
});

test('popup stylesheet defines disabled-state feedback for non-interactive controls', async () => {
    const css = await readWorkspaceFile('popup/popup.css');

    assert.match(
        css,
        /(button|\.btn|\.translate-btn)[^{]*:disabled\s*\{[\s\S]*opacity:\s*0\.[0-9]+|1;\s*[\s\S]*cursor:\s*not-allowed;/,
    );
});

test('content stylesheet defines disabled-state feedback for extension controls', async () => {
    const css = await readWorkspaceFile('content/content.css');

    assert.match(
        css,
        /(#st-sidebar|#st-float-window|\.st-sidebar-btn|\.st-float-btn|button)[^{]*:disabled\s*\{[\s\S]*opacity:\s*0\.[0-9]+|1;\s*[\s\S]*cursor:\s*not-allowed;/,
    );
});

test('shared theme stylesheet defines disabled-state feedback for options controls', async () => {
    const css = await readWorkspaceFile('options/theme.css');

    assert.match(
        css,
        /(\.btn|\.input|\.select|button|input|select)[^{]*:disabled\s*\{[\s\S]*opacity:\s*0\.[0-9]+|1;\s*[\s\S]*cursor:\s*not-allowed;/,
    );
});

test('ad blocker removeAds uses one merged selector query instead of per-selector full scans', async () => {
    const source = await readWorkspaceFile('content/modules/ad-blocker.js');
    const removeAdsSection = source.match(/const removeAds = \(\) => \{[\s\S]*?\n    \};/)?.[0] || '';

    assert.match(source, /const AD_SELECTOR_QUERY = AD_SELECTORS\.join\(',\\n'\);/);
    assert.match(removeAdsSection, /document\.querySelectorAll\(AD_SELECTOR_QUERY\)\.forEach\(el => \{/);
    assert.doesNotMatch(removeAdsSection, /AD_SELECTORS\.forEach\(selector => \{/);
});

test('popup, content, and theme stylesheets define keyboard focus-visible states', async () => {
    const popupCss = await readWorkspaceFile('popup/popup.css');
    const contentCss = await readWorkspaceFile('content/content.css');
    const themeCss = await readWorkspaceFile('options/theme.css');

    assert.match(popupCss, /\.textarea:focus-visible\s*\{[\s\S]*outline:/);
    assert.match(popupCss, /\.btn-icon:focus-visible\s*\{[\s\S]*outline:/);
    assert.match(contentCss, /\.st-sidebar-input:focus-visible\s*\{[\s\S]*outline:/);
    assert.match(contentCss, /\.st-lang-select:focus-visible\s*\{[\s\S]*outline:/);
    assert.match(contentCss, /\.st-float-input:focus-visible\s*\{[\s\S]*outline:/);
    assert.match(themeCss, /\.btn:focus-visible\s*\{[\s\S]*outline:/);
    assert.match(themeCss, /\.input:focus-visible\s*\{[\s\S]*outline:/);
});

test('float window drag lifecycle uses addEventListener/removeEventListener instead of document handler assignment', async () => {
    const source = await readWorkspaceFile('content/modules/float-window.js');

    assert.match(source, /document\.addEventListener\('mousemove', [^)]*\);/);
    assert.match(source, /document\.addEventListener\('mouseup', [^)]*\);/);
    assert.match(source, /document\.removeEventListener\('mousemove', [^)]*\);/);
    assert.match(source, /document\.removeEventListener\('mouseup', [^)]*\);/);
    assert.doesNotMatch(source, /document\.onmousemove =/);
    assert.doesNotMatch(source, /document\.onmouseup =/);
});
