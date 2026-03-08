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

    /**
     * 使用 Gemini Vision 进行图片 OCR 翻译
     * Gemini 支持多模态，可以直接识别图片中的文字并翻译
     */
    async translateImage(imageBase64, to = 'zh') {
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

        // 移除 data URL 前缀
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

        const prompt = `请识别图片中的所有文字，然后翻译成${targetLang}。

请按以下格式输出：
【原文】
(图片中识别到的原文)

【译文】
(翻译后的文字)`;

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
                            parts: [
                                { text: prompt },
                                {
                                    inlineData: {
                                        mimeType: 'image/png',
                                        data: base64Data,
                                    }
                                }
                            ]
                        }],
                        generationConfig: {
                            temperature: 0.3,
                            maxOutputTokens: 4096,
                        },
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        } catch (error) {
            console.error('Gemini 图片翻译失败:', error);
            throw error;
        }
    }

    /**
     * 使用 Gemini Vision 进行图片 OCR 翻译，返回带边界框的结构化数据
     * 用于漫画翻译，实现文字叠加到原图对话框位置
     */
    async translateImageWithBoxes(imageBase64, to = 'zh') {
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

        // 移除 data URL 前缀
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

        const prompt = `你是一个漫画OCR翻译专家。请识别图片中所有的文字区域（如对话框、旁白、音效等），并翻译成${targetLang}。

请以JSON数组格式输出，每个元素包含：
- "original": 原文文字
- "translated": 翻译后的文字  
- "box_2d": 文字区域边界框 [ymin, xmin, ymax, xmax]，坐标归一化到0-1000

示例输出格式：
[
  {"original": "Hello!", "translated": "你好！", "box_2d": [100, 200, 150, 400]},
  {"original": "What?", "translated": "什么？", "box_2d": [300, 100, 350, 250]}
]

只输出JSON数组，不要其他解释。`;

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
                            parts: [
                                { text: prompt },
                                {
                                    inlineData: {
                                        mimeType: 'image/png',
                                        data: base64Data,
                                    }
                                }
                            ]
                        }],
                        generationConfig: {
                            temperature: 0.2,
                            maxOutputTokens: 8192,
                            responseMimeType: 'application/json',
                        },
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '[]';

            // 解析 JSON（处理可能被截断的情况）
            try {
                const boxes = JSON.parse(resultText);
                return { boxes, raw: resultText };
            } catch (parseErr) {
                console.warn('解析 JSON 失败，尝试修复截断的 JSON:', parseErr.message);

                // 尝试修复截断的 JSON 数组
                let fixedJson = resultText;

                // 如果以 [ 开头但没有正确结束，尝试修复
                if (fixedJson.startsWith('[')) {
                    // 找到最后一个完整的对象（以 } 结尾）
                    const lastCompleteObject = fixedJson.lastIndexOf('}');
                    if (lastCompleteObject > 0) {
                        fixedJson = fixedJson.substring(0, lastCompleteObject + 1) + ']';
                        try {
                            const boxes = JSON.parse(fixedJson);
                            console.log('成功修复截断的 JSON，提取到', boxes.length, '个文字框');
                            return { boxes, raw: resultText };
                        } catch (e) {
                            // 继续尝试其他方法
                        }
                    }
                }

                // 尝试逐个提取完整的 JSON 对象
                const objectMatches = resultText.match(/\{[^{}]*"box_2d"\s*:\s*\[[^\]]+\][^{}]*\}/g);
                if (objectMatches && objectMatches.length > 0) {
                    try {
                        const boxes = objectMatches.map(obj => JSON.parse(obj));
                        console.log('通过正则提取到', boxes.length, '个文字框');
                        return { boxes, raw: resultText };
                    } catch (e) {
                        console.error('正则提取也失败:', e);
                    }
                }

                // 最后尝试手动提取完整的 JSON 数组
                const jsonMatch = resultText.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    try {
                        return { boxes: JSON.parse(jsonMatch[0]), raw: resultText };
                    } catch (e) { }
                }

                console.error('无法解析 OCR 结果，原始内容:', resultText.substring(0, 500));
                return { boxes: [], raw: resultText };
            }
        } catch (error) {
            console.error('Gemini 图片翻译 (带边界框) 失败:', error);
            throw error;
        }
    }
}

