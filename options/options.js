/**
 * 设置页面脚本
 * 管理扩展的所有配置项
 */

import { StorageManager } from '../src/core/storage.js';
import {
    SHORTCUT_SETTINGS_URL,
    buildSettingsSnapshot,
    getSaveButtonLabel,
    getShortcutSettingsToastMessage,
    hasUnsavedChanges,
} from './options-ui-state.js';

function withTimeout(promise, ms, message = '请求超时') {
    let timeoutId;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(message)), ms);
        }),
    ]).finally(() => clearTimeout(timeoutId));
}

// DOM 元素
const elements = {
    navList: document.querySelector('.nav-list'),
    tabContents: document.querySelectorAll('.tab-content'),
    saveBtn: document.getElementById('save-btn'),
    shortcutSettingsBtn: document.getElementById('shortcut-settings-btn'),

    // 设置项
    targetLang: document.getElementById('default-target-lang'),
    enableSelection: document.getElementById('enable-selection'),
    enableShortcut: document.getElementById('enable-shortcut'),
    showOriginal: document.getElementById('show-original'),
    hoverShowOriginal: document.getElementById('hover-show-original'),
    showFloatingBall: document.getElementById('show-floating-ball'),
    enableAdBlock: document.getElementById('enable-ad-block'),
    enableDarkMode: document.getElementById('enable-dark-mode'),
    enableDebugMode: document.getElementById('enable-debug-mode'),
    provider: document.getElementById('default-provider'),


    // API 配置
    openaiApiKey: document.getElementById('openai-api-key'),
    openaiBaseUrl: document.getElementById('openai-base-url'),
    openaiModel: document.getElementById('openai-model'),
    geminiApiKey: document.getElementById('gemini-api-key'),
    geminiModel: document.getElementById('gemini-model'),
    deepseekApiKey: document.getElementById('deepseek-api-key'),
    deepseekBaseUrl: document.getElementById('deepseek-base-url'),
    deepseekModel: document.getElementById('deepseek-model'),

    // TTS 配置
    ttsProvider: document.getElementById('tts-provider'),
    ttsSpeed: document.getElementById('tts-speed'),
    ttsSpeedValue: document.getElementById('tts-speed-value'),
    ttsVoiceOpenai: document.getElementById('tts-voice-openai'),
    ttsVoiceGoogle: document.getElementById('tts-voice-google'),
    ttsVoiceGlm: document.getElementById('tts-voice-glm'),

    // 历史记录
    historyList: document.getElementById('history-list'),
    clearHistoryBtn: document.getElementById('clear-history-btn'),
    historyTabs: document.querySelectorAll('.history-tab-btn')
};

let initialSettingsSnapshot = null;
let hasPendingSettingsChanges = false;

// 初始化
async function init() {
    updateAppVersion();
    await loadSettings();
    bindEvents();

    // 检查 URL hash 切换到对应标签
    const hash = window.location.hash.substring(1);
    if (hash) {
        switchTab(hash);
    } else {
        loadTab('general');
    }
}

function updateAppVersion() {
    const versionEl = document.getElementById('app-version');
    if (!versionEl) return;
    versionEl.textContent = `版本 v${chrome.runtime.getManifest().version}`;
}

// 加载设置
async function loadSettings() {
    const settings = await StorageManager.getSettings();

    elements.targetLang.value = settings.targetLang;
    elements.enableSelection.checked = settings.enableSelection;
    elements.enableShortcut.checked = settings.enableShortcut;
    elements.showOriginal.checked = settings.showOriginal !== false;
    elements.hoverShowOriginal.checked = settings.hoverShowOriginal !== false;
    elements.showFloatingBall.checked = settings.showFloatingBall !== false;
    elements.enableAdBlock.checked = settings.enableAdBlock !== false;
    elements.enableDarkMode.checked = settings.darkMode || false;
    elements.enableDebugMode.checked = settings.debugMode || false;
    elements.provider.value = settings.provider;

    // 应用深色模式
    applyDarkMode(settings.darkMode);


    elements.openaiApiKey.value = settings.openaiApiKey;
    elements.openaiBaseUrl.value = settings.openaiBaseUrl;
    elements.openaiModel.value = settings.openaiModel;
    elements.geminiApiKey.value = settings.geminiApiKey;
    elements.geminiModel.value = settings.geminiModel;
    elements.deepseekApiKey.value = settings.deepseekApiKey;
    elements.deepseekBaseUrl.value = settings.deepseekBaseUrl;
    elements.deepseekModel.value = settings.deepseekModel;

    // TTS 设置
    elements.ttsProvider.value = settings.ttsProvider || 'system';
    elements.ttsSpeed.value = settings.ttsSpeed || 1.0;
    elements.ttsSpeedValue.textContent = (settings.ttsSpeed || 1.0) + 'x';
    elements.ttsVoiceOpenai.value = settings.ttsVoiceOpenai || 'nova';
    elements.ttsVoiceGoogle.value = settings.ttsVoiceGoogle || 'cmn-CN-Chirp3-HD-Aoede';
    elements.ttsVoiceGlm.value = settings.ttsVoiceGlm || 'tongtong';

    updateTtsConfigVisibility(settings.ttsProvider || 'system');

    updateApiVisibility(settings.provider);
    initialSettingsSnapshot = collectCurrentSettings();
    setDirtyState(false);
}

// 绑定事件
function bindEvents() {
    // 侧边栏切换
    elements.navList.addEventListener('click', (e) => {
        const item = e.target.closest('.nav-item');
        if (item) {
            const target = item.getAttribute('data-target');
            switchTab(target);
        }
    });

    // 服务提供商切换显示对应配置
    elements.provider.addEventListener('change', (e) => {
        updateApiVisibility(e.target.value);
    });

    // 深色模式切换
    elements.enableDarkMode.addEventListener('change', (e) => {
        applyDarkMode(e.target.checked);
        saveImmediateToggle({ darkMode: e.target.checked });
    });

    // 调试模式切换 - 自动保存并通知内容脚本
    elements.enableDebugMode.addEventListener('change', async (e) => {
        await saveImmediateToggle({ debugMode: e.target.checked });
        console.log('[智译] 调试模式:', e.target.checked ? '已开启' : '已关闭');
    });

    elements.showOriginal.addEventListener('change', (e) => {
        saveImmediateToggle({ showOriginal: e.target.checked });
    });

    elements.hoverShowOriginal.addEventListener('change', (e) => {
        saveImmediateToggle({ hoverShowOriginal: e.target.checked });
    });


    // 密码显示/隐藏切换
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (input) {
                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                btn.classList.toggle('active', isPassword);
            }
        });
    });



    // 保存按钮
    elements.saveBtn.addEventListener('click', flushTextAutosave);
    elements.shortcutSettingsBtn?.addEventListener('click', copyShortcutSettingsUrl);

    // 历史记录切换
    elements.historyTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            switchHistoryTab(btn.getAttribute('data-type'));
        });
    });

    // 清空历史
    elements.clearHistoryBtn.addEventListener('click', async () => {
        const isFavorite = currentHistoryType === 'favorite';
        const label = isFavorite ? '收藏' : '翻译历史';
        if (confirm(`确定要清空所有${label}记录吗？`)) {
            if (isFavorite) {
                await StorageManager.clearFavorites();
            } else {
                await StorageManager.clearHistory();
            }
            loadHistoryList(currentHistoryType);
        }
    });

    // API 连通性测试按钮
    document.getElementById('test-openai')?.addEventListener('click', () => testApiConnection('openai'));
    document.getElementById('test-gemini')?.addEventListener('click', () => testApiConnection('gemini'));
    document.getElementById('test-deepseek')?.addEventListener('click', () => testApiConnection('deepseek'));
    document.getElementById('test-tts')?.addEventListener('click', testTTS);

    // TTS 服务商切换
    elements.ttsProvider.addEventListener('change', (e) => {
        updateTtsConfigVisibility(e.target.value);
    });

    // TTS 语速滑块
    elements.ttsSpeed.addEventListener('input', (e) => {
        elements.ttsSpeedValue.textContent = e.target.value + 'x';
    });

    bindDirtyTracking();
    window.addEventListener('beforeunload', handleBeforeUnload);
}

// API 连通性测试
async function testApiConnection(provider) {
    const btn = document.getElementById(`test-${provider}`);
    const statusEl = document.getElementById(`test-${provider}-status`);

    if (!btn || !statusEl) return;

    // 显示加载状态
    btn.classList.add('loading');
    btn.disabled = true;
    statusEl.textContent = '';
    statusEl.className = 'test-status';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        let success = false;
        let message = '';

        switch (provider) {
            case 'openai': {
                const apiKey = elements.openaiApiKey.value.trim();
                const baseUrl = elements.openaiBaseUrl.value.trim() || 'https://api.openai.com/v1';

                if (!apiKey) {
                    throw new Error('请先填写 API Key');
                }

                const response = await fetch(`${baseUrl}/models`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${apiKey}` },
                    signal: controller.signal,
                });

                if (response.ok) {
                    success = true;
                    message = '✓';
                } else {
                    throw new Error(`${response.status}`);
                }
                break;
            }

            case 'gemini': {
                const apiKey = elements.geminiApiKey.value.trim();

                if (!apiKey) {
                    throw new Error('请先填写 API Key');
                }

                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
                    signal: controller.signal,
                });

                if (response.ok) {
                    success = true;
                    message = '✓';
                } else {
                    throw new Error(`${response.status}`);
                }
                break;
            }

            case 'deepseek': {
                const apiKey = elements.deepseekApiKey.value.trim();
                const baseUrl = elements.deepseekBaseUrl.value.trim() || 'https://api.ppinfra.com/openai';

                if (!apiKey) {
                    throw new Error('请先填写 API Key');
                }

                const response = await fetch(`${baseUrl}/models`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${apiKey}` },
                    signal: controller.signal,
                });

                if (response.ok) {
                    success = true;
                    message = '✓';
                } else {
                    throw new Error(`${response.status}`);
                }
                break;
            }
        }

        statusEl.textContent = message;
        statusEl.classList.add('success');

    } catch (error) {
        if (error.name === 'AbortError') {
            statusEl.textContent = '✗ 连接超时';
        } else {
            statusEl.textContent = `✗ ${error.message}`;
        }
        statusEl.classList.add('error');
    } finally {
        clearTimeout(timeoutId);
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

// 测试 TTS
async function testTTS() {
    const btn = document.getElementById('test-tts');
    const statusEl = document.getElementById('test-tts-status');

    if (!btn || !statusEl) return;

    btn.classList.add('loading');
    btn.disabled = true;
    statusEl.className = 'test-status';
    statusEl.textContent = '正在测试...';

    try {
        const provider = elements.ttsProvider.value;
        const testText = '测试语音播放';
        const speed = parseFloat(elements.ttsSpeed.value) || 1.0;

        if (provider === 'system') {
            statusEl.textContent = '播放中...';
            await withTimeout(playSystemTtsTest(testText, speed), 15000, '系统语音播放超时');
            statusEl.textContent = '✓ 播放完成';
            statusEl.classList.add('success');
            return;
        }

        const audioData = await withTimeout(
            requestTtsTestAudio(provider, testText, speed),
            15000,
            'TTS 请求超时',
        );
        statusEl.textContent = '✓ 已开始播放';
        statusEl.classList.add('success');
        const playbackResponse = await withTimeout(
            chrome.runtime.sendMessage({
                action: 'playAudioOffscreen',
                audioData,
            }),
            15000,
            '播放超时',
        );
        if (playbackResponse?.error) {
            throw new Error(playbackResponse.error);
        }
    } catch (error) {
        statusEl.textContent = `✗ ${error.message}`;
        statusEl.classList.add('error');
    } finally {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

function playSystemTtsTest(text, speed) {
    return new Promise((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = speed;

        let settled = false;
        let hasStarted = false;
        let pollId = null;
        let pollCount = 0;

        const settle = (fn) => {
            if (settled) return;
            settled = true;
            if (pollId) clearInterval(pollId);
            fn();
        };

        utterance.onstart = () => { hasStarted = true; };
        utterance.onend = () => settle(resolve);
        utterance.onerror = (e) => settle(() => reject(new Error(e.error || '播放失败')));

        pollId = setInterval(() => {
            pollCount++;
            if (hasStarted && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
                settle(resolve);
            } else if (!hasStarted && pollCount >= 10) {
                window.speechSynthesis.cancel();
                settle(() => reject(new Error('系统朗读启动超时')));
            }
        }, 500);

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    });
}

async function requestTtsTestAudio(provider, text, speed) {
    switch (provider) {
        case 'openai': {
            const apiKey = elements.openaiApiKey.value.trim();
            if (!apiKey) {
                throw new Error('请先填写 OpenAI API Key');
            }
            const response = await chrome.runtime.sendMessage({
                action: 'ttsOpenAI',
                apiKey,
                baseUrl: elements.openaiBaseUrl.value.trim() || 'https://api.openai.com/v1',
                text,
                voice: elements.ttsVoiceOpenai.value || 'nova',
                speed,
            });
            if (response?.audioData) {
                return response.audioData;
            }
            throw new Error(response?.error || 'OpenAI TTS 测试失败');
        }
        case 'google': {
            const apiKey = elements.geminiApiKey.value.trim();
            if (!apiKey) {
                throw new Error('请先填写 Gemini API Key');
            }
            const response = await chrome.runtime.sendMessage({
                action: 'ttsGoogle',
                apiKey,
                text,
                voice: elements.ttsVoiceGoogle.value || 'cmn-CN-Chirp3-HD-Aoede',
                speed,
            });
            if (response?.audioData) {
                return response.audioData;
            }
            throw new Error(response?.error || 'Google TTS 测试失败');
        }
        case 'glm': {
            const apiKey = elements.deepseekApiKey.value.trim();
            if (!apiKey) {
                throw new Error('请先填写 DeepSeek API Key（用于 GLM TTS）');
            }
            const response = await chrome.runtime.sendMessage({
                action: 'ttsGLM',
                apiKey,
                text,
                voice: elements.ttsVoiceGlm.value || 'tongtong',
                speed,
            });
            if (response?.audioData) {
                return response.audioData;
            }
            throw new Error(response?.error || 'GLM TTS 测试失败');
        }
        default:
            throw new Error(`当前 TTS 测试不支持 ${provider}`);
    }
}


// 切换标签
function switchTab(target) {
    // 更新导航栏
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-target') === target);
    });

    // 更新内容区
    elements.tabContents.forEach(content => {
        content.classList.toggle('active', content.id === target);
    });

    loadTab(target);
}

// 加载特定标签的内容
function loadTab(name) {
    if (name === 'history') {
        switchHistoryTab('recent');
    }
}

function updateClearBtnContext(type) {
    elements.clearHistoryBtn.textContent = type === 'favorite' ? '清空所有收藏' : '清空所有历史';
}

function switchHistoryTab(type) {
    elements.historyTabs.forEach(b => b.classList.remove('active'));
    const targetBtn = document.querySelector(`.history-tab-btn[data-type="${type}"]`);
    if (targetBtn) targetBtn.classList.add('active');

    const searchInput = document.getElementById('history-search');
    if (searchInput) searchInput.value = '';

    updateClearBtnContext(type);
    loadHistoryList(type);
}

// 保存设置
async function saveSettings() {
    const current = collectCurrentSettings();
    const diff = {};
    for (const key of Object.keys(current)) {
        if (current[key] !== initialSettingsSnapshot[key]) {
            diff[key] = current[key];
        }
    }

    if (Object.keys(diff).length === 0) {
        setDirtyState(false);
        return;
    }

    try {
        const response = await chrome.runtime.sendMessage({ action: 'patchSettings', updates: diff });
        if (response?.error) {
            throw new Error(response.error);
        }
        initialSettingsSnapshot = buildSettingsSnapshot({ ...initialSettingsSnapshot, ...diff });
        setDirtyState(false);
        showToast('设置保存成功');
    } catch (err) {
        refreshDirtyState();
        showToast('保存失败: ' + err.message, 'error');
    }
}

async function saveImmediateToggle(partialSettings) {
    try {
        await chrome.runtime.sendMessage({ action: 'patchSettings', updates: partialSettings });
        initialSettingsSnapshot = buildSettingsSnapshot({ ...initialSettingsSnapshot, ...partialSettings });
        refreshDirtyState();
        showToast('已自动保存');
    } catch (err) {
        console.error('[智译] 保存开关设置失败:', err);
        showToast('自动保存失败: ' + err.message, 'error');
    }
}

let pendingTextChanges = {};
let textAutosaveTimer = null;

function queueTextAutosave(partial) {
    Object.assign(pendingTextChanges, partial);
    if (textAutosaveTimer) clearTimeout(textAutosaveTimer);
    textAutosaveTimer = setTimeout(flushTextAutosave, 800);
}

async function flushTextAutosave() {
    if (textAutosaveTimer) {
        clearTimeout(textAutosaveTimer);
        textAutosaveTimer = null;
    }
    const changes = pendingTextChanges;
    pendingTextChanges = {};
    if (Object.keys(changes).length === 0) return;
    try {
        await chrome.runtime.sendMessage({ action: 'patchSettings', updates: changes });
        initialSettingsSnapshot = buildSettingsSnapshot({ ...initialSettingsSnapshot, ...changes });
        refreshDirtyState();
        showToast('已自动保存');
    } catch (err) {
        console.error('[智译] 自动保存失败:', err);
        showToast('自动保存失败: ' + err.message, 'error');
    }
}

const FIELD_KEY_MAP = {
    'default-target-lang': 'targetLang',
    'default-provider': 'provider',
    'enable-selection': 'enableSelection',
    'enable-shortcut': 'enableShortcut',
    'show-floating-ball': 'showFloatingBall',
    'enable-ad-block': 'enableAdBlock',
    'openai-api-key': 'openaiApiKey',
    'openai-base-url': 'openaiBaseUrl',
    'openai-model': 'openaiModel',
    'gemini-api-key': 'geminiApiKey',
    'gemini-model': 'geminiModel',
    'deepseek-api-key': 'deepseekApiKey',
    'deepseek-base-url': 'deepseekBaseUrl',
    'deepseek-model': 'deepseekModel',
    'tts-provider': 'ttsProvider',
    'tts-speed': 'ttsSpeed',
    'tts-voice-openai': 'ttsVoiceOpenai',
    'tts-voice-google': 'ttsVoiceGoogle',
    'tts-voice-glm': 'ttsVoiceGlm',
};

function getFieldKey(element) {
    return FIELD_KEY_MAP[element.id] || null;
}

// 更新 API 配置区域可见性
function updateApiVisibility(provider) {
    const openaiDiv = document.getElementById('openai-config');
    const geminiDiv = document.getElementById('gemini-config');
    const deepseekDiv = document.getElementById('deepseek-config');

    openaiDiv.style.display = provider === 'openai' ? 'block' : 'none';
    geminiDiv.style.display = provider === 'gemini' ? 'block' : 'none';
    deepseekDiv.style.display = provider === 'deepseek' ? 'block' : 'none';
}

// 更新 TTS 配置区域可见性
function updateTtsConfigVisibility(provider) {
    const openaiTtsDiv = document.getElementById('openai-tts-config');
    const googleTtsDiv = document.getElementById('google-tts-config');
    const glmTtsDiv = document.getElementById('glm-tts-config');

    openaiTtsDiv.style.display = provider === 'openai' ? 'block' : 'none';
    googleTtsDiv.style.display = provider === 'google' ? 'block' : 'none';
    glmTtsDiv.style.display = provider === 'glm' ? 'block' : 'none';
}

// 应用深色模式
function applyDarkMode(enabled) {
    if (enabled) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
}

function collectTtsVoices() {
    return {
        ttsVoiceOpenai: elements.ttsVoiceOpenai.value,
        ttsVoiceGoogle: elements.ttsVoiceGoogle.value,
        ttsVoiceGlm: elements.ttsVoiceGlm.value,
    };
}

function collectCurrentSettings() {
    return buildSettingsSnapshot({
        targetLang: elements.targetLang.value,
        enableSelection: elements.enableSelection.checked,
        enableShortcut: elements.enableShortcut.checked,
        showOriginal: elements.showOriginal.checked,
        hoverShowOriginal: elements.hoverShowOriginal.checked,
        showFloatingBall: elements.showFloatingBall.checked,
        enableAdBlock: elements.enableAdBlock.checked,
        provider: elements.provider.value,
        openaiApiKey: elements.openaiApiKey.value,
        openaiBaseUrl: elements.openaiBaseUrl.value,
        openaiModel: elements.openaiModel.value,
        geminiApiKey: elements.geminiApiKey.value,
        geminiModel: elements.geminiModel.value,
        deepseekApiKey: elements.deepseekApiKey.value,
        deepseekBaseUrl: elements.deepseekBaseUrl.value,
        deepseekModel: elements.deepseekModel.value,
        darkMode: elements.enableDarkMode.checked,
        debugMode: elements.enableDebugMode.checked,
        ttsProvider: elements.ttsProvider.value,
        ttsSpeed: parseFloat(elements.ttsSpeed.value),
        ...collectTtsVoices(),
    });
}

function setDirtyState(isDirty) {
    hasPendingSettingsChanges = isDirty;
    elements.saveBtn.textContent = getSaveButtonLabel(isDirty);
    elements.saveBtn.dataset.dirty = isDirty ? 'true' : 'false';
}

function refreshDirtyState() {
    if (!initialSettingsSnapshot) return;
    setDirtyState(hasUnsavedChanges(initialSettingsSnapshot, collectCurrentSettings()));
}

function bindDirtyTracking() {
    const toggleFields = new Set([
        elements.enableDarkMode,
        elements.enableDebugMode,
        elements.showOriginal,
        elements.hoverShowOriginal,
    ]);

    const selectFields = [
        elements.targetLang,
        elements.enableSelection,
        elements.enableShortcut,
        elements.hoverShowOriginal,
        elements.showFloatingBall,
        elements.enableAdBlock,
        elements.provider,
        elements.ttsProvider,
        elements.ttsSpeed,
        elements.ttsVoiceOpenai,
        elements.ttsVoiceGoogle,
        elements.ttsVoiceGlm,
    ];

    const textFields = [
        elements.openaiApiKey,
        elements.openaiBaseUrl,
        elements.openaiModel,
        elements.geminiApiKey,
        elements.geminiModel,
        elements.deepseekApiKey,
        elements.deepseekBaseUrl,
        elements.deepseekModel,
    ];

    selectFields.forEach((field) => {
        if (!field || toggleFields.has(field)) return;
        field.addEventListener('change', () => {
            refreshDirtyState();
            const key = getFieldKey(field);
            if (!key) return;
            const value = field.type === 'checkbox' ? field.checked
                : field.type === 'range' ? parseFloat(field.value)
                : field.value;
            saveImmediateToggle({ [key]: value });
        });
    });

    textFields.forEach((field) => {
        if (!field) return;
        field.addEventListener('input', () => {
            refreshDirtyState();
            const key = getFieldKey(field);
            if (!key) return;
            queueTextAutosave({ [key]: field.value });
        });
    });
}

function handleBeforeUnload(event) {
    if (Object.keys(pendingTextChanges).length > 0) {
        flushTextAutosave();
        event.preventDefault();
        event.returnValue = '';
        return;
    }
    if (!hasPendingSettingsChanges) return;
    event.preventDefault();
    event.returnValue = '';
}

async function copyShortcutSettingsUrl() {
    let copied = false;

    try {
        await navigator.clipboard.writeText(SHORTCUT_SETTINGS_URL);
        copied = true;
    } catch (_) {
        copied = false;
    }

    showToast(getShortcutSettingsToastMessage(copied), copied ? 'success' : 'error');
}


// 历史记录数据缓存
let currentHistoryData = [];
let currentHistoryType = 'recent';

// 加载历史记录列表
async function loadHistoryList(type) {
    currentHistoryType = type;
    elements.historyList.innerHTML = '<div class="spinner-container"><div class="spinner"></div></div>';

    const data = type === 'favorite'
        ? await StorageManager.getFavorites()
        : await StorageManager.getHistory();

    currentHistoryData = data;
    const query = document.getElementById('history-search')?.value || '';
    filterHistoryList(query);
}

// 渲染历史记录（支持筛选）
function renderHistoryList(data) {
    elements.historyList.replaceChildren();

    if (data.length === 0) {
        elements.historyList.innerHTML = `<div class="history-empty">暂无${currentHistoryType === 'favorite' ? '收藏' : '历史'}记录</div>`;
        return;
    }

    data.forEach((item) => {
        elements.historyList.appendChild(createHistoryCard(item));
    });

    // 绑定删除事件
    bindHistoryDeleteEvents();
}

function createHistoryCard(item) {
    const card = document.createElement('div');
    card.className = 'card history-item fade-in';
    card.dataset.id = item.id;

    const header = document.createElement('div');
    header.className = 'setting-header';

    const tag = document.createElement('div');
    tag.className = 'tag tag-accent';
    tag.textContent = `${item.sourceLang} → ${item.targetLang}`;

    const actions = document.createElement('div');
    actions.className = 'history-actions';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'st-action-btn delete-item';
    deleteBtn.dataset.id = item.id;
    deleteBtn.title = '删除';
    deleteBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';

    actions.appendChild(deleteBtn);
    header.append(tag, actions);

    const content = document.createElement('div');
    content.style.marginTop = '12px';

    const source = document.createElement('div');
    source.className = 'history-source';
    source.textContent = item.source;

    const target = document.createElement('div');
    target.className = 'history-target';
    target.textContent = item.target;

    content.append(source, target);

    const meta = document.createElement('div');
    meta.style.marginTop = '12px';
    meta.style.fontSize = '11px';
    meta.style.color = 'var(--text-tertiary)';
    meta.style.display = 'flex';
    meta.style.justifyContent = 'space-between';

    const provider = document.createElement('span');
    provider.textContent = item.provider || 'unknown';

    const timestamp = document.createElement('span');
    timestamp.textContent = new Date(item.timestamp).toLocaleString();

    meta.append(provider, timestamp);
    card.append(header, content, meta);

    return card;
}


// 历史记录搜索
function filterHistoryList(query) {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) {
        renderHistoryList(currentHistoryData);
        return;
    }

    const filtered = currentHistoryData.filter(item =>
        item.source.toLowerCase().includes(lowerQuery) ||
        item.target.toLowerCase().includes(lowerQuery)
    );
    renderHistoryList(filtered);
}

// 初始化搜索事件
document.getElementById('history-search')?.addEventListener('input', (e) => {
    filterHistoryList(e.target.value);
});

// 绑定历史记录删除事件
function bindHistoryDeleteEvents() {
    elements.historyList.querySelectorAll('.delete-item').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.getAttribute('data-id');
            if (currentHistoryType === 'favorite') {
                await StorageManager.removeFavorite(id);
            } else {
                await StorageManager.removeHistory(id);
            }
            loadHistoryList(currentHistoryType);
        };
    });
}


// 辅助函数：显示提示
function showToast(message, type = 'success') {
    document.querySelectorAll('.toast').forEach(el => el.remove());
    const toast = document.createElement('div');
    toast.className = 'toast fade-in';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        padding: 14px 28px;
        background: ${type === 'success' ? 'var(--accent)' : 'var(--error)'};
        color: white;
        font-weight: 600;
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        z-index: 10000;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}

// 启动
init();
