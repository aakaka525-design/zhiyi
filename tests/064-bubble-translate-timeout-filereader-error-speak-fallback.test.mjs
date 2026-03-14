import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('selection bubble translate path opts into the shared 30000ms translation timeout', async () => {
    const selection = await readWorkspaceFile('content/modules/selection.js');

    assert.match(
        selection,
        /const response = await ST\.sendMessage\(\{\s*action: 'translate',\s*text: text,\s*from: sourceLang,\s*to: targetLang\s*\}, 30000, '翻译请求超时'\);/,
    );
});

test('OpenAI and GLM TTS FileReader conversions use onload and onerror instead of onloadend', async () => {
    const tts = await readWorkspaceFile('background/modules/tts.js');

    const onloadMatches = tts.match(/reader\.onload = \(\) => resolve\(reader\.result\);/g) || [];
    const onerrorMatches = tts.match(/reader\.onerror = \(\) => reject\(reader\.error \|\| new Error\('FileReader failed'\)\);/g) || [];
    assert.equal(onloadMatches.length, 2);
    assert.equal(onerrorMatches.length, 2);
    assert.doesNotMatch(
        tts,
        /const reader = new FileReader\(\);\s*const audioData = await new Promise\(\(resolve\) => \{\s*reader\.onloadend = \(\) => resolve\(reader\.result\);/s,
    );
});

test('sidebar OpenAI TTS falls back to system speech instead of throwing when audioData is missing', async () => {
    const sidebar = await readWorkspaceFile('content/modules/sidebar.js');

    assert.match(
        sidebar,
        /const speakOpenAI = async \(text, lang, settings\) => \{[\s\S]*if \(response\?\.audioData\) \{\s*await playAudioFromDataUrl\(response\.audioData\);\s*\} else \{\s*(if \(response\?\.error\) console\.warn\('\[TTS\] OpenAI 返回错误:', response\.error\);\s*)?return speakSystem\(text, lang, settings\.ttsSpeed \|\| 1\.0\);\s*\}[\s\S]*\};/s,
    );
    assert.doesNotMatch(
        sidebar,
        /const speakOpenAI = async \(text, lang, settings\) => [\s\S]*throw new Error\(response\?\.error \|\| 'OpenAI TTS failed'\);/s,
    );
});
