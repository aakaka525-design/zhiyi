/**
 * Smart Translator - 内容脚本入口
 * 负责初始化和事件绑定
 */

var ST = window.SmartTranslator;

function mergeDefaults(raw) {
    const defaults = {
        provider: 'google',
        sourceLang: 'auto',
        targetLang: 'zh',
        openaiApiKey: '',
        openaiBaseUrl: 'https://api.openai.com/v1',
        openaiModel: 'gpt-4o-mini',
        geminiApiKey: '',
        geminiModel: 'gemini-2.5-flash',
        deepseekApiKey: '',
        deepseekBaseUrl: 'https://api.ppinfra.com/openai',
        deepseekModel: 'deepseek/deepseek-ocr',
        darkMode: false,
        ttsProvider: 'system',
        ttsVoice: '',
        ttsSpeed: 1.0,
        enableSelection: true,
        enableHover: false,
        enableShortcut: true,
        showFloatingBall: false,
        enableAdBlock: false,
        showOriginal: true,
        fontSize: 14,
        debugMode: false,
    };
    return { ...defaults, ...(raw || {}) };
}

/**
 * 加载设置
 */
async function loadSettings() {
    try {
        const settings = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('timeout')), 3000);
            chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
                clearTimeout(timer);
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
        ST.state.settings = settings;
        return settings;
    } catch (e) {
        console.warn('[智译] Service Worker 未就绪，直接读取存储:', e.message);
        const result = await chrome.storage.local.get('settings');
        const settings = mergeDefaults(result.settings || {});
        ST.state.settings = settings;
        return settings;
    }
}

/**
 * 绑定事件
 */
function bindEvents() {
    // 监听选中文本
    document.addEventListener('mouseup', ST.handleMouseUp);

    // 监听点击（关闭气泡）
    document.addEventListener('mousedown', ST.handleMouseDown);

    // 双击直接翻译
    document.addEventListener('dblclick', ST.handleDoubleClick);

    // 监听来自 background 或 popup 的消息
    chrome.runtime.onMessage.addListener(handleMessage);
}

/**
 * 处理消息
 */
function handleMessage(request, sender, sendResponse) {
    switch (request.action) {
        case 'getSelectedText':
            const text = window.getSelection().toString().trim();
            sendResponse({ text });
            break;

        case 'showTranslation':
            ST.showBubble(request.text);
            break;

        case 'toggleImmersive':
            ST.toggleImmersive();
            break;

        case 'translateSelection':
            const selectedText = window.getSelection().toString().trim();
            if (selectedText) {
                ST.showBubble(selectedText);
            }
            break;

        case 'toggleSidebar':
            ST.toggleSidebar();
            break;

        case 'toggleFloatWindow':
            ST.toggleFloatWindow();
            break;

        case 'refreshSettings':
            // 当设置更新时刷新
            loadSettings().then(() => {
                console.log('[智译] 设置已刷新');
            });
            break;
    }
}

// 监听 storage 变化自动刷新设置
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.settings) {
        ST.state.settings = mergeDefaults(changes.settings.newValue);
        if (ST.state.settings?.showFloatingBall === true && ST.floatingBall?.init) {
            ST.floatingBall.init();
        }
        console.log('[智译] 设置已自动更新');
    }
});

/**
 * 初始化
 */
async function init() {
    await loadSettings();
    bindEvents();
    if (ST.state.settings?.enableAdBlock === true && ST.adBlocker?.init) {
        ST.adBlocker.init();
    }
    if (ST.state.settings?.showFloatingBall === true && ST.floatingBall?.init) {
        ST.floatingBall.init();
    }
    console.log('[智译] 内容脚本已加载 (模块化版本)');
}

// 启动
init();
