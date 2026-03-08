/**
 * 广告屏蔽模块 - 隐藏和移除页面广告
 */

(function () {
    'use strict';

    // 广告选择器列表 (更精确，避免误伤)
    const AD_SELECTORS = [
        // Google Ads (精确匹配)
        '#google_ads_iframe',
        '.adsbygoogle',
        'ins.adsbygoogle',
        'iframe[id^="google_ads_frame"]',
        'iframe[src*="googlesyndication.com"]',
        'iframe[src*="doubleclick.net"]',

        // 精确广告类名 (完整匹配，避免误伤 reader/download 等)
        '.ad-container',
        '.ad-wrapper',
        '.ad-banner',
        '.ad-box',
        '.ads-container',
        '.ads-wrapper',
        '.advertisement',
        '.advertisement-container',
        '.sponsored-content',
        '#ad-container',
        '#ad-wrapper',
        '#advertisement',

        // 弹窗广告
        '.popup-ad',
        '.modal-ad',
        '.overlay-ad',
        '.interstitial-ad',
        '#popup-ad',
        '#modal-ad',

        // 常见广告平台
        '[class*="taboola"]',
        '[class*="outbrain"]',
        '[id*="taboola"]',
        '[id*="outbrain"]',
        '.mgid-widget',

        // ============ MangaDNA / WordPress漫画站专用 ============
        '.madara-container-nativead',
        '.widget-ads',
        '.widget_starter-starter-native-ad',
        '#mpcnt',  // MangaDNA 广告容器
        '.mctnt',
        '[class*="native-ad"]',
        '[id*="native-ad"]',
        '.c-blog__heading-ads',
        '.c-sidebar-a-ads',
        '.entry-content > div[style*="text-align: center"] > a[target="_blank"]',  // 内容中的广告链接
        'a[href*="bit.ly"]',  // 短链广告
        'a[href*="cpmstar"]',
        'a[href*="exoclick"]',
        'a[href*="juicyads"]',

        // 悬浮/固定广告
        '.sticky-ad',
        '.fixed-ad',
        '.float-ad',
        '.bottom-ad',
        '.top-ad',

        // ============ 漫画网站专用广告选择器 ============
        // 通用漫画站广告
        '[class*="comic-ad"]',
        '[class*="manga-ad"]',
        '[id*="comic-ad"]',
        '[id*="manga-ad"]',
        '.chapter-ad',
        '.reader-ad',
        '#reader-ad',

        // ExHentai / E-Hentai
        '.adsbox',
        '#ads',
        '.nbw',

        // Toonily / Manhwa 类
        '.c-ads',
        '.ads-banner',
        '[class*="wp-manga-ad"]',
        '.ads-holder',
        '#text-ads',
        '.text-ads',

        // MangaDex 类
        '.ad-slot',
        '.ad-unit',

        // 漫画柜 / 漫画岛 类中文站
        '.ad-left',
        '.ad-right',
        '.ad-top',
        '.ad-bottom',
        '.float-ads',
        '#floatAd',
        '.guanggao',

        // 18+ 漫画站常见
        '.exo-zone',
        '[id^="exoclick"]',
        '[class*="trafficjunky"]',
        '[class*="juicyads"]',
        'iframe[src*="exoclick"]',
        'iframe[src*="trafficjunky"]',
        'iframe[src*="juicyads"]',
        'iframe[src*="popads"]',
        'iframe[src*="popcash"]',

        // 全屏遮罩广告 (移除了过于激进的 z-index 选择器，避免误伤漫画内容)
        'div[id^="div-gpt-ad"]',

        // 假按钮/假关闭
        '.fake-close',
        '.ad-close-fake',
    ];

    // 弹窗容器选择器
    const POPUP_SELECTORS = [
        '.modal[style*="display: block"]',
        '.popup[style*="display: block"]',
        '[class*="overlay"][style*="display: block"]',
    ];

    let observer = null;
    let styleElement = null;

    // 注入隐藏广告的 CSS
    const injectStyles = () => {
        if (styleElement) return;

        styleElement = document.createElement('style');
        styleElement.id = 'st-ad-blocker-styles';
        styleElement.textContent = `
            ${AD_SELECTORS.join(',\n')} {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
                height: 0 !important;
                width: 0 !important;
                overflow: hidden !important;
            }
        `;
        document.head.appendChild(styleElement);
    };

    // 移除隐藏样式
    const removeStyles = () => {
        if (styleElement) {
            styleElement.remove();
            styleElement = null;
        }
    };

    // 移除广告元素 (更保守，避免误伤内容)
    const removeAds = () => {
        AD_SELECTORS.forEach(selector => {
            try {
                document.querySelectorAll(selector).forEach(el => {
                    // 不移除插件自身元素
                    if (el.closest('#st-')) return;
                    // 不移除包含大量图片的元素 (可能是漫画内容)
                    if (el.querySelectorAll('img').length > 2) return;
                    // 不移除漫画阅读器容器
                    if (el.closest('.reading-content, .chapter-content, .manga-content, #manga-content, .comic-page, .reader-content')) return;
                    el.remove();
                });
            } catch (e) {
                // 选择器可能无效，忽略
            }
        });
    };

    // 检测并关闭弹窗广告
    const closePopupAds = () => {
        POPUP_SELECTORS.forEach(selector => {
            try {
                document.querySelectorAll(selector).forEach(el => {
                    // 检查是否是广告弹窗（包含广告相关词汇或属性）
                    const text = el.innerText?.toLowerCase() || '';
                    const className = el.className?.toLowerCase() || '';
                    const id = el.id?.toLowerCase() || '';

                    const isAdPopup =
                        className.includes('ad') ||
                        id.includes('ad') ||
                        text.includes('广告') ||
                        text.includes('advertisement') ||
                        text.includes('sponsored') ||
                        text.includes('推广');

                    if (isAdPopup && !el.closest('#st-')) {
                        el.remove();
                        // 同时移除可能的遮罩层
                        document.querySelectorAll('[class*="backdrop"], [class*="mask"]').forEach(mask => {
                            if (mask.style.position === 'fixed' || mask.style.position === 'absolute') {
                                mask.remove();
                            }
                        });
                    }
                });
            } catch (e) {
                // 忽略
            }
        });
    };

    // 恢复页面滚动（有些广告弹窗会禁用滚动）
    const restoreScroll = () => {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        document.body.style.position = '';
    };

    // 点击劫持防护 - 阻止隐藏的广告链接和弹窗
    let clickProtectionEnabled = false;
    const enableClickProtection = () => {
        if (clickProtectionEnabled) return;
        clickProtectionEnabled = true;

        // 强力拦截 window.open (阻止所有非本站的弹窗)
        const originalOpen = window.open;
        window.open = function (...args) {
            const url = args[0] || '';

            // 允许空 URL 或本站链接
            if (!url || url.includes(window.location.hostname) || url.startsWith('/') || url.startsWith('#')) {
                return originalOpen.apply(this, args);
            }

            // 阻止所有外部弹窗 (大多数是广告)
            console.log('[智译] 已阻止外部弹窗:', url.substring(0, 100));
            return null;
        };

        // 注意：移除了之前的 mousedown 处理器，因为它会误删正常内容

        // 页面级点击拦截 (捕获阶段) - 更保守，避免误删内容
        document.addEventListener('click', (e) => {
            const target = e.target;

            // 1. 检查全屏透明覆盖层 (这是造成"点哪都弹广告"的元凶)
            // 只有满足所有以下条件才会移除：
            if (target.tagName === 'DIV' || target.tagName === 'A') {
                const rect = target.getBoundingClientRect();
                const style = window.getComputedStyle(target);
                const zIndex = parseInt(style.zIndex) || 0;

                // 必须同时满足：
                // 1. 接近全屏大小
                const isFullScreen = rect.width >= window.innerWidth * 0.95 && rect.height >= window.innerHeight * 0.95;
                // 2. 完全透明或接近透明
                const isTransparent = parseFloat(style.opacity) < 0.05;
                // 3. 非常高的 z-index（明显是覆盖层）
                const isHighZIndex = zIndex > 9999;
                // 4. 没有可见的子元素（排除正常容器）
                const hasNoVisibleChildren = target.children.length === 0 ||
                    Array.from(target.children).every(child => {
                        const childStyle = window.getComputedStyle(child);
                        return parseFloat(childStyle.opacity) < 0.05;
                    });
                // 5. 不是插件元素
                const notPluginElement = !target.id?.startsWith('st-') && !target.closest('#st-');

                // 只有全部满足才移除
                if (isFullScreen && isTransparent && isHighZIndex && hasNoVisibleChildren && notPluginElement) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    target.remove();
                    console.log('[智译] 已移除全屏透明点击劫持层');
                    return false;
                }
            }

            // 2. 检查普通链接点击
            if (target.tagName === 'A' || target.closest('a')) {
                const link = target.tagName === 'A' ? target : target.closest('a');
                const href = link.href || '';
                const style = window.getComputedStyle(link);
                const linkTarget = link.target || '';

                // 检测可疑的广告链接
                const isSuspicious =
                    // 透明链接
                    (parseFloat(style.opacity) < 0.1) ||
                    // 可疑的广告域名
                    /click\.|track\.|popup\.|ad\.|ads\.|redirect\.|banner|popunder/i.test(href) ||
                    // 18+ 广告联盟常用词
                    /exo|juicy|traffic|propeller|popcash|popads/i.test(href) ||
                    // 在新窗口打开的可疑域名后缀
                    (linkTarget === '_blank' && /\.(xyz|top|club|site|online|work|buzz)/i.test(href));

                if (isSuspicious && !href.includes(window.location.hostname)) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    console.log('[智译] 已阻止可疑点击劫持链接:', href);
                    return false;
                }
            }
        }, true); // 使用捕获阶段，确保在这里就截断事件流

        // 定期清理可疑覆盖层
        setInterval(() => {
            document.querySelectorAll('div[style*="z-index: 9999"], div[style*="z-index:9999"], a[style*="z-index"]').forEach(el => {
                const style = window.getComputedStyle(el);
                const zIndex = parseInt(style.zIndex) || 0;
                const rect = el.getBoundingClientRect();
                const isFullScreen = rect.width > window.innerWidth * 0.7 && rect.height > window.innerHeight * 0.7;

                if (zIndex > 9999 && isFullScreen && !el.closest('#st-')) {
                    el.remove();
                    console.log('[智译] 已清理高 z-index 覆盖层');
                }
            });
        }, 3000);
    };


    // 启动 DOM 观察器
    const startObserver = () => {
        if (observer) return;

        observer = new MutationObserver((mutations) => {
            let hasNewAds = false;

            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // 检查是否是广告元素
                            const isAd = AD_SELECTORS.some(selector => {
                                try {
                                    return node.matches?.(selector) || node.querySelector?.(selector);
                                } catch {
                                    return false;
                                }
                            });
                            if (isAd) hasNewAds = true;
                        }
                    }
                }
            }

            if (hasNewAds) {
                removeAds();
                closePopupAds();
                restoreScroll();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    };

    // 停止观察器
    const stopObserver = () => {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
    };

    // 启用广告屏蔽
    const enable = () => {
        injectStyles();
        removeAds();
        closePopupAds();
        restoreScroll();
        enableClickProtection();
        startObserver();
        console.log('[智译] 广告屏蔽已启用');
    };

    // 禁用广告屏蔽
    const disable = () => {
        removeStyles();
        stopObserver();
        console.log('[智译] 广告屏蔽已禁用');
    };

    // 初始化
    const init = () => {
        const settings = window.ST?.state?.settings || {};
        if (settings.enableAdBlock !== false) {
            enable();
        }

        // 监听设置变化
        chrome.storage.onChanged.addListener((changes) => {
            if (changes.settings?.newValue) {
                const newSettings = changes.settings.newValue;
                if (newSettings.enableAdBlock === false) {
                    disable();
                } else {
                    enable();
                }
            }
        });
    };

    // 导出
    window.ST = window.ST || {};
    ST.adBlocker = { init, enable, disable };

    // 页面加载后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
