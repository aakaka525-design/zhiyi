/**
 * Smart Translator - 工具函数模块
 * 通用工具函数和辅助方法
 */

var ST = window.SmartTranslator;
const DEFAULT_GOOGLE_TTS_VOICES = Object.freeze({
    zh: 'cmn-CN-Chirp3-HD-Aoede',
    en: 'en-US-Chirp3-HD-Fenrir',
    ja: 'ja-JP-Wavenet-A',
    ko: 'ko-KR-Wavenet-A',
});

/**
 * Promise 封装消息发送到 Background
 */
ST.sendMessage = function (message, timeoutMs = 0, timeoutMessage = '请求超时') {
    const request = new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(response);
            }
        });
    });

    if (timeoutMs <= 0) return request;

    let timeoutId;
    return Promise.race([
        request,
        new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
        }),
    ]).finally(() => clearTimeout(timeoutId));
};

/**
 * 显示页面 Toast 提示
 */
ST.showToast = function (message) {
    const oldToast = document.getElementById('st-toast');
    if (oldToast) oldToast.remove();

    const toast = document.createElement('div');
    toast.id = 'st-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

/**
 * 检测文本语言
 * @param {string} text 文本内容
 * @returns {string} 语言代码: 'zh', 'ja', 'ko', 'en'
 */
ST.detectLanguage = function (text) {
    if (!text || text.length === 0) return 'en';

    let cjkCount = 0;
    let hiraganaCount = 0;
    let katakanaCount = 0;
    let hangulCount = 0;
    let latinCount = 0;
    let totalCount = 0;

    for (const char of text) {
        const code = char.codePointAt(0);

        if (code <= 0x0020 || (code >= 0x2000 && code <= 0x206F)) {
            continue;
        }
        totalCount++;

        // CJK 统一表意文字
        if ((code >= 0x4E00 && code <= 0x9FFF) ||
            (code >= 0x3400 && code <= 0x4DBF) ||
            (code >= 0xF900 && code <= 0xFAFF) ||
            (code >= 0x20000 && code <= 0x2A6DF)) {
            cjkCount++;
        }
        // 平假名
        else if (code >= 0x3040 && code <= 0x309F) {
            hiraganaCount++;
        }
        // 片假名
        else if (code >= 0x30A0 && code <= 0x30FF) {
            katakanaCount++;
        }
        // 谚文
        else if (code >= 0xAC00 && code <= 0xD7AF) {
            hangulCount++;
        }
        // 拉丁字母
        else if ((code >= 0x0041 && code <= 0x005A) || (code >= 0x0061 && code <= 0x007A)) {
            latinCount++;
        }
    }

    if (totalCount === 0) return 'en';

    // 日语：假名占比超过 20%
    const kanaCount = hiraganaCount + katakanaCount;
    if (kanaCount / totalCount > 0.2) {
        return 'ja';
    }

    // 韩语：超过 30% 是谚文
    if (hangulCount / totalCount > 0.3) {
        return 'ko';
    }

    // 中文：超过 30% 是 CJK 字符
    if (cjkCount / totalCount > 0.3) {
        return 'zh';
    }

    return 'en';
};

ST.getDefaultGoogleTtsVoice = function (lang) {
    return DEFAULT_GOOGLE_TTS_VOICES[lang] || DEFAULT_GOOGLE_TTS_VOICES.zh;
};

/**
 * 判断是否是插件自身元素
 */
ST.isPluginElement = function (el) {
    return el.id === 'smart-translator-icon' ||
        el.id === 'smart-translator-bubble' ||
        el.closest('#smart-translator-bubble') ||
        el.closest('#st-sidebar') ||
        el.closest('#st-float-window') ||
        el.closest('#st-floating-ball-container') ||
        el.closest('#st-toast');
};

/**
 * 进度条控制
 */
let _hideProgressTimerId = null;

ST.showProgress = function () {
    if (_hideProgressTimerId) {
        clearTimeout(_hideProgressTimerId);
        _hideProgressTimerId = null;
    }
    if (!ST.ui.progress) {
        ST.ui.progress = document.createElement('div');
        ST.ui.progress.id = 'st-page-progress';
        document.body.appendChild(ST.ui.progress);
    }
    ST.ui.progress.style.width = '0%';
    ST.ui.progress.style.display = 'block';
};

ST.updateProgress = function (percent) {
    if (ST.ui.progress) {
        ST.ui.progress.style.width = `${percent}%`;
    }
};

ST.hideProgress = function () {
    if (ST.ui.progress) {
        ST.ui.progress.style.width = '100%';
        _hideProgressTimerId = setTimeout(() => {
            ST.ui.progress.style.display = 'none';
            _hideProgressTimerId = null;
        }, 500);
    }
};

/**
 * System TTS with Chromium onend bug workaround.
 * Falls back to polling speaking/pending after playback has started.
 */
ST.speakSystemWithGuard = function (text, lang, speed) {
    return new Promise((resolve, reject) => {
        const langMap = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP', ko: 'ko-KR' };
        const resolvedLang = !lang || lang === 'auto' ? ST.detectLanguage(text) : lang;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = speed;
        utterance.lang = langMap[resolvedLang] || resolvedLang;

        let settled = false;
        let hasStarted = false;
        let pollId = null;
        let pollCount = 0;

        const settle = (fn) => {
            if (settled) return;
            settled = true;
            if (pollId) clearInterval(pollId);
            fn();
        };

        utterance.onstart = () => { hasStarted = true; };
        utterance.onend = () => settle(resolve);
        utterance.onerror = (event) => settle(() => reject(new Error(event.error || '朗读失败')));

        pollId = setInterval(() => {
            pollCount++;
            if (hasStarted && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
                settle(resolve);
            } else if (!hasStarted && pollCount >= 10) {
                window.speechSynthesis.cancel();
                settle(() => reject(new Error('系统朗读启动超时')));
            }
        }, 500);

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    });
};

console.log('[智译] Utils module loaded');
