/**
 * Smart Translator - 内容脚本入口
 * 负责初始化和事件绑定
 */

var ST = window.SmartTranslator;

/**
 * 加载设置
 */
async function loadSettings() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getSettings' }, (settings) => {
            ST.state.settings = settings;
            resolve(settings);
        });
    });
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

        case 'ocrImage':
            if (request.imageUrl) {
                ST.handleOCR(request.imageUrl);
            }
            break;

        case 'startOCR':
            ST.startImageAreaSelection();
            break;

        case 'toggleSidebar':
            ST.toggleSidebar();
            break;

        case 'toggleFloatWindow':
            ST.toggleFloatWindow();
            break;

        case 'toggleMangaMode':
            ST.toggleMangaMode();
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
        ST.state.settings = changes.settings.newValue;
        console.log('[智译] 设置已自动更新');
    }
});

/**
 * 初始化
 */
async function init() {
    await loadSettings();
    bindEvents();
    ST.createSidebar();
    ST.createFloatWindow();
    if (ST.floatingBall && ST.floatingBall.init) {
        ST.floatingBall.init();
    }
    console.log('[智译] 内容脚本已加载 (模块化版本)');
}

// 启动
init();
