/**
 * Qwen-VL 翻译服务
 * 使用 Qwen3-VL 模型进行图片 OCR 和翻译，支持边界框输出
 * 通过 ppinfra API 访问，成本比 Gemini 低很多
 */

export class QwenVLTranslator {
    // 默认使用 30B 模型，坐标更准确
    constructor(apiKey = '', baseUrl = 'https://api.ppinfra.com/openai', model = 'qwen/qwen3-vl-30b-a3b-instruct') {
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
     * 翻译文本
     */
    async translate(text, from = 'auto', to = 'zh') {
        if (!text || !text.trim()) {
            return '';
        }

        if (!this.apiKey) {
            throw new Error('请先配置 Qwen-VL API Key');
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
            console.error('Qwen-VL 翻译失败:', error);
            throw error;
        }
    }

    /**
     * 使用 Qwen-VL 进行图片 OCR 翻译
     */
    async translateImage(imageBase64, to = 'zh') {
        if (!this.apiKey) {
            throw new Error('请先配置 Qwen-VL API Key');
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
            console.error('Qwen-VL 图片翻译失败:', error);
            throw error;
        }
    }

    /**
     * 使用 Qwen-VL 进行漫画翻译 (带边界框)
     * Qwen-VL 支持返回坐标，是 Gemini 的低成本替代方案
     */
    async translateImageWithBoxes(imageBase64, to = 'zh') {
        if (!this.apiKey) {
            throw new Error('请先配置 Qwen-VL API Key');
        }

        const langNames = {
            'zh': '中文',
            'en': '英语',
            'ja': '日语',
            'ko': '韩语',
        };

        const targetLang = langNames[to] || to;
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

        const prompt = `你是一个漫画翻译助手。请仔细识别图片中所有的文字对话框并翻译。

**任务：**
1. 找出图片中每一个包含文字的区域（对话框、旁白、音效等）
2. 识别每个区域的文字内容
3. 翻译成${targetLang}
4. 精确标注每个区域的位置坐标

**坐标规则（非常重要）：**
- 坐标格式: [y1, x1, y2, x2]，表示矩形框的 [上边界, 左边界, 下边界, 右边界]
- 坐标值范围: 0-1000（归一化坐标）
- 图片左上角是 (0,0)，右下角是 (1000,1000)
- y1 < y2, x1 < x2

**输出格式（严格遵守）：**
只输出 JSON 数组，不要任何解释或 markdown：
[{"original":"原文","translated":"译文","box_2d":[y1,x1,y2,x2]}]

**示例：**
如果图片顶部中间有一个说"Hello"的对话框，宽200高50：
[{"original":"Hello","translated":"你好","box_2d":[50,400,100,600]}]`;

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
            const resultText = data.choices?.[0]?.message?.content?.trim() || '';

            console.log('[Qwen-VL OCR] 原始响应:', resultText.substring(0, 500));

            if (!resultText) {
                console.warn('[Qwen-VL OCR] 模型返回空内容');
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

                const parsed = JSON.parse(jsonStr);
                let boxes = Array.isArray(parsed) ? parsed : (parsed.boxes || parsed.results || []);

                console.log('[Qwen-VL OCR] 解析成功, 文字区域数:', boxes.length);
                return { boxes, raw: resultText };
            } catch (parseErr) {
                console.error('[Qwen-VL OCR] JSON 解析失败:', parseErr.message);
                console.error('[Qwen-VL OCR] 原始内容:', resultText);
                return { boxes: [], raw: resultText };
            }
        } catch (error) {
            console.error('Qwen-VL 漫画翻译失败:', error);
            throw error;
        }
    }
}
