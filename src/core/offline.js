/**
 * 离线翻译服务
 * 使用本地词典进行基础翻译
 */

export class OfflineTranslator {
    constructor() {
        this.dictionaries = {};
        this.loaded = false;
    }

    /**
     * 加载词典
     */
    async loadDictionaries() {
        if (this.loaded) return;

        try {
            // 尝试加载词典文件
            const dictFiles = [
                { key: 'en-zh', path: '/assets/dictionaries/en-zh.json' },
                { key: 'ja-zh', path: '/assets/dictionaries/ja-zh.json' },
                { key: 'ko-zh', path: '/assets/dictionaries/ko-zh.json' },
            ];

            for (const { key, path } of dictFiles) {
                try {
                    const url = chrome.runtime.getURL(path);
                    const response = await fetch(url);
                    if (response.ok) {
                        this.dictionaries[key] = await response.json();
                    }
                } catch (e) {
                    console.warn(`加载词典 ${key} 失败:`, e);
                    this.dictionaries[key] = {};
                }
            }

            this.loaded = true;
        } catch (error) {
            console.error('加载词典失败:', error);
        }
    }

    /**
     * 翻译文本
     */
    async translate(text, from = 'auto', to = 'zh') {
        await this.loadDictionaries();

        if (!text || !text.trim()) {
            return '';
        }

        // 确定源语言
        let sourceLang = from;
        if (from === 'auto') {
            sourceLang = this.detectLanguage(text);
        }

        // 如果目标语言和源语言相同，直接返回
        if (sourceLang === to) {
            return text;
        }

        // 选择词典
        const dictKey = `${sourceLang}-${to}`;
        const dict = this.dictionaries[dictKey];

        if (!dict || Object.keys(dict).length === 0) {
            throw new Error('离线词典不可用');
        }

        // 尝试整句匹配
        const lowerText = text.toLowerCase().trim();
        if (dict[lowerText]) {
            return dict[lowerText];
        }

        // 分词翻译
        const words = this.tokenize(text, sourceLang);
        const translations = [];

        for (const word of words) {
            const lowerWord = word.toLowerCase();
            if (dict[lowerWord]) {
                translations.push(dict[lowerWord]);
            } else {
                // 如果找不到翻译，保留原文
                translations.push(word);
            }
        }

        return translations.join(' ');
    }

    /**
     * 简单的语言检测
     */
    detectLanguage(text) {
        // CJK 字符范围
        const cjkPattern = /[\u4e00-\u9fff]/;
        const japanesePattern = /[\u3040-\u309f\u30a0-\u30ff]/;
        const koreanPattern = /[\uac00-\ud7af\u1100-\u11ff]/;

        if (japanesePattern.test(text)) {
            return 'ja';
        }
        if (koreanPattern.test(text)) {
            return 'ko';
        }
        if (cjkPattern.test(text)) {
            return 'zh';
        }

        return 'en';
    }

    /**
     * 简单分词
     */
    tokenize(text, lang) {
        if (lang === 'zh' || lang === 'ja') {
            // 中日文按字符分
            return text.split('');
        }

        // 英韩文按空格分
        return text.split(/\s+/).filter(Boolean);
    }
}
