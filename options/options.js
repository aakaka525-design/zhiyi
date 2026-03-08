/**
 * 设置页面脚本
 * 管理扩展的所有配置项
 */

import { StorageManager } from '../src/core/storage.js';

// DOM 元素
const elements = {
    navList: document.querySelector('.nav-list'),
    tabContents: document.querySelectorAll('.tab-content'),
    saveBtn: document.getElementById('save-btn'),

    // 设置项
    targetLang: document.getElementById('default-target-lang'),
    enableSelection: document.getElementById('enable-selection'),
    enableShortcut: document.getElementById('enable-shortcut'),
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
    mangaOcrEngine: document.getElementById('manga-ocr-engine'),
    customMangaApiKey: document.getElementById('custom-manga-api-key'),
    customMangaBaseUrl: document.getElementById('custom-manga-base-url'),
    customMangaModel: document.getElementById('custom-manga-model'),
    mangaFontStyle: document.getElementById('manga-font-style'),
    ocrDetectorType: document.getElementById('ocr-detector-type'),
    hybridCloudEngine: document.getElementById('hybrid-cloud-engine'),
    testMangaEngine: document.getElementById('test-manga-engine'),
    mangaEngineTestResult: document.getElementById('manga-engine-test-result'),

    // TTS 配置
    ttsProvider: document.getElementById('tts-provider'),
    ttsSpeed: document.getElementById('tts-speed'),
    ttsSpeedValue: document.getElementById('tts-speed-value'),
    ttsVoiceOpenai: document.getElementById('tts-voice-openai'),
    ttsVoiceGoogle: document.getElementById('tts-voice-google'),
    ttsVoiceGlm: document.getElementById('tts-voice-glm'),
    fishAudioApiKey: document.getElementById('fish-audio-api-key'),
    fishAudioVoice: document.getElementById('fish-audio-voice'),

    // 历史记录
    historyList: document.getElementById('history-list'),
    clearHistoryBtn: document.getElementById('clear-history-btn'),
    historyTabs: document.querySelectorAll('.history-tab-btn')
};

// 初始化
async function init() {
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

// 加载设置
async function loadSettings() {
    const settings = await StorageManager.getSettings();

    elements.targetLang.value = settings.targetLang;
    elements.enableSelection.checked = settings.enableSelection;
    elements.enableShortcut.checked = settings.enableShortcut;
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
    elements.mangaOcrEngine.value = settings.mangaOcrEngine || 'qwenvl-30b';
    elements.customMangaApiKey.value = settings.customMangaApiKey || '';
    elements.customMangaBaseUrl.value = settings.customMangaBaseUrl || '';
    elements.customMangaModel.value = settings.customMangaModel || '';
    elements.mangaFontStyle.value = settings.mangaFontStyle || 'sans-serif';
    if (elements.ocrDetectorType) {
        elements.ocrDetectorType.value = settings.ocrDetectorType || 'server';
    }
    if (elements.hybridCloudEngine) {
        elements.hybridCloudEngine.value = settings.hybridCloudEngine || 'qwenvl';
    }

    // TTS 设置
    elements.ttsProvider.value = settings.ttsProvider || 'system';
    elements.ttsSpeed.value = settings.ttsSpeed || 1.0;
    elements.ttsSpeedValue.textContent = (settings.ttsSpeed || 1.0) + 'x';
    elements.ttsVoiceOpenai.value = settings.ttsVoice || 'nova';
    elements.ttsVoiceGoogle.value = settings.ttsVoice || 'cmn-CN-Chirp3-HD-Aoede';
    elements.ttsVoiceGlm.value = settings.ttsVoice || 'tongtong';
    elements.fishAudioApiKey.value = settings.fishAudioApiKey || '';
    elements.fishAudioVoice.value = settings.fishAudioVoice || '';

    updateMangaConfigVisibility(settings.mangaOcrEngine || 'qwenvl-30b');
    updateTtsConfigVisibility(settings.ttsProvider || 'system');

    updateApiVisibility(settings.provider);
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

    // 漫画引擎切换显示自定义配置
    elements.mangaOcrEngine.addEventListener('change', (e) => {
        updateMangaConfigVisibility(e.target.value);
    });

    // 深色模式切换
    elements.enableDarkMode.addEventListener('change', (e) => {
        applyDarkMode(e.target.checked);
        saveSettings(); // 自动保存
    });

    // 调试模式切换 - 自动保存并通知内容脚本
    elements.enableDebugMode.addEventListener('change', async (e) => {
        await saveSettings();
        console.log('[智译] 调试模式:', e.target.checked ? '已开启' : '已关闭');
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
    elements.saveBtn.addEventListener('click', saveSettings);

    // 历史记录切换
    elements.historyTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.historyTabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadHistoryList(btn.getAttribute('data-type'));
        });
    });

    // 清空历史
    elements.clearHistoryBtn.addEventListener('click', async () => {
        if (confirm('确定要清空所有翻译历史记录吗？')) {
            await StorageManager.clearHistory();
            loadHistoryList('recent');
        }
    });

    // API 连通性测试按钮
    document.getElementById('test-openai')?.addEventListener('click', () => testApiConnection('openai'));
    document.getElementById('test-gemini')?.addEventListener('click', () => testApiConnection('gemini'));
    document.getElementById('test-deepseek')?.addEventListener('click', () => testApiConnection('deepseek'));
    document.getElementById('test-custom-manga')?.addEventListener('click', () => testApiConnection('custom-manga'));
    document.getElementById('test-tts')?.addEventListener('click', testTTS);

    // 漫画翻译引擎测试按钮
    elements.testMangaEngine?.addEventListener('click', testMangaEngine);

    // TTS 服务商切换
    elements.ttsProvider.addEventListener('change', (e) => {
        updateTtsConfigVisibility(e.target.value);
    });

    // TTS 语速滑块
    elements.ttsSpeed.addEventListener('input', (e) => {
        elements.ttsSpeedValue.textContent = e.target.value + 'x';
    });
}

// API 连通性测试
async function testApiConnection(provider) {
    const btn = document.getElementById(`test-${provider}`);
    const statusEl = document.getElementById(`test-${provider}-status`);

    if (!btn || !statusEl) return;

    // 显示加载状态
    btn.classList.add('loading');
    statusEl.textContent = '';
    statusEl.className = 'test-status';

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
                    headers: { 'Authorization': `Bearer ${apiKey}` }
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

                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

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
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                });

                if (response.ok) {
                    success = true;
                    message = '✓';
                } else {
                    throw new Error(`${response.status}`);
                }
                break;
            }

            case 'custom-manga': {
                const apiKey = document.getElementById('custom-manga-api-key')?.value.trim();
                const baseUrl = document.getElementById('custom-manga-base-url')?.value.trim();

                if (!apiKey) {
                    throw new Error('请先填写 API Key');
                }
                if (!baseUrl) {
                    throw new Error('请先填写 Base URL');
                }

                const response = await fetch(`${baseUrl}/models`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${apiKey}` }
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
        statusEl.textContent = `✗ ${error.message}`;
        statusEl.classList.add('error');
    } finally {
        btn.classList.remove('loading');
    }
}

// 测试漫画翻译引擎
async function testMangaEngine() {
    const btn = elements.testMangaEngine;
    const statusEl = elements.mangaEngineTestResult;

    if (!btn || !statusEl) return;

    btn.disabled = true;
    btn.textContent = '测试中...';
    statusEl.textContent = '';
    statusEl.style.color = '';

    try {
        const engine = elements.mangaOcrEngine.value;
        let success = false;
        let message = '';

        if (engine === 'local-paddle' || engine === 'local-hybrid') {
            // 测试本地 Native OCR 连通性
            const response = await chrome.runtime.sendMessage({
                action: 'testNativeOCR'
            });

            if (response && response.success) {
                success = true;
                message = '✓ 本地 OCR 可用';
                if (engine === 'local-hybrid') {
                    // 还需测试云端引擎
                    const cloudEngine = elements.hybridCloudEngine?.value || 'qwenvl';
                    if (cloudEngine === 'qwenvl') {
                        const deepseekKey = elements.deepseekApiKey.value.trim();
                        if (!deepseekKey) {
                            message = '✓ 本地 OCR 可用，⚠️ 请配置 Qwen-VL API Key';
                        } else {
                            message = '✓ 本地 OCR 可用 + Qwen-VL';
                        }
                    } else {
                        const geminiKey = elements.geminiApiKey.value.trim();
                        if (!geminiKey) {
                            message = '✓ 本地 OCR 可用，⚠️ 请配置 Gemini API Key';
                        } else {
                            message = '✓ 本地 OCR 可用 + Gemini';
                        }
                    }
                }
            } else {
                throw new Error(response?.error || '本地 OCR 不可用');
            }
        } else if (engine === 'qwenvl-30b' || engine === 'qwenvl-8b') {
            const apiKey = elements.deepseekApiKey.value.trim();
            if (!apiKey) {
                throw new Error('请配置 ppinfra API Key (Qwen-VL)');
            }
            const resp = await fetch('https://api.ppinfra.com/openai/models', {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            if (resp.ok) {
                success = true;
                message = '✓ Qwen-VL 可用';
            } else {
                throw new Error(`HTTP ${resp.status}`);
            }
        } else if (engine === 'gemini') {
            const apiKey = elements.geminiApiKey.value.trim();
            if (!apiKey) {
                throw new Error('请配置 Gemini API Key');
            }
            const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            if (resp.ok) {
                success = true;
                message = '✓ Gemini 可用';
            } else {
                throw new Error(`HTTP ${resp.status}`);
            }
        } else if (engine === 'custom') {
            const apiKey = elements.customMangaApiKey.value.trim();
            const baseUrl = elements.customMangaBaseUrl.value.trim();
            if (!apiKey || !baseUrl) {
                throw new Error('请配置自定义 API');
            }
            const resp = await fetch(`${baseUrl}/models`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            if (resp.ok) {
                success = true;
                message = '✓ 自定义 API 可用';
            } else {
                throw new Error(`HTTP ${resp.status}`);
            }
        }

        statusEl.textContent = message;
        statusEl.style.color = success ? 'var(--success)' : 'var(--warning)';

    } catch (error) {
        statusEl.textContent = `✗ ${error.message}`;
        statusEl.style.color = 'var(--error)';
    } finally {
        btn.disabled = false;
        btn.textContent = '🔍 测试连通性';
    }
}


// 测试 TTS
async function testTTS() {
    const btn = document.getElementById('test-tts');
    const statusEl = document.getElementById('test-tts-status');

    if (!btn || !statusEl) return;

    btn.classList.add('loading');
    statusEl.textContent = '';
    statusEl.className = 'test-status';

    try {
        const provider = elements.ttsProvider.value;
        const testText = '您好，这是智译翻译的语音测试。';

        // 发送消息给 service-worker 测试 TTS
        const response = await chrome.runtime.sendMessage({
            action: 'testTTS',
            text: testText,
            provider: provider
        });

        if (response && response.success) {
            statusEl.textContent = '✓ 播放成功';
            statusEl.classList.add('success');
        } else {
            throw new Error(response?.error || '测试失败');
        }
    } catch (error) {
        statusEl.textContent = `✗ ${error.message}`;
        statusEl.classList.add('error');
    } finally {
        btn.classList.remove('loading');
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
        loadHistoryList('recent');
    }
}

// 保存设置
async function saveSettings() {
    const settings = {
        targetLang: elements.targetLang.value,
        enableSelection: elements.enableSelection.checked,
        enableShortcut: elements.enableShortcut.checked,
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
        mangaOcrEngine: elements.mangaOcrEngine.value,
        customMangaApiKey: elements.customMangaApiKey.value,
        customMangaBaseUrl: elements.customMangaBaseUrl.value,
        customMangaModel: elements.customMangaModel.value,
        mangaFontStyle: elements.mangaFontStyle.value,
        ocrDetectorType: elements.ocrDetectorType?.value || 'server',
        hybridCloudEngine: elements.hybridCloudEngine?.value || 'qwenvl',
        darkMode: elements.enableDarkMode.checked,
        debugMode: elements.enableDebugMode.checked,
        ttsProvider: elements.ttsProvider.value,
        ttsSpeed: parseFloat(elements.ttsSpeed.value),
        ttsVoice: (() => {
            switch (elements.ttsProvider.value) {
                case 'openai': return elements.ttsVoiceOpenai.value;
                case 'google': return elements.ttsVoiceGoogle.value;
                case 'glm': return elements.ttsVoiceGlm.value;
                default: return '';
            }
        })(),
        fishAudioApiKey: elements.fishAudioApiKey.value,
        fishAudioVoice: elements.fishAudioVoice.value,
    };

    try {
        await StorageManager.updateSettings(settings);
        // 通知 background 刷新设置
        chrome.runtime.sendMessage({ action: 'updateSettings', settings });
        showToast('设置保存成功');
    } catch (err) {
        showToast('保存失败: ' + err.message, 'error');
    }
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

// 更新漫画配置区域可见性
function updateMangaConfigVisibility(engine) {
    const customDiv = document.getElementById('custom-manga-config');
    const hybridDiv = document.getElementById('hybrid-cloud-engine-group');

    customDiv.style.display = engine === 'custom' ? 'block' : 'none';
    if (hybridDiv) {
        hybridDiv.style.display = engine === 'local-hybrid' ? 'block' : 'none';
    }
}

// 更新 TTS 配置区域可见性
function updateTtsConfigVisibility(provider) {
    const openaiTtsDiv = document.getElementById('openai-tts-config');
    const googleTtsDiv = document.getElementById('google-tts-config');
    const glmTtsDiv = document.getElementById('glm-tts-config');
    const fishDiv = document.getElementById('fish-audio-config');

    openaiTtsDiv.style.display = provider === 'openai' ? 'block' : 'none';
    googleTtsDiv.style.display = provider === 'google' ? 'block' : 'none';
    glmTtsDiv.style.display = provider === 'glm' ? 'block' : 'none';
    fishDiv.style.display = provider === 'fish' ? 'block' : 'none';
}

// 应用深色模式
function applyDarkMode(enabled) {
    if (enabled) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
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
    renderHistoryList(data);
}

// 渲染历史记录（支持筛选）
function renderHistoryList(data) {
    if (data.length === 0) {
        elements.historyList.innerHTML = `<div class="history-empty">暂无${currentHistoryType === 'favorite' ? '收藏' : '历史'}记录</div>`;
        return;
    }

    elements.historyList.innerHTML = data.map(item => `
    <div class="card history-item fade-in" data-id="${item.id}">
      <div class="setting-header">
        <div class="tag tag-accent">${item.sourceLang} → ${item.targetLang}</div>
        <div class="history-actions">
          <button class="st-action-btn delete-item" data-id="${item.id}" title="删除">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
      <div style="margin-top: 12px;">
        <div class="history-source">${item.source}</div>
        <div class="history-target">${item.target}</div>
      </div>
      <div style="margin-top: 12px; font-size: 11px; color: var(--text-tertiary); display: flex; justify-content: space-between;">
        <span>${item.provider || 'unknown'}</span>
        <span>${new Date(item.timestamp).toLocaleString()}</span>
      </div>
    </div>
  `).join('');

    // 绑定删除事件
    bindHistoryDeleteEvents();
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
