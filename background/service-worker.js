/**
 * Service Worker - 后台脚本
 * 处理扩展的后台任务和消息
 * (Refactored Version)
 */

import { StorageManager } from '../src/core/storage.js';
import { Translator } from '../src/core/translator.js';

// Modules
import { handleTestTTS, handleTTSGLM, handleTTSOpenAI, handleTTSGoogle } from './modules/tts.js';
import { createContextMenus, setupMenuListeners } from './modules/menus.js';

// 翻译器实例
let translator = null;

// 初始化
async function init() {
    translator = new Translator();
    await translator.init();

    // 创建右键菜单
    createContextMenus();

    console.log('智译翻译插件已启动');
}

// 注册菜单监听器 (必须在顶层注册)
setupMenuListeners();

// 处理来自 popup 和 content script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    handleMessage(request, sender)
        .then(sendResponse)
        .catch(error => {
            console.error('消息处理错误:', error);
            sendResponse({ error: error.message });
        });

    return true; // 保持消息通道开启
});

async function handleMessage(request, sender) {
    if (!translator) {
        await init();
    }

    switch (request.action) {
        case 'translate':
            return translator.translate(request.text, request.from, request.to, request.provider);

        case 'translateBatch':
            const results = await translator.translateBatch(request.texts, request.from, request.to);
            return { results };

        case 'testTTS': return handleTestTTS(request);
        case 'ttsGLM': return handleTTSGLM(request);
        case 'ttsOpenAI': return handleTTSOpenAI(request);
        case 'ttsGoogle': return handleTTSGoogle(request);

        case 'getSettings':
            return StorageManager.getSettings();

        case 'getHistory':
            return StorageManager.getHistory();

        default:
            console.warn(`Unknown action: ${request.action}`);
            // Return undefined/null for unknown action to avoid error on client side if they sent a message meant for someone else?
            // Or return error.
            return { error: 'Unknown action' };
    }
}
