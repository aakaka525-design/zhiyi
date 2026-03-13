import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { installChromeStub } from './helpers/chrome-stub.mjs';
import { StorageManager } from '../src/core/storage.js';

const { store, reset } = installChromeStub();

beforeEach(() => {
    reset();
});

test('getSettings returns expected defaults for a fresh store', async () => {
    const settings = await StorageManager.getSettings();

    assert.equal(settings.showFloatingBall, false);
    assert.equal(settings.enableAdBlock, false);
    assert.equal(settings.ttsProvider, 'system');
    assert.equal(settings.provider, 'google');
    assert.equal(settings.targetLang, 'zh');
});

test('getSettings strips legacy keys from persisted settings', async () => {
    store.settings = {
        provider: 'openai',
        mangaOcrEngine: 'legacy',
        fishAudioApiKey: 'legacy-key',
        fishAudioVoice: 'legacy-voice',
    };

    const settings = await StorageManager.getSettings();

    assert.equal(settings.provider, 'openai');
    assert.equal('mangaOcrEngine' in settings, false);
    assert.equal('fishAudioApiKey' in settings, false);
    assert.equal('fishAudioVoice' in settings, false);
});

test('getSettings migrates edge and fish tts providers to system', async () => {
    store.settings = { ttsProvider: 'edge' };
    assert.equal((await StorageManager.getSettings()).ttsProvider, 'system');

    store.settings = { ttsProvider: 'fish' };
    assert.equal((await StorageManager.getSettings()).ttsProvider, 'system');

    store.settings = { ttsProvider: 'openai' };
    assert.equal((await StorageManager.getSettings()).ttsProvider, 'openai');
});

test('getSettings merges stored values over defaults', async () => {
    store.settings = {
        provider: 'gemini',
        targetLang: 'en',
    };

    const settings = await StorageManager.getSettings();

    assert.equal(settings.provider, 'gemini');
    assert.equal(settings.targetLang, 'en');
    assert.equal(settings.sourceLang, 'auto');
    assert.equal(settings.showFloatingBall, false);
});

test('updateSettings changes only requested keys and does not backfill new defaults', async () => {
    store.settings = {
        provider: 'google',
        sourceLang: 'auto',
    };

    const settings = await StorageManager.updateSettings({ targetLang: 'ja' });

    assert.equal(settings.targetLang, 'ja');
    assert.equal(store.settings.targetLang, 'ja');
    assert.equal(store.settings.provider, 'google');
    assert.equal('showFloatingBall' in store.settings, false);
    assert.equal('enableAdBlock' in store.settings, false);
});

test('addHistory deduplicates entries only when source and targetLang both match', async () => {
    await StorageManager.addHistory({ source: 'hello', target: '你好', targetLang: 'zh', provider: 'google' });
    const latest = await StorageManager.addHistory({ source: 'hello', target: '您好', targetLang: 'zh', provider: 'openai' });

    const history = await StorageManager.getHistory();

    assert.equal(history.length, 1);
    assert.equal(history[0].id, latest.id);
    assert.equal(history[0].target, '您好');
    assert.equal(history[0].targetLang, 'zh');
    assert.equal(history[0].provider, 'openai');
});

test('addHistory preserves same source text when targetLang differs', async () => {
    await StorageManager.addHistory({ source: 'hello', target: '你好', targetLang: 'zh', provider: 'google' });
    await StorageManager.addHistory({ source: 'hello', target: 'こんにちは', targetLang: 'ja', provider: 'openai' });

    const history = await StorageManager.getHistory();

    assert.equal(history.length, 2);
    assert.deepEqual(
        history.map((item) => ({ source: item.source, target: item.target, targetLang: item.targetLang })),
        [
            { source: 'hello', target: 'こんにちは', targetLang: 'ja' },
            { source: 'hello', target: '你好', targetLang: 'zh' },
        ],
    );
});

test('addHistory trims the list to 500 entries', async () => {
    store.history = Array.from({ length: 500 }, (_, index) => ({
        id: `old-${index}`,
        timestamp: `2026-03-10T00:00:${String(index % 60).padStart(2, '0')}.000Z`,
        source: `old-${index}`,
        target: `旧-${index}`,
        provider: 'google',
    }));

    await StorageManager.addHistory({ source: 'fresh', target: '新', provider: 'google' });
    const history = await StorageManager.getHistory();

    assert.equal(history.length, 500);
    assert.equal(history[0].source, 'fresh');
    assert.equal(history.some((item) => item.source === 'old-499'), false);
});

test('removeHistory and clearHistory update persisted history', async () => {
    const originalNow = Date.now;
    Date.now = (() => {
        let current = 1000;
        return () => current++;
    })();

    try {
        const first = await StorageManager.addHistory({ source: 'one', target: '一', provider: 'google' });
        await StorageManager.addHistory({ source: 'two', target: '二', provider: 'google' });

        await StorageManager.removeHistory(first.id);
        let history = await StorageManager.getHistory();
        assert.deepEqual(history.map((item) => item.source), ['two']);

        await StorageManager.clearHistory();
        history = await StorageManager.getHistory();
        assert.deepEqual(history, []);
    } finally {
        Date.now = originalNow;
    }
});

test('favorites reject duplicates and report membership correctly', async () => {
    const created = await StorageManager.addFavorite({ source: 'hello', target: '你好', provider: 'google' });
    const duplicate = await StorageManager.addFavorite({ source: 'hello', target: '您好', provider: 'openai' });

    assert.ok(created);
    assert.equal(duplicate, null);
    assert.equal(await StorageManager.isFavorite('hello'), true);
    assert.equal(await StorageManager.isFavorite('missing'), false);
});

test('favorites trim to 200 entries and removeFavorite deletes by id', async () => {
    store.favorites = Array.from({ length: 200 }, (_, index) => ({
        id: `fav-${index}`,
        timestamp: `2026-03-10T00:00:${String(index % 60).padStart(2, '0')}.000Z`,
        source: `source-${index}`,
        target: `target-${index}`,
        provider: 'google',
    }));

    const created = await StorageManager.addFavorite({ source: 'fresh', target: '新', provider: 'openai' });
    let favorites = await StorageManager.getFavorites();

    assert.ok(created);
    assert.equal(favorites.length, 200);
    assert.equal(favorites[0].source, 'fresh');
    assert.equal(favorites.some((item) => item.source === 'source-199'), false);

    await StorageManager.removeFavorite(created.id);
    favorites = await StorageManager.getFavorites();
    assert.equal(favorites.some((item) => item.id === created.id), false);
});
