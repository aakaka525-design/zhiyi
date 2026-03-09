/**
 * Google Gemini 翻译服务
 * 使用 Gemini 模型进行翻译
 */

export class GeminiTranslator {
    constructor(apiKey = '', model = 'gemini-2.5-flash') {
        this.apiKey = apiKey;
        this.model = model;
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    }

    /**
     * 更新配置
     */
    updateConfig(apiKey, model) {
        this.apiKey = apiKey || this.apiKey;
        this.model = model || this.model;
    }

    /**
     * 翻译文本
     */
    async translate(text, from = 'auto', to = 'zh') {
        if (!text || !text.trim()) {
            return '';
        }

        if (!this.apiKey) {
            throw new Error('请先配置 Gemini API Key');
        }

        const langNames = {
            'zh': '中文',
            'en': '英语',
            'ja': '日语',
            'ko': '韩语',
            'auto': '自动检测语言',
        };

        const sourceLang = langNames[from] || from;
        const targetLang = langNames[to] || to;

        const prompt = from === 'auto'
            ? `请将以下文本翻译成${targetLang}，只输出翻译结果，不要任何解释：\n\n${text}`
            : `请将以下${sourceLang}文本翻译成${targetLang}，只输出翻译结果，不要任何解释：\n\n${text}`;

        try {
            const response = await fetch(
                `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: prompt }]
                        }],
                        generationConfig: {
                            temperature: 0.3,
                            maxOutputTokens: 4096,
                        },
                        safetySettings: [
                            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                        ],
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();

            // 解析 Gemini 响应
            const result = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!result) {
                throw new Error('无法解析 Gemini 响应');
            }

            return result.trim();
        } catch (error) {
            console.error('Gemini 翻译失败:', error);
            throw error;
        }
    }

    /**
     * 批量翻译
     */
    async translateBatch(texts, from = 'auto', to = 'zh') {
        if (!texts || texts.length === 0) {
            return [];
        }

        if (!this.apiKey) {
            throw new Error('请先配置 Gemini API Key');
        }

        const langNames = {
            'zh': '中文',
            'en': '英语',
            'ja': '日语',
            'ko': '韩语',
        };

        const targetLang = langNames[to] || to;

        // 格式化输入
        const formattedInput = texts.map((t, i) => `[${i + 1}] ${t}`).join('\n');

        const prompt = `请将以下多段文本翻译成${targetLang}。

输入格式：每行以 [编号] 开头
输出格式：保持相同的编号格式，只输出翻译结果，不要任何解释

${formattedInput}`;

        try {
            const response = await fetch(
                `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: prompt }]
                        }],
                        generationConfig: {
                            temperature: 0.3,
                            maxOutputTokens: 8192,
                        },
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

            // 解析结果
            const lines = result.split('\n');
            const translations = new Array(texts.length).fill('');

            for (const line of lines) {
                const match = line.match(/^\[(\d+)\]\s*(.+)$/);
                if (match) {
                    const index = parseInt(match[1]) - 1;
                    if (index >= 0 && index < texts.length) {
                        translations[index] = match[2].trim();
                    }
                }
            }

            return translations;
        } catch (error) {
            console.error('Gemini 批量翻译失败:', error);
            // 回退到逐个翻译
            const results = [];
            for (const text of texts) {
                try {
                    results.push(await this.translate(text, from, to));
                } catch (e) {
                    results.push('');
                }
            }
            return results;
        }
    }
}
