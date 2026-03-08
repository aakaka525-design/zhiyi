/**
 * DeepSeek OCR 翻译服务
 * 使用 DeepSeek-OCR 模型进行文本识别和翻译
 */

export class DeepSeekTranslator {
    constructor(apiKey = '', baseUrl = 'https://api.ppinfra.com/openai', model = 'deepseek/deepseek-ocr') {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.model = model;
    }

    /**
     * 更新配置
     */
    updateConfig(apiKey, baseUrl, model) {
        this.apiKey = apiKey || this.apiKey;
        this.baseUrl = baseUrl || this.baseUrl;
        this.model = model || this.model;
    }

    /**
     * 翻译文本 (DeepSeek-OCR 也可以作为普通对话模型使用)
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
            const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
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
            });

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

    /**
     * 使用 DeepSeek-OCR 进行图片 OCR 翻译
     */
    async translateImage(imageBase64, to = 'zh') {
        if (!this.apiKey) {
            throw new Error('请先配置 DeepSeek API Key');
        }

        const langNames = {
            'zh': '中文',
            'en': '英语',
            'ja': '日语',
            'ko': '韩语',
        };

        const targetLang = langNames[to] || to;
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

        const prompt = `请识别图片中的所有文字，然后翻译成${targetLang}。
请按以下格式输出：
【原文】
(图片中识别到的原文)

【译文】
(翻译后的文字)`;

        try {
            const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: prompt },
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: `data:image/png;base64,${base64Data}`
                                    }
                                }
                            ]
                        }
                    ],
                    temperature: 0.1,
                }),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content?.trim() || '';
        } catch (error) {
            console.error('DeepSeek 图片翻译失败:', error);
            throw error;
        }
    }

    /**
     * 使用 DeepSeek-OCR 进行漫画翻译 (带边界框)
     * 注意：DeepSeek-OCR 可能不如 Gemini 对坐标识别精准，但我们可以尝试引导它
     */
    async translateImageWithBoxes(imageBase64, to = 'zh') {
        if (!this.apiKey) {
            throw new Error('请先配置 DeepSeek API Key');
        }

        const langNames = {
            'zh': '中文',
            'en': '英语',
            'ja': '日语',
            'ko': '韩语',
        };

        const targetLang = langNames[to] || to;
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

        // 简化提示词，更直接地要求 JSON 输出
        const prompt = `识别图片中所有文字区域并翻译成${targetLang}。

输出格式要求：仅输出一个JSON数组，不要markdown代码块，不要解释。
每个元素格式：{"original": "原文", "translated": "译文", "box_2d": [y1, x1, y2, x2]}
坐标归一化到0-1000。

示例：[{"original": "Hello", "translated": "你好", "box_2d": [100, 50, 150, 200]}]`;

        try {
            const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: prompt },
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: `data:image/png;base64,${base64Data}`
                                    }
                                }
                            ]
                        }
                    ],
                    temperature: 0.1,
                    // 移除 response_format，部分模型不支持
                }),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const resultText = data.choices?.[0]?.message?.content?.trim() || '';

            console.log('[DeepSeek OCR] 原始响应:', resultText.substring(0, 500));

            if (!resultText) {
                console.warn('[DeepSeek OCR] 模型返回空内容');
                return { boxes: [], raw: '' };
            }

            try {
                // 尝试多种方式提取 JSON
                let jsonStr = resultText;

                // 1. 移除 markdown 代码块
                if (jsonStr.includes('```json')) {
                    jsonStr = jsonStr.match(/```json\s*([\s\S]*?)\s*```/)?.[1] || jsonStr;
                } else if (jsonStr.includes('```')) {
                    jsonStr = jsonStr.match(/```\s*([\s\S]*?)\s*```/)?.[1] || jsonStr;
                }

                // 2. 尝试提取 JSON 数组
                const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
                if (arrayMatch) {
                    jsonStr = arrayMatch[0];
                }

                // 3. 尝试提取 JSON 对象 (如果返回的是 {boxes: [...]} 格式)
                if (!arrayMatch) {
                    const objMatch = jsonStr.match(/\{[\s\S]*\}/);
                    if (objMatch) {
                        jsonStr = objMatch[0];
                    }
                }

                const parsed = JSON.parse(jsonStr);
                let boxes = [];

                if (Array.isArray(parsed)) {
                    boxes = parsed;
                } else if (parsed.boxes && Array.isArray(parsed.boxes)) {
                    boxes = parsed.boxes;
                } else if (parsed.results && Array.isArray(parsed.results)) {
                    boxes = parsed.results;
                }

                console.log('[DeepSeek OCR] 解析成功, 文字区域数:', boxes.length);
                return { boxes, raw: resultText };
            } catch (parseErr) {
                console.error('[DeepSeek OCR] JSON 解析失败:', parseErr.message);
                console.error('[DeepSeek OCR] 原始内容:', resultText);

                // 如果完全无法解析，返回空结果而不是抛出错误
                // 这样可以避免阻塞翻译队列
                return { boxes: [], raw: resultText };
            }
        } catch (error) {
            console.error('DeepSeek 漫画翻译失败:', error);
            throw error;
        }
    }
}

