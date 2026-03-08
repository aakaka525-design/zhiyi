/**
 * Smart Translator - 工具函数模块
 * 通用工具函数和辅助方法
 */

var ST = window.SmartTranslator;

/**
 * Promise 封装消息发送到 Background
 */
ST.sendMessage = function (message) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(response);
            }
        });
    });
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
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        background: rgba(141, 163, 153, 0.95);
        color: #fff;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 12px;
        font-size: 14px;
        font-weight: 500;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 2147483647;
        animation: st-fade-in 0.3s ease;
    `;
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
        const code = char.charCodeAt(0);

        if (code <= 0x0020 || (code >= 0x2000 && code <= 0x206F)) {
            continue;
        }
        totalCount++;

        // CJK 统一表意文字
        if (code >= 0x4E00 && code <= 0x9FFF) {
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

    // 日语：包含平假名或片假名
    if (hiraganaCount > 0 || katakanaCount > 0) {
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

/**
 * 判断是否是插件自身元素
 */
ST.isPluginElement = function (el) {
    return el.id === 'smart-translator-icon' ||
        el.id === 'smart-translator-bubble' ||
        el.closest('#smart-translator-bubble') ||
        el.closest('#st-sidebar') ||
        el.closest('#st-float-window') ||
        el.closest('#st-toast');
};

/**
 * 进度条控制
 */
ST.showProgress = function () {
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
        setTimeout(() => {
            ST.ui.progress.style.display = 'none';
        }, 500);
    }
};

console.log('[智译] Utils module loaded');
