/**
 * Popup 主脚本
 * 处理用户交互和翻译请求
 */

import { StorageManager } from '../src/core/storage.js';
import { Translator } from '../src/core/translator.js';

// DOM 元素
const elements = {
    sourceLang: document.getElementById('source-lang'),
    targetLang: document.getElementById('target-lang'),
    sourceText: document.getElementById('source-text'),
    resultSection: document.getElementById('result-section'),
    resultContent: document.getElementById('result-content'),

    charCount: document.getElementById('char-count'),
    currentService: document.getElementById('current-service'),

    // 按钮
    btnSwap: document.getElementById('btn-swap'),
    btnClear: document.getElementById('btn-clear'),
    btnPaste: document.getElementById('btn-paste'),
    btnTranslate: document.getElementById('btn-translate'),
    btnSpeak: document.getElementById('btn-speak'),
    btnCopy: document.getElementById('btn-copy'),
    btnFavorite: document.getElementById('btn-favorite'),
    btnHistory: document.getElementById('btn-history'),
    btnSettings: document.getElementById('btn-settings'),
    btnImmersive: document.getElementById('btn-immersive'),
    btnPdf: document.getElementById('btn-pdf'),
    btnSidebar: document.getElementById('btn-sidebar'),
    btnFloat: document.getElementById('btn-float'),
};

const MAX_CHARS = 5000;
let translator = null;
let currentResult = '';

// 初始化
async function init() {
    translator = new Translator();
    await translator.init();

    // 加载用户设置
    await loadSettings();

    // 绑定事件
    bindEvents();

    // 更新服务状态显示
    updateServiceDisplay();

    // 检查是否有选中文本
    await checkSelectedText();
}

// 加载设置
async function loadSettings() {
    const settings = await StorageManager.getSettings();

    if (settings.sourceLang) {
        elements.sourceLang.value = settings.sourceLang;
    }
    if (settings.targetLang) {
        elements.targetLang.value = settings.targetLang;
    }
}

// 保存语言设置
async function saveLanguageSettings() {
    await StorageManager.updateSettings({
        sourceLang: elements.sourceLang.value,
        targetLang: elements.targetLang.value,
    });
}

// 绑定事件
function bindEvents() {
    // 输入框字符计数
    elements.sourceText.addEventListener('input', () => {
        const len = elements.sourceText.value.length;
        elements.charCount.textContent = `${len} / ${MAX_CHARS}`;
        if (len > MAX_CHARS) {
            elements.charCount.style.color = 'var(--error)';
        } else {
            elements.charCount.style.color = 'var(--text-muted)';
        }
    });

    // 语言切换
    elements.btnSwap.addEventListener('click', () => {
        const source = elements.sourceLang.value;
        const target = elements.targetLang.value;

        if (source !== 'auto') {
            elements.sourceLang.value = target;
            elements.targetLang.value = source;
            saveLanguageSettings();

            // 如果有结果，交换文本
            if (currentResult) {
                elements.sourceText.value = currentResult;
                updateCharCount();
            }
        }
    });

    // 语言选择变化
    elements.sourceLang.addEventListener('change', saveLanguageSettings);
    elements.targetLang.addEventListener('change', saveLanguageSettings);

    // 清空按钮
    elements.btnClear.addEventListener('click', () => {
        elements.sourceText.value = '';
        updateCharCount();
        clearResult();
    });

    // 粘贴按钮
    elements.btnPaste.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            elements.sourceText.value = text;
            updateCharCount();
        } catch (err) {
            console.error('粘贴失败:', err);
        }
    });

    // 翻译按钮
    elements.btnTranslate.addEventListener('click', handleTranslate);

    // 回车翻译 (Ctrl/Cmd + Enter)
    elements.sourceText.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            handleTranslate();
        }
    });

    // 朗读按钮
    elements.btnSpeak.addEventListener('click', () => {
        if (currentResult) {
            speak(currentResult, elements.targetLang.value);
        }
    });

    // 复制按钮
    elements.btnCopy.addEventListener('click', async () => {
        if (currentResult) {
            try {
                await navigator.clipboard.writeText(currentResult);
                showToast('已复制到剪贴板');
            } catch (err) {
                console.error('复制失败:', err);
            }
        }
    });

    // 收藏按钮
    elements.btnFavorite.addEventListener('click', async () => {
        if (currentResult && elements.sourceText.value) {
            await StorageManager.addFavorite({
                source: elements.sourceText.value,
                target: currentResult,
                sourceLang: elements.sourceLang.value,
                targetLang: elements.targetLang.value,
            });
            showToast('已添加到收藏');
            elements.btnFavorite.querySelector('svg').style.fill = 'var(--warning)';
        }
    });

    // 历史记录按钮
    elements.btnHistory.addEventListener('click', () => {
        chrome.tabs.create({ url: 'options/options.html#history' });
    });

    // 设置按钮
    elements.btnSettings.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    // 沉浸式翻译
    elements.btnImmersive.addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.id && !tab.url?.startsWith('chrome://')) {
                await chrome.tabs.sendMessage(tab.id, { action: 'toggleImmersive' });
                setTimeout(() => window.close(), 100);
            } else {
                showToast('此页面不支持该功能');
            }
        } catch (err) {
            showToast('请刷新页面后重试');
            console.error('沉浸式翻译失败:', err);
        }
    });

    // PDF 翻译
    elements.btnPdf.addEventListener('click', () => {
        chrome.tabs.create({ url: 'options/options.html#pdf' });
    });

    // 侧边栏
    elements.btnSidebar.addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.id && !tab.url?.startsWith('chrome://')) {
                await chrome.tabs.sendMessage(tab.id, { action: 'toggleSidebar' });
                setTimeout(() => window.close(), 100);
            } else {
                showToast('此页面不支持该功能');
            }
        } catch (err) {
            showToast('请刷新页面后重试');
            console.error('侧边栏失败:', err);
        }
    });

    // 悬浮窗
    elements.btnFloat.addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.id && !tab.url?.startsWith('chrome://')) {
                await chrome.tabs.sendMessage(tab.id, { action: 'toggleFloatWindow' });
                setTimeout(() => window.close(), 100);
            } else {
                showToast('此页面不支持该功能');
            }
        } catch (err) {
            showToast('请刷新页面后重试');
            console.error('悬浮窗失败:', err);
        }
    });

}


// 处理翻译
async function handleTranslate() {
    const text = elements.sourceText.value.trim();
    if (!text) return;
    if (text.length > MAX_CHARS) {
        showError('文本超出最大长度限制');
        return;
    }

    const sourceLang = elements.sourceLang.value;
    const targetLang = elements.targetLang.value;

    // 显示加载状态
    setLoading(true);
    clearResult();

    try {
        const result = await translator.translate(text, sourceLang, targetLang);
        currentResult = result.text;
        showResult(result.text);

        // 保存到历史记录
        await StorageManager.addHistory({
            source: text,
            target: result.text,
            sourceLang,
            targetLang,
            provider: result.provider,
        });
    } catch (error) {
        console.error('翻译失败:', error);
        showError(error.message || '翻译失败，请稍后重试');
    } finally {
        setLoading(false);
    }
}

// 检查选中文本
async function checkSelectedText() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' });
            if (response?.text) {
                elements.sourceText.value = response.text;
                updateCharCount();
                // 自动翻译
                handleTranslate();
            }
        }
    } catch (err) {
        // 可能是新标签页，忽略错误
    }
}

// 更新字符计数
function updateCharCount() {
    const len = elements.sourceText.value.length;
    elements.charCount.textContent = `${len} / ${MAX_CHARS}`;
}

// 设置加载状态
function setLoading(loading) {
    if (loading) {
        elements.btnTranslate.classList.add('loading');
        elements.btnTranslate.disabled = true;
        elements.btnTranslate.innerHTML = `
            <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="18" height="18" style="animation: spin 1s linear infinite">
                <path d="M12 2v4m0 12v4M4.22 4.22l2.83 2.83m8.5 8.5l2.83 2.83M2 12h4m12 0h4M4.22 19.78l2.83-2.83m8.5-8.5l2.83-2.83"/>
            </svg>
            翻译中...
        `;
    } else {
        elements.btnTranslate.classList.remove('loading');
        elements.btnTranslate.disabled = false;
        elements.btnTranslate.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18">
                <path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2v3M22 22l-5-10-5 10M14 18h6"/>
            </svg>
            翻译
        `;
    }
}



// 显示结果
function showResult(text) {
    elements.resultSection.classList.add('active');
    elements.resultContent.innerHTML = `<div class="result-text">${escapeHtml(text)}</div>`;
}


// 清空结果
function clearResult() {
    currentResult = '';
    elements.resultSection.classList.remove('active');
    elements.resultContent.innerHTML = '';
    elements.btnFavorite.querySelector('svg').style.fill = 'none';
}


// 显示错误
function showError(message) {
    elements.resultContent.innerHTML = `<div class="result-error" style="color: var(--error)">${escapeHtml(message)}</div>`;
}

// 更新服务显示
async function updateServiceDisplay() {
    const settings = await StorageManager.getSettings();
    const providerNames = {
        'google': 'Google 翻译',
        'openai': 'OpenAI GPT',
        'gemini': 'Google Gemini',
        'deepseek': 'DeepSeek',
        'offline': '离线翻译',
    };
    elements.currentService.textContent = providerNames[settings.provider] || 'Google 翻译';
}

// 朗读文本
function speak(text, lang) {
    const langMap = {
        'zh': 'zh-CN',
        'en': 'en-US',
        'ja': 'ja-JP',
        'ko': 'ko-KR',
    };

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langMap[lang] || lang;
    speechSynthesis.speak(utterance);
}

// 显示提示
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        padding: 8px 16px;
        background: var(--text-primary);
        color: white;
        border-radius: 20px;
        box-shadow: var(--shadow-lg);
        z-index: 1000;
        font-size: 13px;
        opacity: 0;
        transition: all 0.3s ease;
    `;
    document.body.appendChild(toast);

    // 触发动画
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.bottom = '20px';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.bottom = '10px';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}


// HTML 转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 初始化
document.addEventListener('DOMContentLoaded', init);
