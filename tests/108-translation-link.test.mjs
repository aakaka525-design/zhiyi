import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

function selectorMatches(node, selector) {
    return selector.split(',').map((part) => part.trim()).some((part) => {
        if (!part) return false;
        if (part.startsWith('.')) return node.__classes.includes(part.slice(1));
        if (part.startsWith('#')) return node.id === part.slice(1);
        if (part === 'a[href]') {
            return node.__tagName === 'a' && Boolean(node.href);
        }
        const attrMatch = part.match(/^([a-z0-9]+)\.([a-zA-Z0-9_-]+)\[href="([^"]+)"\]$/i);
        if (attrMatch) {
            return (
                node.__tagName === attrMatch[1].toLowerCase()
                && node.__classes.includes(attrMatch[2])
                && node.href === attrMatch[3]
            );
        }
        if (part.startsWith('[href="') && part.endsWith('"]')) {
            return node.href === part.slice(7, -2);
        }
        return part.toLowerCase() === node.__tagName;
    });
}

function createStyle(initial = {}) {
    const store = new Map(Object.entries(initial));
    return {
        setProperty(name, value) {
            store.set(name, String(value));
        },
        getPropertyValue(name) {
            return store.get(name) || '';
        },
        removeProperty(name) {
            const current = store.get(name) || '';
            store.delete(name);
            return current;
        },
    };
}

function createNode(tagName, {
    id = '',
    text = '',
    classes = [],
    children = [],
    display = 'block',
    visibility = 'visible',
    color = 'rgb(51, 51, 51)',
    href = '',
    target = '',
    rel = '',
    download = '',
} = {}) {
    let ownText = text;

    const node = {
        __tagName: tagName.toLowerCase(),
        __classes: [...classes],
        tagName: tagName.toUpperCase(),
        nodeType: 1,
        id,
        href,
        target,
        rel,
        download,
        __attached: true,
        __computedStyle: { display, visibility, color },
        parentNode: null,
        children: [],
        style: createStyle(),
        classList: {
            contains(cls) {
                return node.__classes.includes(cls);
            },
            add(...classesToAdd) {
                classesToAdd.forEach((cls) => {
                    if (!node.__classes.includes(cls)) node.__classes.push(cls);
                });
            },
            remove(...classesToRemove) {
                node.__classes = node.__classes.filter((cls) => !classesToRemove.includes(cls));
            },
        },
        get className() {
            return node.__classes.join(' ');
        },
        set className(value) {
            node.__classes = value ? String(value).split(/\s+/).filter(Boolean) : [];
        },
        get textContent() {
            return [ownText, ...node.children.map((child) => child.textContent)].join('');
        },
        set textContent(value) {
            ownText = value;
        },
        get innerText() {
            return [ownText, ...node.children.map((child) => child.innerText)].join('').trim();
        },
        set innerText(value) {
            ownText = value;
        },
        get nextElementSibling() {
            if (!node.parentNode) return null;
            const siblings = node.parentNode.children;
            const index = siblings.indexOf(node);
            return siblings[index + 1] || null;
        },
        appendChild(child) {
            child.parentNode = node;
            child.__attached = true;
            node.children.push(child);
            return child;
        },
        insertBefore(child, before) {
            child.parentNode = node;
            child.__attached = true;
            const index = node.children.indexOf(before);
            if (index === -1) {
                node.children.push(child);
            } else {
                node.children.splice(index, 0, child);
            }
            return child;
        },
        removeChild(child) {
            const index = node.children.indexOf(child);
            if (index !== -1) {
                node.children.splice(index, 1);
                child.parentNode = null;
                child.__attached = false;
            }
        },
        remove() {
            if (node.parentNode) {
                node.parentNode.removeChild(node);
            } else {
                node.__attached = false;
            }
        },
        querySelector(selector) {
            return node.querySelectorAll(selector)[0] || null;
        },
        querySelectorAll(selector) {
            const result = [];
            for (const child of node.children) {
                if (child.matches(selector)) result.push(child);
                result.push(...child.querySelectorAll(selector));
            }
            return result;
        },
        matches(selector) {
            return selectorMatches(node, selector);
        },
        closest(selector) {
            let current = node;
            while (current) {
                if (typeof current.matches === 'function' && current.matches(selector)) {
                    return current;
                }
                current = current.parentNode;
            }
            return null;
        },
        cloneNode(deep = false) {
            const clone = createNode(tagName, {
                id,
                text: ownText,
                classes: [...node.__classes],
                display,
                visibility,
                color,
                href,
                target,
                rel,
                download,
            });
            if (deep) {
                for (const child of node.children) {
                    clone.appendChild(child.cloneNode(true));
                }
            }
            return clone;
        },
    };

    for (const child of children) {
        node.appendChild(child);
    }

    return node;
}

async function loadImmersiveHarness() {
    const source = await readWorkspaceFile('content/modules/immersive.js');

    const document = {
        body: createNode('body'),
        contains(target) {
            return Boolean(target?.__attached);
        },
        querySelectorAll() {
            return [];
        },
        createElement(tagName) {
            return createNode(tagName);
        },
        addEventListener() {},
        removeEventListener() {},
    };

    const ST = {
        state: {
            settings: { showOriginal: true },
            isImmersiveEnabled: false,
            immersiveRunId: 1,
        },
        observers: {},
        pendingTranslations: new Set(),
    };

    const context = {
        window: {
            SmartTranslator: ST,
            location: { hostname: 'github.com', pathname: '/' },
            getComputedStyle(node) {
                return node.__computedStyle || { display: 'block', visibility: 'visible', color: 'rgb(51, 51, 51)' };
            },
            innerWidth: 1280,
            innerHeight: 800,
            addEventListener() {},
            removeEventListener() {},
        },
        document,
        console: { log() {}, warn() {}, error() {} },
        MutationObserver: class {
            disconnect() {}
            observe() {}
        },
        Node: { ELEMENT_NODE: 1 },
        setTimeout,
        clearTimeout,
    };
    context.globalThis = context;

    vm.runInNewContext(source, context, { filename: 'immersive.js' });
    return context.window.SmartTranslator;
}

test('108 source defines wrapTranslationWithLink, uses it only in block-wrapper path, and adds link CSS', async () => {
    const immersive = await readWorkspaceFile('content/modules/immersive.js');
    const css = await readWorkspaceFile('content/content.css');

    assert.match(immersive, /function wrapTranslationWithLink\(container, translationEl\)/);
    assert.match(immersive, /wrapper\.appendChild\(wrapTranslationWithLink\(container, blockTransEl\)\);/);
    assert.doesNotMatch(
        immersive,
        /container\.appendChild\(wrapTranslationWithLink\(container, blockTransEl\)\);/,
    );
    assert.match(css, /\.st-immersive-translation-link\s*\{/);
});

test('108 block-wrapper single-link container wraps translation in inherited anchor', async () => {
    const ST = await loadImmersiveHarness();

    const link = createNode('a', {
        text: 'lightpanda-io/browser',
        href: '/lightpanda-io/browser',
        target: '_blank',
        rel: 'noopener',
    });
    const heading = createNode('h2', { children: [link] });
    const parent = createNode('div', { children: [heading] });

    ST.injectTranslation(heading, 'lightpanda-io/浏览器');

    const wrapper = heading.nextElementSibling;
    assert.ok(wrapper);
    const translationLink = wrapper.querySelector('a.st-immersive-translation-link[href="/lightpanda-io/browser"]');
    assert.ok(translationLink);
    assert.equal(translationLink.target, '_blank');
    assert.equal(translationLink.rel, 'noopener');
    assert.ok(translationLink.querySelector('.st-immersive-translation'));
});

test('108 multi-link and cell-internal containers do not get wrapped links', async () => {
    const ST = await loadImmersiveHarness();

    const linkA = createNode('a', { text: 'A', href: '/a' });
    const linkB = createNode('a', { text: 'B', href: '/b' });
    const paragraph = createNode('p', {
        text: ' and ',
        children: [linkA, linkB],
    });
    const paragraphParent = createNode('div', { children: [paragraph] });

    ST.injectTranslation(paragraph, '译文');

    const wrapper = paragraph.nextElementSibling;
    assert.ok(wrapper);
    assert.equal(wrapper.querySelector('.st-immersive-translation-link'), null);

    const cellLink = createNode('a', { text: 'Cell link', href: '/cell' });
    const cell = createNode('td', { children: [cellLink] });

    ST.injectTranslation(cell, '单元格译文');

    assert.equal(cell.querySelector('.st-immersive-translation-link'), null);
    assert.ok(cell.querySelector('.st-immersive-translation'));
});
