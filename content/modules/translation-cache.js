/**
 * 翻译缓存模块 - 持久化存储翻译结果
 * 使用 localStorage 存储，刷新后保留译文
 */

(function () {
    'use strict';

    const CACHE_PREFIX = 'st_manga_cache_';
    const CACHE_EXPIRY_DAYS = 7;  // 缓存7天

    /**
     * 获取当前页面的缓存键
     */
    function getCacheKey() {
        // 使用 URL pathname 作为缓存键（去除查询参数）
        return CACHE_PREFIX + window.location.pathname;
    }

    /**
     * 保存翻译结果到缓存
     * @param {string} imageSrc - 图片 URL
     * @param {Array} boxes - 翻译框数据
     */
    function saveTranslation(imageSrc, boxes) {
        try {
            const cacheKey = getCacheKey();
            let cache = JSON.parse(localStorage.getItem(cacheKey) || '{}');

            // 创建图片 URL 的哈希作为键（避免长 URL）
            const imageKey = hashString(imageSrc);

            cache[imageKey] = {
                boxes: boxes,
                timestamp: Date.now(),
                src: imageSrc.substring(0, 100)  // 保存部分 URL 用于调试
            };

            localStorage.setItem(cacheKey, JSON.stringify(cache));
            console.log('[智译缓存] 已保存翻译:', imageKey);
        } catch (e) {
            console.warn('[智译缓存] 保存失败:', e.message);
        }
    }

    /**
     * 从缓存获取翻译结果
     * @param {string} imageSrc - 图片 URL
     * @returns {Array|null} - 翻译框数据或 null
     */
    function getTranslation(imageSrc) {
        try {
            const cacheKey = getCacheKey();
            const cache = JSON.parse(localStorage.getItem(cacheKey) || '{}');
            const imageKey = hashString(imageSrc);

            const entry = cache[imageKey];
            if (!entry) return null;

            // 检查是否过期
            const ageMs = Date.now() - entry.timestamp;
            const expiryMs = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

            if (ageMs > expiryMs) {
                // 过期，删除
                delete cache[imageKey];
                localStorage.setItem(cacheKey, JSON.stringify(cache));
                return null;
            }

            console.log('[智译缓存] 命中缓存:', imageKey);
            return entry.boxes;
        } catch (e) {
            console.warn('[智译缓存] 读取失败:', e.message);
            return null;
        }
    }

    /**
     * 检查图片是否有缓存
     */
    function hasCache(imageSrc) {
        return getTranslation(imageSrc) !== null;
    }

    /**
     * 清除当前页面的缓存
     */
    function clearPageCache() {
        try {
            localStorage.removeItem(getCacheKey());
            console.log('[智译缓存] 已清除当前页面缓存');
        } catch (e) {
            console.warn('[智译缓存] 清除失败:', e.message);
        }
    }

    /**
     * 清除所有翻译缓存
     */
    function clearAllCache() {
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(CACHE_PREFIX)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
            console.log('[智译缓存] 已清除所有缓存, 共', keysToRemove.length, '项');
        } catch (e) {
            console.warn('[智译缓存] 清除失败:', e.message);
        }
    }

    /**
     * 简单的字符串哈希函数
     */
    function hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;  // Convert to 32bit integer
        }
        return 'img_' + Math.abs(hash).toString(36);
    }

    // 导出到全局
    window.ST = window.ST || {};
    window.ST.translationCache = {
        save: saveTranslation,
        get: getTranslation,
        has: hasCache,
        clearPage: clearPageCache,
        clearAll: clearAllCache
    };

    console.log('[智译] Translation cache module loaded');
})();
