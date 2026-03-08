/**
 * 存储管理工具
 * 统一管理 Chrome Storage API
 */

const STORAGE_KEYS = {
    SETTINGS: 'settings',
    HISTORY: 'history',
    FAVORITES: 'favorites',
};

const DEFAULT_SETTINGS = {
    provider: 'google',     // 翻译服务: google, openai, gemini, offline
    sourceLang: 'auto',
    targetLang: 'zh',

    // OpenAI 配置
    openaiApiKey: '',
    openaiBaseUrl: 'https://api.openai.com/v1',
    openaiModel: 'gpt-4o-mini',

    // Gemini 配置
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-flash',

    // DeepSeek 配置
    deepseekApiKey: '',
    deepseekBaseUrl: 'https://api.ppinfra.com/openai',
    deepseekModel: 'deepseek/deepseek-ocr',


    // 漫画翻译引擎: qwenvl-30b, qwenvl-8b, gemini, custom
    mangaOcrEngine: 'qwenvl-30b',

    // OCR 检测器类型: 'server' (精度高,较慢) 或 'mobile' (速度快,稍弱)
    ocrDetectorType: 'server',

    // 自定义漫画 API 配置
    customMangaApiKey: '',
    customMangaBaseUrl: '',
    customMangaModel: '',
    mangaFontStyle: 'sans-serif', // 漫画嵌字字体: sans-serif, rounded, handwritten, serif
    darkMode: false, // 深色模式

    // TTS 语音合成配置
    ttsProvider: 'system', // system, openai, edge, fish
    ttsVoice: '', // 具体声音ID，留空使用默认
    ttsSpeed: 1.0, // 语速 0.5-2.0

    // Fish Audio 配置
    fishAudioApiKey: '',
    fishAudioVoice: '', // Fish Audio 声音ID

    // 功能开关
    enableSelection: true,    // 划词翻译
    enableHover: false,       // 悬停翻译
    enableShortcut: true,     // 快捷键

    // 显示设置
    showOriginal: true,       // 沉浸式翻译显示原文
    fontSize: 14,

    // 调试模式
    debugMode: false,         // 显示识别框和控制台日志
};

const MAX_HISTORY = 500;
const MAX_FAVORITES = 200;

export class StorageManager {
    /**
     * 获取设置
     */
    static async getSettings() {
        try {
            const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
            return { ...DEFAULT_SETTINGS, ...result[STORAGE_KEYS.SETTINGS] };
        } catch (error) {
            console.error('获取设置失败:', error);
            return DEFAULT_SETTINGS;
        }
    }

    /**
     * 更新设置
     */
    static async updateSettings(updates) {
        try {
            const current = await this.getSettings();
            const newSettings = { ...current, ...updates };
            await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: newSettings });
            return newSettings;
        } catch (error) {
            console.error('更新设置失败:', error);
            throw error;
        }
    }

    /**
     * 获取历史记录
     */
    static async getHistory() {
        try {
            const result = await chrome.storage.local.get(STORAGE_KEYS.HISTORY);
            return result[STORAGE_KEYS.HISTORY] || [];
        } catch (error) {
            console.error('获取历史记录失败:', error);
            return [];
        }
    }

    /**
     * 添加历史记录
     */
    static async addHistory(item) {
        try {
            const history = await this.getHistory();
            const newItem = {
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                ...item,
            };

            // 去重：如果源文本相同，移除旧记录
            const filtered = history.filter(h => h.source !== item.source);

            // 添加到开头
            filtered.unshift(newItem);

            // 限制数量
            const trimmed = filtered.slice(0, MAX_HISTORY);

            await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: trimmed });
            return newItem;
        } catch (error) {
            console.error('添加历史记录失败:', error);
            throw error;
        }
    }

    /**
     * 删除历史记录
     */
    static async removeHistory(id) {
        try {
            const history = await this.getHistory();
            const filtered = history.filter(h => h.id !== id);
            await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: filtered });
        } catch (error) {
            console.error('删除历史记录失败:', error);
            throw error;
        }
    }

    /**
     * 清空历史记录
     */
    static async clearHistory() {
        try {
            await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: [] });
        } catch (error) {
            console.error('清空历史记录失败:', error);
            throw error;
        }
    }

    /**
     * 获取收藏
     */
    static async getFavorites() {
        try {
            const result = await chrome.storage.local.get(STORAGE_KEYS.FAVORITES);
            return result[STORAGE_KEYS.FAVORITES] || [];
        } catch (error) {
            console.error('获取收藏失败:', error);
            return [];
        }
    }

    /**
     * 添加收藏
     */
    static async addFavorite(item) {
        try {
            const favorites = await this.getFavorites();

            // 检查是否已收藏
            if (favorites.some(f => f.source === item.source)) {
                return null; // 已存在
            }

            const newItem = {
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                ...item,
            };

            favorites.unshift(newItem);

            // 限制数量
            const trimmed = favorites.slice(0, MAX_FAVORITES);

            await chrome.storage.local.set({ [STORAGE_KEYS.FAVORITES]: trimmed });
            return newItem;
        } catch (error) {
            console.error('添加收藏失败:', error);
            throw error;
        }
    }

    /**
     * 删除收藏
     */
    static async removeFavorite(id) {
        try {
            const favorites = await this.getFavorites();
            const filtered = favorites.filter(f => f.id !== id);
            await chrome.storage.local.set({ [STORAGE_KEYS.FAVORITES]: filtered });
        } catch (error) {
            console.error('删除收藏失败:', error);
            throw error;
        }
    }

    /**
     * 检查是否已收藏
     */
    static async isFavorite(sourceText) {
        const favorites = await this.getFavorites();
        return favorites.some(f => f.source === sourceText);
    }

    /**
     * 导出数据
     */
    static async exportData() {
        const [settings, history, favorites] = await Promise.all([
            this.getSettings(),
            this.getHistory(),
            this.getFavorites(),
        ]);

        return {
            version: '1.0.0',
            exportTime: new Date().toISOString(),
            settings,
            history,
            favorites,
        };
    }

    /**
     * 导入数据
     */
    static async importData(data) {
        if (!data || !data.version) {
            throw new Error('无效的数据格式');
        }

        await Promise.all([
            data.settings && this.updateSettings(data.settings),
            data.history && chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: data.history }),
            data.favorites && chrome.storage.local.set({ [STORAGE_KEYS.FAVORITES]: data.favorites }),
        ]);
    }
}
