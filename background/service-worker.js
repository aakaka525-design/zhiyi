/**
 * Service Worker - 后台脚本
 * 处理扩展的后台任务和消息
 * (Refactored Version)
 */

import { StorageManager } from '../src/core/storage.js';
import { Translator } from '../src/core/translator.js';

// Modules
import { routeMessage } from './modules/message-router.js';
import { handleTTSGLM, handleTTSOpenAI, handleTTSGoogle, playAudioViaOffscreen, stopAudioViaOffscreen } from './modules/tts.js';
import { createContextMenus, setupMenuListeners } from './modules/menus.js';

// 翻译器实例
let translator = null;
const SETTINGS_STORAGE_KEY = 'settings';
const COMMAND_ACTION_MAP = {
    translate_selection: 'translateSelection',
    toggle_immersive: 'toggleImmersive',
    toggle_sidebar: 'toggleSidebar',
    toggle_float_window: 'toggleFloatWindow',
};

const INSTALLED_MIGRATIONS = [
    async function migrateLegacyOptInDefaults(details) {
        if (details.reason !== 'update') {
            return;
        }

        const result = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
        const storedSettings =
            result[SETTINGS_STORAGE_KEY] &&
            typeof result[SETTINGS_STORAGE_KEY] === 'object' &&
            !Array.isArray(result[SETTINGS_STORAGE_KEY])
                ? result[SETTINGS_STORAGE_KEY]
                : {};
        const updates = {};

        if (!Object.prototype.hasOwnProperty.call(storedSettings, 'showFloatingBall')) {
            updates.showFloatingBall = true;
        }
        if (!Object.prototype.hasOwnProperty.call(storedSettings, 'enableAdBlock')) {
            updates.enableAdBlock = true;
        }
        if (Object.keys(updates).length === 0) {
            return;
        }

        await chrome.storage.local.set({
            [SETTINGS_STORAGE_KEY]: {
                ...storedSettings,
                ...updates,
            },
        });
    },
];

// 初始化
async function init() {
    translator = new Translator();
    await translator.init();

    // 创建右键菜单
    createContextMenus();

    console.log('智译翻译插件已启动');
}

export function createEnsureReadyManager({ init, getTranslator, resetTranslator }) {
    let initPromise = null;

    return async function ensureReady() {
        const readyTranslator = getTranslator();
        if (readyTranslator) {
            return readyTranslator;
        }

        if (!initPromise) {
            initPromise = (async () => init())()
                .catch((error) => {
                    resetTranslator();
                    throw error;
                })
                .finally(() => {
                    initPromise = null;
                });
        }

        await initPromise;
        return getTranslator();
    };
}

const ensureReady = createEnsureReadyManager({
    init,
    getTranslator: () => translator,
    resetTranslator: () => {
        translator = null;
    },
});

// 注册菜单监听器 (必须在顶层注册)
setupMenuListeners();

chrome.runtime.onInstalled.addListener((details) => {
    runInstalledMigrations(details).catch((error) => {
        console.error('安装迁移失败:', error);
    });
});

chrome.commands.onCommand.addListener((command) => {
    forwardCommandToActiveTab(command).catch((error) => {
        console.error('快捷键处理失败:', error);
    });
});

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
    const readyTranslator = await ensureReady();

    return routeMessage(request, {
        translator: readyTranslator,
        storage: StorageManager,
        tts: {
            handleTTSGLM,
            handleTTSOpenAI,
            handleTTSGoogle,
            playAudioViaOffscreen,
            stopAudioViaOffscreen,
        },
    });
}

async function forwardCommandToActiveTab(command) {
    const action = COMMAND_ACTION_MAP[command];
    if (!action) {
        return;
    }

    const settings = await StorageManager.getSettings();
    if (settings.enableShortcut === false) {
        return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
        return;
    }

    try {
        await chrome.tabs.sendMessage(tab.id, { action });
    } catch (error) {
        console.warn(`快捷键消息转发失败: ${command}`, error);
    }
}

async function runInstalledMigrations(details) {
    for (const migrate of INSTALLED_MIGRATIONS) {
        await migrate(details);
    }
}
