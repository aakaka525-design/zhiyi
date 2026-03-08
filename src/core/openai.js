/**
 * OpenAI 翻译服务
 * 使用 GPT 模型进行高质量翻译
 */

export class OpenAITranslator {
    constructor(apiKey = '', baseUrl = 'https://api.openai.com/v1', model = 'gpt-4o-mini') {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl.replace(/\/$/, ''); // 移除尾部斜杠
        this.model = model;
    }

    /**
     * 更新配置
     */
    updateConfig(apiKey, baseUrl, model) {
        this.apiKey = apiKey || this.apiKey;
        this.baseUrl = (baseUrl || this.baseUrl).replace(/\/$/, '');
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
            throw new Error('请先配置 OpenAI API Key');
        }

        const langNames = {
            'zh': '中文',
            'en': '英语',
            'ja': '日语',
            'ko': '韩语',
            'auto': '自动检测',
        };

        const sourceLang = langNames[from] || from;
        const targetLang = langNames[to] || to;

        const systemPrompt = `你是一个专业的翻译助手。请将用户输入的文本翻译成${targetLang}。
要求：
1. 只输出翻译结果，不要添加任何解释或额外内容
2. 保持原文的语气和风格
3. 对于专业术语，使用该领域的标准译法
4. 对于人名、地名等专有名词，保留原文并在括号内注明译名（如适用）`;

        const userPrompt = from === 'auto'
            ? text
            : `请将以下${sourceLang}文本翻译成${targetLang}：\n\n${text}`;

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt },
                    ],
                    temperature: 0.3,
                    max_tokens: 4096,
                }),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content?.trim() || '';
        } catch (error) {
            console.error('OpenAI 翻译失败:', error);
            throw error;
        }
    }

    /**
     * 批量翻译 - 利用 GPT 的长上下文能力
     */
    async translateBatch(texts, from = 'auto', to = 'zh') {
        if (!texts || texts.length === 0) {
            return [];
        }

        if (!this.apiKey) {
            throw new Error('请先配置 OpenAI API Key');
        }

        const langNames = {
            'zh': '中文',
            'en': '英语',
            'ja': '日语',
            'ko': '韩语',
        };

        const targetLang = langNames[to] || to;

        // 格式化输入，使用编号便于解析
        const formattedInput = texts.map((t, i) => `[${i + 1}] ${t}`).join('\n');

        const systemPrompt = `你是一个专业的翻译助手。请将用户输入的多段文本翻译成${targetLang}。

输入格式：每行以 [编号] 开头
输出格式：保持相同的编号格式，只输出翻译结果

要求：
1. 保持原文的语气和风格
2. 每段翻译独立，但要注意上下文连贯性
3. 不要添加任何解释或额外内容`;

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: formattedInput },
                    ],
                    temperature: 0.3,
                    max_tokens: 8192,
                }),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const result = data.choices?.[0]?.message?.content?.trim() || '';

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
            console.error('OpenAI 批量翻译失败:', error);
            // 回退到逐个翻译
            const results = [];
            for (const text of texts) {
                try {
                    results.push(await this.translate(text, from, to));
                } catch (e) {
                    results.push(''); // 翻译失败的条目返回空
                }
            }
            return results;
        }
    }
}
