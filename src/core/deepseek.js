/**
 * DeepSeek 翻译服务
 */

import { fetchWithTimeout } from './fetch-with-timeout.js';

export class DeepSeekTranslator {
    constructor(apiKey = '', baseUrl = 'https://api.ppinfra.com/openai', model = 'deepseek/deepseek-ocr') {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.model = model;
    }

    /**
     * 更新配置
     */
    updateConfig(apiKey, baseUrl, model) {
        this.apiKey = apiKey !== undefined ? apiKey : this.apiKey;
        if (baseUrl !== undefined) {
            this.baseUrl = baseUrl.replace(/\/$/, '');
        }
        this.model = model !== undefined ? model : this.model;
    }

    /**
     * 翻译文本
     */
    async translate(text, from = 'auto', to = 'zh') {
        if (!text || !text.trim()) {
            return '';
        }

        if (!this.apiKey) {
            throw new Error('请先配置 DeepSeek API Key');
        }

        const langNames = {
            'zh': '中文',
            'en': '英语',
            'ja': '日语',
            'ko': '韩语',
            'auto': '自动检测语言',
        };

        const targetLang = langNames[to] || to;
        const prompt = `请将以下文本翻译成${targetLang}，只输出翻译结果，不要任何解释：\n\n${text}`;

        try {
            const response = await fetchWithTimeout(`${this.baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.3,
                }),
            }, 20000, '翻译请求超时');

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content?.trim() || '';
        } catch (error) {
            console.error('DeepSeek 翻译失败:', error);
            throw error;
        }
    }
}
