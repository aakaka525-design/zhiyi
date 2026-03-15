import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

async function loadUtilsHarness() {
    const source = await readWorkspaceFile('content/modules/utils.js');
    const ST = { ui: {} };

    const context = {
        window: {
            SmartTranslator: ST,
            speechSynthesis: {
                cancel() {},
                speak() {},
                speaking: false,
                pending: false,
            },
        },
        chrome: {
            runtime: {
                lastError: null,
                sendMessage(_message, callback) {
                    callback({});
                },
            },
        },
        document: {
            getElementById() {
                return null;
            },
            createElement() {
                return {
                    id: '',
                    textContent: '',
                    style: {},
                    remove() {},
                };
            },
            body: {
                appendChild() {},
            },
        },
        SpeechSynthesisUtterance: function SpeechSynthesisUtterance(text) {
            this.text = text;
            this.rate = 1;
            this.lang = 'en-US';
        },
        console: {
            log() {},
            warn() {},
            error() {},
        },
        setTimeout,
        clearTimeout,
        Promise,
    };

    vm.runInNewContext(source, context, { filename: 'utils.js' });
    return context.window.SmartTranslator;
}

test('088 static wiring uses codePointAt, expanded CJK ranges, and a strict kana ratio gate', async () => {
    const utils = await readWorkspaceFile('content/modules/utils.js');

    assert.match(utils, /const code = char\.codePointAt\(0\);/);
    assert.doesNotMatch(utils, /const code = char\.charCodeAt\(0\);/);
    assert.match(utils, /code >= 0x3400 && code <= 0x4DBF/);
    assert.match(utils, /code >= 0xF900 && code <= 0xFAFF/);
    assert.match(utils, /code >= 0x20000 && code <= 0x2A6DF/);
    assert.match(utils, /const kanaCount = hiraganaCount \+ katakanaCount;\s*if \(kanaCount \/ totalCount > 0\.2\) \{/s);
});

test('088 detectLanguage no longer over-triggers Japanese for mixed zh/ja and en/ja text', async () => {
    const ST = await loadUtilsHarness();

    assert.equal(ST.detectLanguage('动漫の世界很精彩'), 'zh');
    assert.equal(ST.detectLanguage('Python basics コード'), 'en');
});

test('088 detectLanguage still recognizes real Japanese text with enough kana', async () => {
    const ST = await loadUtilsHarness();

    assert.equal(ST.detectLanguage('これは日本語のテストです'), 'ja');
});

test('088 detectLanguage counts CJK extension A and B code points as Chinese', async () => {
    const ST = await loadUtilsHarness();

    assert.equal(ST.detectLanguage(String.fromCodePoint(0x3400, 0x3401, 0x3402)), 'zh');
    assert.equal(ST.detectLanguage(String.fromCodePoint(0x20000, 0x20001, 0x20002)), 'zh');
    assert.equal(ST.detectLanguage('Hello world'), 'en');
    assert.equal(ST.detectLanguage('你好世界'), 'zh');
});
