import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function readWorkspaceFile(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

function extractSnippet(source, regex, label) {
    const match = source.match(regex);
    assert.ok(match, `missing ${label}`);
    return match[0];
}

function createAutosaveHarness(source) {
    const pendingDecl = extractSnippet(source, /let pendingTextChanges = \{\};/, 'pendingTextChanges declaration');
    const timerDecl = extractSnippet(source, /let textAutosaveTimer = null;/, 'textAutosaveTimer declaration');
    const queueFn = extractSnippet(source, /function queueTextAutosave\(partial\) \{[\s\S]*?\n\}/, 'queueTextAutosave');
    const flushFn = extractSnippet(source, /async function flushTextAutosave\(\) \{[\s\S]*?\n\}/, 'flushTextAutosave');

    const sentMessages = [];
    const toasts = [];
    const timers = [];
    const clearedTimers = [];
    let nextTimerId = 1;
    let refreshCount = 0;

    const context = {
        console,
        Object,
        initialSettingsSnapshot: {
            openaiApiKey: '',
            openaiModel: '',
            deepseekModel: '',
        },
        buildSettingsSnapshot: (settings) => settings,
        refreshDirtyState: () => {
            refreshCount++;
        },
        showToast: (...args) => {
            toasts.push(args);
        },
        chrome: {
            runtime: {
                sendMessage: async (message) => {
                    sentMessages.push(message);
                    return { success: true };
                },
            },
        },
        setTimeout: (fn, ms) => {
            const id = nextTimerId++;
            timers.push({ id, fn, ms });
            return id;
        },
        clearTimeout: (id) => {
            clearedTimers.push(id);
        },
    };

    const harness = `
${pendingDecl}
${timerDecl}
${queueFn}
${flushFn}
globalThis.__autosave = {
    queueTextAutosave,
    flushTextAutosave,
    getPending: () => pendingTextChanges,
    getTimer: () => textAutosaveTimer,
    getSnapshot: () => initialSettingsSnapshot,
};
`;

    vm.runInNewContext(harness, context, { filename: '095-options-autosave-harness.js' });

    return {
        api: context.__autosave,
        sentMessages,
        toasts,
        timers,
        clearedTimers,
        getRefreshCount: () => refreshCount,
    };
}

function normalize(value) {
    return JSON.parse(JSON.stringify(value));
}

test('095 options autosave source wires text queue helpers, field map, and save button flush entry', async () => {
    const options = await readWorkspaceFile('options/options.js');

    assert.match(options, /let pendingTextChanges = \{\};/);
    assert.match(options, /let textAutosaveTimer = null;/);
    assert.match(options, /function queueTextAutosave\(partial\) \{/);
    assert.match(options, /async function flushTextAutosave\(\) \{/);
    assert.match(options, /const FIELD_KEY_MAP = \{/);
    assert.match(options, /'default-target-lang': 'targetLang'/);
    assert.match(options, /'tts-speed': 'ttsSpeed'/);
    assert.match(options, /'deepseek-model': 'deepseekModel'/);
    assert.match(options, /elements\.saveBtn\.addEventListener\('click', flushTextAutosave\);/);
    assert.match(options, /field\.addEventListener\('change', \(\) => \{[\s\S]*saveImmediateToggle\(\{ \[key\]: value \}\);[\s\S]*\}\);/);
    assert.match(options, /field\.addEventListener\('input', \(\) => \{[\s\S]*queueTextAutosave\(\{ \[key\]: field\.value \}\);[\s\S]*\}\);/);
});

test('095 queueTextAutosave merges partial text changes and resets the debounce timer', async () => {
    const options = await readWorkspaceFile('options/options.js');
    const harness = createAutosaveHarness(options);

    harness.api.queueTextAutosave({ openaiApiKey: 'sk-1' });
    harness.api.queueTextAutosave({ openaiModel: 'gpt-4.1-mini' });

    assert.deepEqual(normalize(harness.api.getPending()), {
        openaiApiKey: 'sk-1',
        openaiModel: 'gpt-4.1-mini',
    });
    assert.equal(harness.timers.length, 2);
    assert.deepEqual(harness.clearedTimers, [1]);
    assert.equal(harness.api.getTimer(), 2);
    assert.equal(harness.timers[0].ms, 800);
    assert.equal(harness.timers[1].ms, 800);
});

test('095 flushTextAutosave sends accumulated changes, clears pending state, and updates the snapshot baseline', async () => {
    const options = await readWorkspaceFile('options/options.js');
    const harness = createAutosaveHarness(options);

    harness.api.queueTextAutosave({ openaiApiKey: 'sk-1' });
    harness.api.queueTextAutosave({ deepseekModel: 'deepseek-chat' });
    await harness.api.flushTextAutosave();

    assert.deepEqual(normalize(harness.sentMessages), [
        {
            action: 'patchSettings',
            updates: {
                openaiApiKey: 'sk-1',
                deepseekModel: 'deepseek-chat',
            },
        },
    ]);
    assert.deepEqual(normalize(harness.api.getPending()), {});
    assert.equal(harness.api.getTimer(), null);
    assert.deepEqual(normalize(harness.api.getSnapshot()), {
        openaiApiKey: 'sk-1',
        openaiModel: '',
        deepseekModel: 'deepseek-chat',
    });
    assert.equal(harness.getRefreshCount(), 1);
    assert.deepEqual(harness.toasts, [['已自动保存']]);
});

test('095 flushTextAutosave skips patchSettings when there are no queued text changes', async () => {
    const options = await readWorkspaceFile('options/options.js');
    const harness = createAutosaveHarness(options);

    await harness.api.flushTextAutosave();

    assert.deepEqual(harness.sentMessages, []);
    assert.deepEqual(harness.toasts, []);
    assert.equal(harness.getRefreshCount(), 0);
});
