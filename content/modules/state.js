/**
 * Smart Translator - 状态管理模块
 * 管理全局状态和 UI 元素引用
 */

// 创建全局命名空间
window.SmartTranslator = window.SmartTranslator || {};

// 当前状态
window.SmartTranslator.state = {
    selection: {
        text: '',
        range: null,
        rect: null,
    },
    settings: null,
    isImmersiveEnabled: false,
    isMangaModeEnabled: false,
};

// 已处理的集合
window.SmartTranslator.translatedImages = new Set();
window.SmartTranslator.pendingTranslations = new Set();

// 漫画翻译队列
window.SmartTranslator.mangaQueue = {
    items: [],
    processing: 0,
    maxConcurrent: 2,
};

// 观察器引用
window.SmartTranslator.observers = {
    mutation: null,
    manga: null,
};

// UI 元素引用
window.SmartTranslator.ui = {
    icon: null,
    bubble: null,
    progress: null,
    sidebar: null,
    sidebarBtn: null,
    floatWindow: null,
};

console.log('[智译] State module loaded');
