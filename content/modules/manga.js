/**
 * Smart Translator - 漫画翻译模块
 * 沉浸式漫画翻译，自动检测并翻译图片中的文字
 */

var ST = window.SmartTranslator;

/**
 * 调试日志 - 仅在 debugMode 开启时输出
 */
function debugLog(...args) {
    if (ST.state.settings?.debugMode) {
        console.log('[智译漫画]', ...args);
    }
}

/**
 * 切换漫画翻译模式
 */
ST.toggleMangaMode = function () {
    if (ST.state.isMangaModeEnabled) {
        // 关闭漫画模式
        if (ST.observers.manga) {
            ST.observers.manga.disconnect();
            ST.observers.manga = null;
        }
        ST.state.isMangaModeEnabled = false;
        ST.translatedImages.clear();
        ST.mangaQueue.items = [];
        ST.mangaQueue.processing = 0;
        ST.showToast('已关闭沉浸式漫画翻译');
        return;
    }

    ST.state.isMangaModeEnabled = true;
    ST.showToast('沉浸式漫画翻译已开启 - 滚动页面自动翻译图片');

    // 创建 IntersectionObserver
    ST.observers.manga = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                // 获取图片 URL - 支持多种懒加载属性
                const src = (img.src || img.dataset?.src || img.dataset?.lazySrc ||
                    img.dataset?.original || img.dataset?.lazyload ||
                    img.currentSrc || img.getAttribute('data-src') || '').trim();

                if (!src || ST.translatedImages.has(src)) return;
                if (ST.isPluginElement(img)) return;

                const lowerSrc = src.toLowerCase();
                if (lowerSrc.includes('.svg') || lowerSrc.includes('.gif') ||
                    lowerSrc.includes('data:image/svg') || lowerSrc.includes('favicon')) {
                    ST.observers.manga.unobserve(img);
                    return;
                }

                if (lowerSrc.includes('logo') || lowerSrc.includes('icon') ||
                    lowerSrc.includes('avatar') || lowerSrc.includes('ads') ||
                    lowerSrc.includes('banner')) {
                    ST.observers.manga.unobserve(img);
                    return;
                }

                const rect = entry.boundingClientRect;
                let imgWidth = img.naturalWidth || rect.width || img.width;
                let imgHeight = img.naturalHeight || rect.height || img.height;

                // 等待图片加载
                if (imgWidth < 50 || imgHeight < 50) {
                    if (!img.complete) {
                        img.addEventListener('load', function onLoad() {
                            img.removeEventListener('load', onLoad);
                            if (img.naturalWidth >= 200 && img.naturalHeight >= 200) {
                                if (!ST.translatedImages.has(src)) {
                                    ST.translatedImages.add(src);
                                    ST.mangaQueue.items.push({ src, img });
                                    ST.processNextManga();
                                }
                            }
                        }, { once: true });
                    }
                    ST.observers.manga.unobserve(img);
                    return;
                }

                // 跳过太小的图片 (但给予一定容忍度)
                if (imgWidth < 150 || imgHeight < 150) {
                    ST.observers.manga.unobserve(img);
                    return;
                }

                // 跳过横向 Banner
                if (imgWidth > imgHeight * 3) {
                    ST.observers.manga.unobserve(img);
                    return;
                }

                debugLog(`图片入队: ${imgWidth} x ${imgHeight}`, src);

                ST.translatedImages.add(src);
                ST.observers.manga.unobserve(img);
                ST.mangaQueue.items.push({ src, img });
                ST.processNextManga();
            }
        });
    }, {
        root: null,
        rootMargin: '7500px',  // 漫画图片通常很长(8000px+)，需要足够大的预加载区域
        threshold: 0.01,
    });

    ST.observeAllImages();

    // 监听 DOM 变化
    if (!ST.observers.mangaMutation) {
        ST.observers.mangaMutation = new MutationObserver(() => {
            if (ST.state.isMangaModeEnabled) {
                ST.observeAllImages();
            }
        });
        ST.observers.mangaMutation.observe(document.body, { childList: true, subtree: true });
    }
};

/**
 * 处理漫画翻译队列
 */
ST.processNextManga = async function () {
    if (!ST.state.isMangaModeEnabled) {
        ST.mangaQueue.items = [];
        ST.mangaQueue.processing = 0;
        return;
    }

    debugLog(`队列状态: ${ST.mangaQueue.items.length} 待处理, ${ST.mangaQueue.processing} 处理中`);

    if (ST.mangaQueue.processing >= ST.mangaQueue.maxConcurrent || ST.mangaQueue.items.length === 0) {
        if (ST.mangaQueue.items.length === 0 && ST.mangaQueue.processing === 0) {
            debugLog('队列已清空');
        }
        return;
    }

    ST.mangaQueue.processing++;
    const { src, img } = ST.mangaQueue.items.shift();
    const imgIndex = ST.translatedImages.size;

    debugLog(`开始翻译 #${imgIndex}:`, src.substring(0, 80) + '...');

    try {
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('翻译超时(60s)')), 60000)
        );

        await Promise.race([
            ST.handleOCR(src, img),
            timeoutPromise
        ]);

        debugLog(`✓ 翻译完成 #${imgIndex}`);
    } catch (err) {
        console.error(`[智译漫画] ✗ 翻译失败 #${imgIndex}:`, err.message);
    } finally {
        ST.mangaQueue.processing--;
        // 立即处理下一个，不要等待
        ST.processNextManga();
    }
};

/**
 * 观察所有图片
 */
ST.observeAllImages = function () {
    if (!ST.observers.manga) return;

    const images = document.querySelectorAll('img');

    images.forEach(img => {
        // 获取图片 URL - 支持多种懒加载属性
        const src = (img.src || img.dataset?.src || img.dataset?.lazySrc ||
            img.dataset?.original || img.dataset?.lazyload ||
            img.currentSrc || img.getAttribute('data-src') || '').trim();
        if (!src) return;
        if (ST.translatedImages.has(src)) return;
        if (ST.isPluginElement(img)) return;

        const lowerSrc = src.toLowerCase();
        if (lowerSrc.includes('logo') || lowerSrc.includes('icon') ||
            lowerSrc.includes('avatar') || lowerSrc.includes('favicon') ||
            lowerSrc.includes('banner') || lowerSrc.includes('.svg') ||
            lowerSrc.includes('.gif')) {
            return;
        }

        ST.observers.manga.observe(img);
    });
};

console.log('[智译] Manga module loaded');
