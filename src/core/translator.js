/**
 * 翻译服务统一接口
 * 支持多种翻译后端
 */

import { StorageManager } from './storage.js';
import { GoogleFreeTranslator } from './google-free.js';
import { OpenAITranslator } from './openai.js';
import { GeminiTranslator } from './gemini.js';
import { DeepSeekTranslator } from './deepseek.js';
import { OfflineTranslator } from './offline.js';



export class Translator {
    constructor() {
        this.providers = {};
        this.settings = null;
    }

    async init() {
        this.settings = await StorageManager.getSettings();

        // 初始化各翻译服务
        this.providers = {
            google: new GoogleFreeTranslator(),
            openai: new OpenAITranslator(this.settings.openaiApiKey, this.settings.openaiBaseUrl, this.settings.openaiModel),
            gemini: new GeminiTranslator(this.settings.geminiApiKey, this.settings.geminiModel),
            deepseek: new DeepSeekTranslator(this.settings.deepseekApiKey, this.settings.deepseekBaseUrl, this.settings.deepseekModel),
            offline: new OfflineTranslator(),
        };


    }

    /**
     * 刷新设置
     */
    async refreshSettings() {
        this.settings = await StorageManager.getSettings();

        // 更新 LLM 翻译器配置
        this.providers.openai.updateConfig(
            this.settings.openaiApiKey,
            this.settings.openaiBaseUrl,
            this.settings.openaiModel
        );
        this.providers.gemini.updateConfig(
            this.settings.geminiApiKey,
            this.settings.geminiModel
        );
        this.providers.deepseek.updateConfig(
            this.settings.deepseekApiKey,
            this.settings.deepseekBaseUrl,
            this.settings.deepseekModel
        );
    }



    /**
     * 翻译文本
     * @param {string} text 要翻译的文本
     * @param {string} from 源语言代码
     * @param {string} to 目标语言代码
     * @param {string} provider 指定翻译服务 (可选)
     * @returns {Promise<{text: string, provider: string}>}
     */
    async translate(text, from = 'auto', to = 'zh', provider = null) {
        // 使用指定的或默认的翻译服务
        const selectedProvider = provider || this.settings?.provider || 'google';

        // 检查服务可用性
        const translator = this.providers[selectedProvider];
        if (!translator) {
            throw new Error(`未知的翻译服务: ${selectedProvider}`);
        }

        // 检查 LLM 服务是否配置了 API Key
        if (selectedProvider === 'openai' && !this.settings?.openaiApiKey) {
            console.warn('OpenAI API Key 未配置，回退到 Google 翻译');
            return this.translate(text, from, to, 'google');
        }
        if (selectedProvider === 'gemini' && !this.settings?.geminiApiKey) {
            console.warn('Gemini API Key 未配置，回退到 Google 翻译');
            return this.translate(text, from, to, 'google');
        }
        if (selectedProvider === 'deepseek' && !this.settings?.deepseekApiKey) {
            console.warn('DeepSeek API Key 未配置，回退到 Google 翻译');
            return this.translate(text, from, to, 'google');
        }


        try {
            const result = await translator.translate(text, from, to);
            return {
                text: result,
                provider: selectedProvider,
                from,
                to,
            };
        } catch (error) {
            if (selectedProvider === 'offline') {
                throw error;
            }

            // 如果主服务失败，尝试回退到 Google 翻译
            if (selectedProvider !== 'google') {
                console.warn(`${selectedProvider} 翻译失败，回退到 Google 翻译:`, error);
                return this.translate(text, from, to, 'google');
            }

            // 如果 Google 也失败，尝试离线翻译
            if (selectedProvider !== 'offline') {
                console.warn('Google 翻译失败，尝试离线翻译:', error);
                try {
                    const offlineResult = await this.providers.offline.translate(text, from, to);
                    return {
                        text: offlineResult,
                        provider: 'offline',
                        from,
                        to,
                    };
                } catch (offlineError) {
                    throw error; // 返回原始错误
                }
            }

            throw error;
        }
    }

    /**
     * 批量翻译
     * @param {string[]} texts 文本数组
     * @param {string} from 源语言
     * @param {string} to 目标语言
     * @returns {Promise<string[]>}
     */
    async translateBatch(texts, from = 'auto', to = 'zh') {
        // 对于 LLM，可以合并请求
        const provider = this.settings?.provider || 'google';

        if (provider === 'openai' || provider === 'gemini') {
            const translator = this.providers[provider];
            if (translator.translateBatch) {
                try {
                    const batchResults = await translator.translateBatch(texts, from, to);
                    return this.fillMissingBatchResults(texts, batchResults, from, to);
                } catch (error) {
                    console.warn(`${provider} batch 翻译失败，回退到逐条翻译:`, error);
                }
            }
        }

        return this.translateBatchIndividually(texts, from, to);
    }

    async fillMissingBatchResults(texts, batchResults, from, to) {
        const normalizedResults = Array.isArray(batchResults) ? batchResults : [];
        const results = [];

        for (const [index, text] of texts.entries()) {
            if (normalizedResults[index]) {
                results.push(normalizedResults[index]);
                continue;
            }

            try {
                const result = await this.translate(text, from, to);
                results.push(result.text);
            } catch (error) {
                results.push('');
            }
        }

        return results;
    }

    async translateBatchIndividually(texts, from, to) {
        const results = [];
        for (const text of texts) {
            try {
                const result = await this.translate(text, from, to);
                results.push(result.text);
            } catch (error) {
                results.push('');
            }
        }
        return results;
    }

    /**
     * 检测语言
     * @param {string} text 文本
     * @returns {Promise<string>} 语言代码
     */
    async detectLanguage(text) {
        // 简单的语言检测
        const patterns = {
            zh: /[\u4e00-\u9fff]/,
            ja: /[\u3040-\u309f\u30a0-\u30ff]/,
            ko: /[\uac00-\ud7af\u1100-\u11ff]/,
        };

        for (const [lang, pattern] of Object.entries(patterns)) {
            if (pattern.test(text)) {
                // 日语检测需要更精确，因为也包含汉字
                if (lang === 'ja' || lang === 'ko' || (lang === 'zh' && !patterns.ja.test(text))) {
                    return lang;
                }
            }
        }

        return 'en'; // 默认英语
    }

    /**
     * 获取可用的翻译服务
     */
    getAvailableProviders() {
        const available = ['google', 'offline'];

        if (this.settings?.openaiApiKey) {
            available.push('openai');
        }
        if (this.settings?.geminiApiKey) {
            available.push('gemini');
        }
        if (this.settings?.deepseekApiKey) {
            available.push('deepseek');
        }


        return available;
    }
}
