import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

function createNode(tagName, {
    parentNode = null,
    classes = [],
    attrs = {},
    children = [],
} = {}) {
    const node = {
        __tagName: tagName.toLowerCase(),
        tagName: tagName.toUpperCase(),
        parentNode,
        children: [],
        appendChild(child) {
            child.parentNode = this;
            this.children.push(child);
            return child;
        },
        matches(selector) {
            return selector.split(',').map((part) => part.trim()).some((part) => {
                if (!part) return false;
                if (part.startsWith('.')) return classes.includes(part.slice(1));
                if (part.startsWith('[') && part.endsWith(']')) {
                    const [rawKey, rawValue] = part.slice(1, -1).split('=');
                    const key = rawKey?.trim();
                    if (!key) return false;
                    if (rawValue === undefined) return key in attrs;
                    return attrs[key] === rawValue.trim().replace(/^['"]|['"]$/g, '');
                }
                return part.toLowerCase() === this.__tagName;
            });
        },
        closest(selector) {
            let current = this;
            while (current) {
                if (typeof current.matches === 'function' && current.matches(selector)) {
                    return current;
                }
                current = current.parentNode;
            }
            return null;
        },
        querySelector(selector) {
            for (const child of this.children) {
                if (typeof child.matches === 'function' && child.matches(selector)) {
                    return child;
                }
                const nested = child.querySelector?.(selector);
                if (nested) return nested;
            }
            return null;
        },
    };

    children.forEach((child) => node.appendChild(child));
    return node;
}

async function loadImmersiveHelpers() {
    const source = await readWorkspaceFile('content/modules/immersive.js');
    const instrumented = `${source}\nwindow.__testExports = { EXCLUDE_SELECTORS, isExcludedByImmersiveContext, containsHardProtectedContent };`;

    const context = {
        window: {
            SmartTranslator: {
                state: { settings: {} },
                observers: {},
                pendingTranslations: new Set(),
                isPluginElement() {
                    return false;
                },
                detectLanguage() {
                    return 'en';
                },
            },
            location: { hostname: 'example.com', pathname: '/' },
            getComputedStyle() {
                return { display: 'block', visibility: 'visible' };
            },
            addEventListener() {},
            removeEventListener() {},
        },
        document: {
            body: {},
            contains() {
                return true;
            },
            querySelectorAll() {
                return [];
            },
            createElement() {
                return {
                    className: '',
                    style: {},
                    appendChild() {},
                };
            },
            addEventListener() {},
            removeEventListener() {},
        },
        console: {
            log() {},
            error() {},
            warn() {},
        },
        MutationObserver: class {
            disconnect() {}
            observe() {}
        },
        Node: { ELEMENT_NODE: 1 },
        setTimeout,
        clearTimeout,
    };

    vm.runInNewContext(instrumented, context, { filename: 'immersive.js' });
    return context.window.__testExports;
}

test('103 expands EXCLUDE_SELECTORS and wires containsHardProtectedContent into all required filtering paths', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');

    assert.match(immersive, /'pre', 'code', 'kbd', 'samp', 'var',/);
    assert.match(immersive, /'\[translate="no"\]', '\[role="code"\]',/);
    assert.match(immersive, /'\.highlight'/);
    assert.match(immersive, /const HARD_PROTECTED_SELECTORS = 'pre, \[translate="no"\], \[role="code"\], \.highlight';/);
    assert.match(immersive, /function containsHardProtectedContent\(el\)\s*\{\s*return el\.querySelector\(HARD_PROTECTED_SELECTORS\) !== null;\s*\}/);

    assert.match(
        immersive,
        /if \(isExcludedByImmersiveContext\(p\)\) return false;\s*if \(containsHardProtectedContent\(p\)\) return false;\s*if \(isGitHubMetadataContext\(p\)\) return false;\s*(?:if \(isLinkedInMetadataContext\(p\)\) return false;\s*)?/,
    );
    assert.match(
        immersive,
        /const discordMessages = document\.querySelectorAll\('\[id\^="message-content-"\]'\);[\s\S]*?if \(containsHardProtectedContent\(el\)\) return false;/,
    );
    assert.match(
        immersive,
        /const telegramMessages = document\.querySelectorAll\('\.translatable-message'\);[\s\S]*?if \(containsHardProtectedContent\(el\)\) return false;/,
    );
    assert.match(
        immersive,
        /if \(!isTwitter\) \{\s*if \(isExcludedByImmersiveContext\(el\)\) return false;\s*if \(containsHardProtectedContent\(el\)\) return false;\s*if \(isGitHubMetadataContext\(el\)\) return false;\s*(?:if \(isLinkedInMetadataContext\(el\)\) return false;\s*)?if \(ST\.isPluginElement\(el\)\) return false;\s*\}/,
    );
    assert.match(
        immersive,
        /if \(!isTwitter\) \{\s*if \(isExcludedByImmersiveContext\(el\)\) return false;\s*if \(containsHardProtectedContent\(el\)\) return false;\s*if \(isGitHubMetadataContext\(el\)\) return false;\s*(?:if \(isLinkedInMetadataContext\(el\)\) return false;\s*)?if \(ST\.isPluginElement\(el\)\) return false;\s*\}/,
    );
});

test('103 runtime: pre and translate=no stay excluded by immersive context', async () => {
    const { EXCLUDE_SELECTORS, isExcludedByImmersiveContext } = await loadImmersiveHelpers();

    assert.ok(EXCLUDE_SELECTORS.includes('pre'));
    assert.ok(EXCLUDE_SELECTORS.includes('[translate="no"]'));

    const pre = createNode('pre');
    const noTranslate = createNode('p', {
        attrs: { translate: 'no' },
    });

    assert.equal(isExcludedByImmersiveContext(pre), true);
    assert.equal(isExcludedByImmersiveContext(noTranslate), true);
});

test('103 runtime: containers with pre descendants are hard-protected, but inline code alone is not', async () => {
    const { containsHardProtectedContent } = await loadImmersiveHelpers();

    const paragraphWithPre = createNode('p', {
        children: [createNode('pre')],
    });
    const paragraphWithCode = createNode('p', {
        children: [createNode('code')],
    });

    assert.equal(containsHardProtectedContent(paragraphWithPre), true);
    assert.equal(containsHardProtectedContent(paragraphWithCode), false);
});

test('103 runtime: hard-protected helper also catches role=code and .highlight descendants', async () => {
    const { containsHardProtectedContent } = await loadImmersiveHelpers();

    const withRoleCode = createNode('div', {
        children: [createNode('div', { attrs: { role: 'code' } })],
    });
    const withHighlight = createNode('div', {
        children: [createNode('div', { classes: ['highlight'] })],
    });

    assert.equal(containsHardProtectedContent(withRoleCode), true);
    assert.equal(containsHardProtectedContent(withHighlight), true);
});
