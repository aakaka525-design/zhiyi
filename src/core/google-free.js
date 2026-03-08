/**
 * Google 免费翻译服务
 * 使用公开接口，无需 API Key
 */

export class GoogleFreeTranslator {
    constructor() {
        this.baseUrl = 'https://translate.googleapis.com/translate_a/single';
    }

    /**
     * 翻译文本
     * @param {string} text 要翻译的文本
     * @param {string} from 源语言 (auto 表示自动检测)
     * @param {string} to 目标语言
     * @returns {Promise<string>} 翻译结果
     */
    async translate(text, from = 'auto', to = 'zh') {
        if (!text || !text.trim()) {
            return '';
        }

        // 语言代码映射
        const langMap = {
            'zh': 'zh-CN',
            'en': 'en',
            'ja': 'ja',
            'ko': 'ko',
            'auto': 'auto',
        };

        const sourceLang = langMap[from] || from;
        const targetLang = langMap[to] || to;

        const params = new URLSearchParams({
            client: 'gtx',
            sl: sourceLang,
            tl: targetLang,
            dt: 't',       // 返回翻译文本
            dj: '1',       // 返回 JSON 格式
            q: text,
        });

        try {
            const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // 解析响应
            if (data.sentences && Array.isArray(data.sentences)) {
                return data.sentences
                    .map(s => s.trans)
                    .filter(Boolean)
                    .join('');
            }

            throw new Error('无法解析翻译结果');
        } catch (error) {
            console.error('Google 翻译失败:', error);

            // 尝试备用方法
            return this.translateFallback(text, from, to);
        }
    }

    /**
     * 备用翻译方法
     * 使用不同的接口格式
     */
    async translateFallback(text, from, to) {
        const langMap = {
            'zh': 'zh-CN',
            'en': 'en',
            'ja': 'ja',
            'ko': 'ko',
            'auto': 'auto',
        };

        const sourceLang = langMap[from] || from;
        const targetLang = langMap[to] || to;

        // 备用接口
        const params = new URLSearchParams({
            client: 'dict-chrome-ex',
            sl: sourceLang,
            tl: targetLang,
            q: text,
        });

        try {
            const response = await fetch(`https://clients5.google.com/translate_a/t?${params.toString()}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            // 这个接口返回格式不同
            if (Array.isArray(data)) {
                if (typeof data[0] === 'string') {
                    return data[0];
                }
                if (Array.isArray(data[0])) {
                    return data[0].map(item => item[0]).join('');
                }
            }

            throw new Error('备用接口解析失败');
        } catch (error) {
            console.error('备用翻译也失败:', error);
            throw new Error('翻译服务暂时不可用，请稍后重试');
        }
    }

    /**
     * 检测语言
     * @param {string} text 文本
     * @returns {Promise<string>} 语言代码
     */
    async detectLanguage(text) {
        const params = new URLSearchParams({
            client: 'gtx',
            sl: 'auto',
            tl: 'en',
            dt: 't',
            dj: '1',
            q: text.substring(0, 100), // 只检测前100个字符
        });

        try {
            const response = await fetch(`${this.baseUrl}?${params.toString()}`);
            const data = await response.json();

            return data.src || 'en';
        } catch (error) {
            console.error('语言检测失败:', error);
            return 'en';
        }
    }
}
