/**
 * Smart Translator - 沉浸式翻译模块
 * 全页面双语对照翻译
 */

var ST = window.SmartTranslator;
const EXCLUDE_SELECTORS = [
    'nav', 'header', 'footer', 'aside',
    'button', 'a', 'input', 'select', 'label',
    '.Header', '.AppHeader', '.pagehead',
    '.btn', '.Button', '.Counter', '.Label',
    '.sidebar', '.menu', '.toolbar',
    'pre', 'code', 'kbd', 'samp', 'var',
    '[translate="no"]', '[role="code"]',
    '.highlight',
    '.sr-only'
];

function getImmersiveMinLength(el, isTwitter) {
    if (isTwitter) return 5;
    if (el.matches('[id^="message-content-"], h1, h2, h3, h4, h5, h6, li, td, th, figcaption, dt, dd, caption')) return 2;
    return 20;
}

function isExcludedByImmersiveContext(el) {
    for (const selector of EXCLUDE_SELECTORS) {
        if (el.matches(selector)) return true;

        const ancestor = el.closest(selector);
        if (!ancestor) continue;

        if ((ancestor.tagName === 'HEADER' || ancestor.tagName === 'FOOTER') &&
            ancestor.closest('article, section')) {
            continue;
        }

        return true;
    }

    return false;
}

const HARD_PROTECTED_SELECTORS = 'pre, [translate="no"], [role="code"], .highlight';
const isGitHub = window.location.hostname === 'github.com';
const isLinkedIn = window.location.hostname === 'linkedin.com' ||
    window.location.hostname === 'www.linkedin.com' ||
    window.location.hostname.endsWith('.linkedin.com');
const GITHUB_METADATA_ANCESTORS = [
    '.react-directory-row',
    '.js-navigation-item',
    '[data-testid="repos-file-tree"]',
    '.file-info',
    '.Breadcrumb',
    '[aria-labelledby="folders-and-files"]',
];
const LINKEDIN_METADATA_ANCESTORS = [
    '[data-job-id]',
];

function containsHardProtectedContent(el) {
    return el.querySelector(HARD_PROTECTED_SELECTORS) !== null;
}

function isGitHubMetadataContext(el) {
    if (!isGitHub) return false;
    for (const sel of GITHUB_METADATA_ANCESTORS) {
        if (el.closest(sel)) return true;
    }
    return false;
}

function isLinkedInMetadataContext(el) {
    if (!isLinkedIn) return false;
    for (const sel of LINKEDIN_METADATA_ANCESTORS) {
        if (el.closest(sel)) return true;
    }
    return false;
}

function filterContainedImmersiveElements(elements) {
    const elementSet = new Set(elements);
    return elements.filter(el => {
        let parent = el.parentNode;
        while (parent) {
            if (elementSet.has(parent)) return false;
            parent = parent.parentNode;
        }
        return true;
    });
}

const IMMERSIVE_BATCH_SIZE = 10;
const GENERIC_SELECTORS = 'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption';
const DISCORD_GENERIC_SELECTORS = 'p, h1, h2, h3, h4, h5, h6, td, th, blockquote, figcaption, dt, dd, caption';
const DISCORD_CHAT_GENERIC_SELECTORS = 'p, h4, h5, h6, td, th, blockquote, figcaption, dt, dd, caption';
const INITIAL_SCAN_EXTRA_SELECTORS = '.markdown-body p, .markdown-body li, .comment-body p, .js-comment-body p';
const translatedSources = new WeakMap();
const translationCache = new Map();
let originalBubble = null;

function hashText(text) {
    let h = 5381;
    for (let i = 0; i < text.length; i++) {
        h = ((h << 5) + h + text.charCodeAt(i)) | 0;
    }
    return h;
}

function cacheTranslation(targetLang, sourceText, translation) {
    if (!translationCache.has(targetLang)) {
        translationCache.set(targetLang, new Map());
    }
    translationCache.get(targetLang).set(sourceText, translation);
}

function getCachedTranslation(targetLang, sourceText) {
    return translationCache.get(targetLang)?.get(sourceText) || null;
}

function splitCachedTranslations(elements, targetLang) {
    const cacheHits = [];
    const cacheMisses = [];

    elements.forEach(el => {
        const sourceText = el.innerText.trim();
        const translation = getCachedTranslation(targetLang, sourceText);
        if (translation) {
            cacheHits.push({ el, sourceText, translation });
        } else {
            cacheMisses.push(el);
        }
    });

    return { cacheHits, cacheMisses };
}

function injectCachedTranslations(cacheHits) {
    cacheHits.forEach(({ el, sourceText, translation }) => {
        clearTranslateFailed(el);
        ST.injectTranslation(el, translation);
        translatedSources.set(el, hashText(sourceText));
    });
}

function hasOwnTranslationArtifacts(el) {
    const hasDirectChild = Array.from(el.children).some(child =>
        child.classList?.contains('st-immersive-translation') ||
        child.classList?.contains('st-translation-separator')
    );
    const hasWrapperSibling = el.nextElementSibling?.classList.contains('st-immersive-wrapper') || false;
    return hasDirectChild || hasWrapperSibling;
}

function getOwnCleanSourceText(el) {
    const hasDirectTranslation = Array.from(el.children).some(child =>
        child.classList?.contains('st-immersive-translation') ||
        child.classList?.contains('st-translation-separator')
    );
    if (hasDirectTranslation) {
        const clone = el.cloneNode(true);
        Array.from(clone.children)
            .filter(child =>
                child.classList?.contains('st-immersive-translation') ||
                child.classList?.contains('st-translation-separator')
            )
            .forEach(child => child.remove());
        return clone.innerText.trim();
    }
    return el.innerText.trim();
}

function removeOwnTranslationArtifacts(el) {
    Array.from(el.children)
        .filter(child =>
            child.classList?.contains('st-immersive-translation') ||
            child.classList?.contains('st-translation-separator')
        )
        .forEach(child => child.remove());
    const next = el.nextElementSibling;
    if (next && next.classList.contains('st-immersive-wrapper')) {
        next.remove();
    }
}

function injectLoadingPlaceholder(el) {
    if (el.querySelector('.st-immersive-loading')) return;
    const loader = document.createElement('div');
    loader.className = 'st-immersive-loading';
    el.appendChild(loader);
}

function removeLoadingPlaceholder(el) {
    const loader = el.querySelector('.st-immersive-loading');
    if (loader) loader.remove();
}

function setNodePageColor(el, color) {
    if (!el?.style) return;
    if (typeof el.style.setProperty === 'function') {
        el.style.setProperty('--st-page-color', color);
    } else {
        el.style['--st-page-color'] = color;
    }
}

function clearNodePageColor(el) {
    if (!el?.style) return;
    if (typeof el.style.removeProperty === 'function') {
        el.style.removeProperty('--st-page-color');
    } else {
        delete el.style['--st-page-color'];
    }
}

function setOriginalTextAttr(el, text) {
    if (!el) return;
    if (typeof el.setAttribute === 'function') {
        el.setAttribute('data-st-original-text', text);
        return;
    }
    el.__stOriginalText = text;
}

function getOriginalTextAttr(el) {
    if (!el) return '';
    if (typeof el.getAttribute === 'function') {
        return el.getAttribute('data-st-original-text') || '';
    }
    return el.__stOriginalText || '';
}

function removeOriginalTextAttr(el) {
    if (!el) return;
    if (typeof el.removeAttribute === 'function') {
        el.removeAttribute('data-st-original-text');
        return;
    }
    delete el.__stOriginalText;
}

function getOriginalTextSource(el) {
    let current = el;
    while (current) {
        if (
            current.classList?.contains?.('st-immersive-wrapper') ||
            current.classList?.contains?.('st-translated-inline')
        ) {
            return getOriginalTextAttr(current) ? current : null;
        }
        current = current.parentNode;
    }
    return null;
}

function markTranslateFailed(el) {
    el?.classList?.add?.('st-translate-failed');
}

function clearTranslateFailed(el) {
    el?.classList?.remove?.('st-translate-failed');
}

function ensureOriginalBubble() {
    if (originalBubble) return originalBubble;
    originalBubble = document.createElement('div');
    originalBubble.id = 'st-original-bubble';
    document.body.appendChild(originalBubble);
    return originalBubble;
}

function positionOriginalBubble(rect, bubbleWidth, bubbleHeight, viewportW, viewportH) {
    const padding = 8;
    const safeW = Number.isFinite(bubbleWidth) && bubbleWidth > 0 ? bubbleWidth : 300;
    const safeH = Number.isFinite(bubbleHeight) && bubbleHeight > 0 ? bubbleHeight : 60;

    const maxLeft = Math.max(padding, viewportW - safeW - padding);
    const left = Math.min(Math.max(padding, rect.left), maxLeft);

    const preferTop = rect.top - safeH - padding;
    const preferBottom = rect.bottom + padding;
    const top = preferTop >= padding ? preferTop
        : preferBottom + safeH <= viewportH - padding ? preferBottom
        : padding;

    return { top, left };
}

function showOriginalBubble(translationEl) {
    const source = getOriginalTextSource(translationEl);
    if (!source) return;
    const text = getOriginalTextAttr(source);
    if (!text) return;

    const bubble = ensureOriginalBubble();
    bubble.textContent = text;
    bubble.classList.add('active');

    const rect = translationEl.getBoundingClientRect();
    const pos = positionOriginalBubble(
        rect,
        bubble.offsetWidth,
        bubble.offsetHeight,
        window.innerWidth,
        window.innerHeight,
    );
    bubble.style.left = `${pos.left}px`;
    bubble.style.top = `${pos.top}px`;
}

function hideOriginalBubble() {
    if (originalBubble) {
        originalBubble.classList.remove('active');
    }
}

function wrapTranslationWithLink(container, translationEl) {
    const links = container.querySelectorAll('a[href]');
    if (links.length !== 1) return translationEl;

    const link = links[0];
    const linkText = link.textContent.trim();
    const fullText = container.textContent.trim();
    const nonLinkText = fullText.replace(linkText, '').replace(/[\s/\-·:,.|]+/g, '');
    if (nonLinkText.length > 0) return translationEl;

    const wrapper = document.createElement('a');
    wrapper.href = link.href;
    if (link.target) wrapper.target = link.target;
    if (link.rel) wrapper.rel = link.rel;
    if (link.download !== undefined && link.download !== '') wrapper.download = link.download;
    wrapper.className = 'st-immersive-translation-link';
    wrapper.appendChild(translationEl);
    return wrapper;
}

function handleBubbleMouseOver(e) {
    if (ST.state.settings?.showOriginal !== false) return;
    if (ST.state.settings?.hoverShowOriginal === false) return;
    const translation = e.target.closest('.st-immersive-translation');
    if (translation) showOriginalBubble(translation);
}

function handleBubbleMouseOut(e) {
    const translation = e.target.closest('.st-immersive-translation');
    if (translation) hideOriginalBubble();
}

/**
 * 切换沉浸式翻译
 */
ST.toggleImmersive = async function () {
    if (ST.state.isImmersiveEnabled) {
        // 关闭沉浸式翻译
        if (originalBubble) {
            originalBubble.remove();
            originalBubble = null;
        }
        document.removeEventListener?.('mouseover', handleBubbleMouseOver);
        document.removeEventListener?.('mouseout', handleBubbleMouseOut);
        document.querySelectorAll('.st-immersive-wrapper, .st-translated-inline').forEach(el => {
            removeOriginalTextAttr(el);
        });
        document.querySelectorAll('.st-translated-inline, .st-immersive-wrapper').forEach(el => {
            clearNodePageColor(el);
        });
        document.querySelectorAll('.st-immersive-translation, .st-immersive-wrapper, .st-translation-separator, .st-immersive-loading').forEach(el => el.remove());
        document.body.classList.remove('st-replace-mode');
        document.querySelectorAll('.st-translate-failed').forEach(el => {
            clearTranslateFailed(el);
        });
        document.querySelectorAll('.st-translated, .st-translated-inline').forEach(el => {
            el.classList.remove('st-translated', 'st-translated-inline');
        });
        translationCache.clear();
        ST.state.isImmersiveEnabled = false;
        ST.stopMutationObserver();
        ST.showToast('已关闭沉浸式翻译');
        return;
    }

    ST.state.isImmersiveEnabled = true;
    ST.state.immersiveRunId = (ST.state.immersiveRunId || 0) + 1;
    const myRunId = ST.state.immersiveRunId;
    ST.showToast('正在启动沉浸式翻译...');
    const showOriginal = ST.state.settings?.showOriginal !== false;
    if (!showOriginal) {
        document.body.classList.add('st-replace-mode');
    }
    document.removeEventListener?.('mouseover', handleBubbleMouseOver);
    document.removeEventListener?.('mouseout', handleBubbleMouseOut);
    document.addEventListener?.('mouseover', handleBubbleMouseOver);
    document.addEventListener?.('mouseout', handleBubbleMouseOut);
    ST.showProgress();

    // 获取要翻译的段落
    let paragraphs = [];
    const targetLang = ST.state.settings?.targetLang || 'zh';
    const isTwitter = window.location.hostname.includes('twitter.com') ||
        window.location.hostname.includes('x.com');
    const isDiscord = window.location.hostname === 'discord.com' ||
        window.location.hostname === 'ptb.discord.com' ||
        window.location.hostname === 'canary.discord.com';
    const isTelegram = window.location.hostname === 'web.telegram.org';

    if (isTwitter) {
        // Twitter 专用选择器
        const tweetTexts = document.querySelectorAll('[data-testid="tweetText"]');
        paragraphs = Array.from(tweetTexts).filter(el => {
            if (el.nextElementSibling?.classList.contains('st-immersive-wrapper')) return false;
            const text = el.innerText.trim();
            if (text.length < getImmersiveMinLength(el, true)) return false;
            if (ST.detectLanguage(text) === targetLang) return false;
            return true;
        });
    } else {
        if (isDiscord) {
            const discordMessages = document.querySelectorAll('[id^="message-content-"]');
            if (discordMessages.length > 0) {
                paragraphs = Array.from(discordMessages).filter(el => {
                    if (el.isContentEditable) return false;
                    if (containsHardProtectedContent(el)) return false;
                    if (el.querySelector('.st-immersive-translation')) return false;
                    const text = el.innerText.trim();
                    if (text.length < getImmersiveMinLength(el, false)) return false;
                    if (ST.detectLanguage(text) === targetLang) return false;
                    return true;
                });
            }
        }

        if (isTelegram && paragraphs.length === 0) {
            const telegramMessages = document.querySelectorAll('.translatable-message');
            if (telegramMessages.length > 0) {
                paragraphs = Array.from(telegramMessages).filter(el => {
                    if (el.isContentEditable) return false;
                    if (containsHardProtectedContent(el)) return false;
                    if (el.querySelector('.st-immersive-translation')) return false;
                    const text = el.innerText.trim();
                    if (text.length < 2) return false;
                    if (ST.detectLanguage(text) === targetLang) return false;
                    return true;
                });
            }
        }

        if (paragraphs.length === 0) {
            // 通用网站选择器
            const selectors = GENERIC_SELECTORS + ', ' + INITIAL_SCAN_EXTRA_SELECTORS;

            paragraphs = Array.from(document.querySelectorAll(selectors))
                .filter(p => {
                    if (p.isContentEditable) return false;

                        if (isExcludedByImmersiveContext(p)) return false;
                        if (containsHardProtectedContent(p)) return false;
                        if (isGitHubMetadataContext(p)) return false;
                        if (isLinkedInMetadataContext(p)) return false;

                        if (p.nextElementSibling?.classList.contains('st-immersive-wrapper')) return false;
                        if (p.querySelector('.st-immersive-translation')) return false;
                    if (ST.isPluginElement(p)) return false;

                    const text = p.innerText.trim();
                    if (/^[\d\s.,!?@#$%^&*()\-+=]+$/.test(text)) return false;
                    if (text.length < getImmersiveMinLength(p, false)) return false;
                    if (ST.detectLanguage(text) === targetLang) return false;

                    const style = window.getComputedStyle(p);
                    if (style.display === 'none' || style.visibility === 'hidden') return false;

                    return true;
                });
            paragraphs = filterContainedImmersiveElements(paragraphs);
        }
    }

    console.log('[智译] 选中元素数量:', paragraphs.length);

    if (paragraphs.length === 0) {
        ST.hideProgress();
        ST.showToast('未找到可翻译的内容');
        ST.state.isImmersiveEnabled = false;
        return;
    }

    ST.showToast(`找到 ${paragraphs.length} 个段落，开始翻译...`);
    const { cacheHits, cacheMisses } = splitCachedTranslations(paragraphs, targetLang);
    injectCachedTranslations(cacheHits);
    cacheMisses.forEach(p => injectLoadingPlaceholder(p));

    // 分批翻译
    let translatedCount = cacheHits.length;
    let errorCount = 0;
    ST.updateProgress((translatedCount / paragraphs.length) * 100);

    for (let i = 0; i < cacheMisses.length; i += IMMERSIVE_BATCH_SIZE) {
        if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== myRunId) break;

        const batch = cacheMisses.slice(i, i + IMMERSIVE_BATCH_SIZE);
        const texts = batch.map(p => p.innerText.trim());
        batch.forEach(p => injectLoadingPlaceholder(p));

        try {
            const response = await ST.sendMessage({
                action: 'translateBatch',
                texts: texts,
                to: targetLang
            }, 60000, '批量翻译超时');

            if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== myRunId) break;

            if (response && response.results) {
                batch.forEach((p, index) => {
                    const translation = response.results[index];
                    if (translation) {
                        const sourceText = p.innerText.trim();
                        cacheTranslation(targetLang, sourceText, translation);
                        clearTranslateFailed(p);
                        ST.injectTranslation(p, translation);
                        translatedSources.set(p, hashText(sourceText));
                    } else {
                        errorCount++;
                        markTranslateFailed(p);
                    }
                });
            } else if (response && response.error) {
                errorCount += batch.length;
                batch.forEach(p => markTranslateFailed(p));
            }
        } catch (err) {
            if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== myRunId) break;
            console.error('批量翻译出错:', err);
            errorCount += batch.length;
            batch.forEach(p => markTranslateFailed(p));
        } finally {
            batch.forEach(p => removeLoadingPlaceholder(p));
        }

        if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== myRunId) break;
        translatedCount += batch.length;
        ST.updateProgress((translatedCount / paragraphs.length) * 100);

        if (i + IMMERSIVE_BATCH_SIZE < cacheMisses.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    if (ST.state.immersiveRunId === myRunId) {
        ST.hideProgress();
    }

    if (ST.state.isImmersiveEnabled && ST.state.immersiveRunId === myRunId) {
        if (errorCount > 0) {
            ST.showToast(`翻译完成，${errorCount} 个段落失败`);
        } else {
            ST.showToast(`翻译完成！共 ${translatedCount} 个段落`);
        }

        ST.startMutationObserver();
    }
};

async function rescanUntranslatedElements(observerRunId, targetLang, isTwitter, isDiscord, isTelegram) {
    if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== observerRunId) return;

    let selectors;
    if (isTwitter) {
        selectors = '[data-testid="tweetText"]';
    } else if (isDiscord) {
        const isDiscordChat = (window.location.pathname || '').startsWith('/channels');
        const discordGeneric = isDiscordChat ? DISCORD_CHAT_GENERIC_SELECTORS : DISCORD_GENERIC_SELECTORS;
        selectors = '[id^="message-content-"], ' + discordGeneric;
    } else if (isTelegram) {
        selectors = '.translatable-message';
    } else {
        selectors = GENERIC_SELECTORS;
    }

    const candidates = Array.from(document.querySelectorAll(selectors))
        .filter(el => {
            let isStale = false;
            if (hasOwnTranslationArtifacts(el)) {
                const currentText = getOwnCleanSourceText(el);
                const storedHash = translatedSources.get(el);
                if (storedHash === hashText(currentText)) return false;
                removeOwnTranslationArtifacts(el);
                isStale = true;
            }

            if (el.querySelector('.st-immersive-translation')) return false;
            if (ST.pendingTranslations.has(el)) return false;
            if (el.isContentEditable) return false;
                if (!isTwitter) {
                    if (isExcludedByImmersiveContext(el)) return false;
                    if (containsHardProtectedContent(el)) return false;
                    if (isGitHubMetadataContext(el)) return false;
                    if (isLinkedInMetadataContext(el)) return false;
                    if (ST.isPluginElement(el)) return false;
                }

            const text = el.innerText.trim();
            if (!text) return false;
            if (/^[\d\s.,!?@#$%^&*()\-+=]+$/.test(text)) return false;

            const minLen = (isTelegram && el.matches('.translatable-message')) ? 2 : getImmersiveMinLength(el, isTwitter);
            if (!isStale && text.length < minLen) return false;
            if (ST.detectLanguage(text) === targetLang) return false;

            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return false;

            return true;
        });

    const filtered = filterContainedImmersiveElements(candidates);
    if (filtered.length === 0) return;
    const { cacheHits, cacheMisses } = splitCachedTranslations(filtered, targetLang);
    injectCachedTranslations(cacheHits);
    if (cacheMisses.length === 0) return;

    for (let i = 0; i < cacheMisses.length; i += IMMERSIVE_BATCH_SIZE) {
        if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== observerRunId) break;

        const batch = cacheMisses.slice(i, i + IMMERSIVE_BATCH_SIZE);
        batch.forEach(el => ST.pendingTranslations.add(el));
        const texts = batch.map(el => el.innerText.trim());
        batch.forEach(el => injectLoadingPlaceholder(el));

        try {
            const response = await ST.sendMessage({
                action: 'translateBatch',
                texts: texts,
                to: targetLang
            }, 60000, '批量翻译超时');

            if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== observerRunId) break;

            if (response && response.results) {
                batch.forEach((el, index) => {
                    const translation = response.results[index];
                    if (translation) {
                        const sourceText = el.innerText.trim();
                        cacheTranslation(targetLang, sourceText, translation);
                        clearTranslateFailed(el);
                        ST.injectTranslation(el, translation);
                        translatedSources.set(el, hashText(sourceText));
                    } else {
                        markTranslateFailed(el);
                    }
                });
            } else if (response && response.error) {
                batch.forEach(el => markTranslateFailed(el));
            }
        } catch (err) {
            console.error('[智译] 滚动重扫描翻译失败:', err);
            batch.forEach(el => markTranslateFailed(el));
        } finally {
            batch.forEach(el => removeLoadingPlaceholder(el));
            batch.forEach(el => ST.pendingTranslations.delete(el));
        }

        if (i + IMMERSIVE_BATCH_SIZE < cacheMisses.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
}

/**
 * 注入译文到页面
 */
ST.injectTranslation = function (container, translation) {
    if (!document.contains(container)) return;
    const nextSibling = container.nextElementSibling;
    if (nextSibling && nextSibling.classList.contains('st-immersive-wrapper')) return;
    if (container.querySelector('.st-immersive-translation')) return;

    const parentStyle = container.parentNode ? window.getComputedStyle(container.parentNode) : null;
    const parentDisplay = parentStyle?.display || 'block';
    const containerStyle = window.getComputedStyle(container);
    const originalColor = containerStyle.color;
    const originalText = container.innerText.trim();
    const isInline = containerStyle.display.includes('inline');
    const isFlexItem = parentDisplay === 'flex' || parentDisplay === 'inline-flex';
    const isGridItem = parentDisplay === 'grid' || parentDisplay === 'inline-grid';

    const transEl = document.createElement('span');
    transEl.className = 'st-immersive-translation';
    transEl.innerText = translation;

    if (isFlexItem || isGridItem || isInline) {
        setNodePageColor(container, originalColor);
        setOriginalTextAttr(container, originalText);
        container.classList.add('st-translated-inline');
        container.appendChild(transEl);
    } else if (container.matches('td, th, li, figcaption, dt, dd, caption')) {
        const blockTransEl = document.createElement('div');
        blockTransEl.className = 'st-immersive-translation';
        blockTransEl.innerText = translation;
        setNodePageColor(container, originalColor);
        setOriginalTextAttr(container, originalText);
        container.classList.add('st-translated-inline');
        container.appendChild(blockTransEl);
    } else {
        const wrapper = document.createElement('div');
        wrapper.className = 'st-immersive-wrapper';
        setNodePageColor(wrapper, originalColor);
        setOriginalTextAttr(wrapper, originalText);

        const blockTransEl = document.createElement('div');
        blockTransEl.className = 'st-immersive-translation';
        blockTransEl.innerText = translation;

        if (container.matches('h1, h2, h3, h4, h5, h6')) {
            const headingStyle = window.getComputedStyle(container);
            blockTransEl.style.fontSize = `calc(${headingStyle.fontSize} * 0.85)`;
            blockTransEl.style.fontWeight = headingStyle.fontWeight;
        }

        wrapper.appendChild(wrapTranslationWithLink(container, blockTransEl));

        if (container.parentNode) {
            container.classList.add('st-translated');
            container.parentNode.insertBefore(wrapper, container.nextSibling);
        }
    }
};

/**
 * 启动 DOM 变化观察器
 */
ST.startMutationObserver = function () {
    if (ST.observers.mutation) return;
    const observerRunId = ST.state.immersiveRunId;

    const isTwitter = window.location.hostname.includes('twitter.com') ||
        window.location.hostname.includes('x.com');
    const isDiscord = window.location.hostname === 'discord.com' ||
        window.location.hostname === 'ptb.discord.com' ||
        window.location.hostname === 'canary.discord.com';
    const isDiscordChat = isDiscord && (window.location.pathname || '').startsWith('/channels');
    const isTelegram = window.location.hostname === 'web.telegram.org';
    const targetLang = ST.state.settings?.targetLang || 'zh';

    ST.observers.mutation = new MutationObserver(async (mutations) => {
        if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== observerRunId) {
            ST.stopMutationObserver();
            return;
        }

        let newElements = [];

        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;

                    if (isTwitter) {
                        const tweets = node.querySelectorAll ?
                            node.querySelectorAll('[data-testid="tweetText"]') : [];
                        if (node.matches && node.matches('[data-testid="tweetText"]')) {
                            newElements.push(node);
                        }
                        newElements.push(...tweets);
                    } else if (isDiscord) {
                        const discordGeneric = isDiscordChat ? DISCORD_CHAT_GENERIC_SELECTORS : DISCORD_GENERIC_SELECTORS;
                        const messages = node.querySelectorAll ?
                            node.querySelectorAll('[id^="message-content-"]') : [];
                        if (node.matches && node.matches('[id^="message-content-"]')) {
                            newElements.push(node);
                        }
                        newElements.push(...messages);

                        if (node.matches && node.matches(discordGeneric)) {
                            newElements.push(node);
                        }
                        const genericEls = node.querySelectorAll ?
                            node.querySelectorAll(discordGeneric) : [];
                        newElements.push(...genericEls);
                    } else if (isTelegram) {
                        const messages = node.querySelectorAll ?
                            node.querySelectorAll('.translatable-message') : [];
                        if (node.matches && node.matches('.translatable-message')) {
                            newElements.push(node);
                        }
                        newElements.push(...messages);
                    } else {
                        if (node.matches && node.matches(GENERIC_SELECTORS)) {
                            newElements.push(node);
                        }
                        const paragraphs = node.querySelectorAll ?
                            node.querySelectorAll(GENERIC_SELECTORS) : [];
                        newElements.push(...paragraphs);
                    }
                }
            }
        }

        // 过滤
        newElements = newElements.filter(el => {
            if (!el || !el.innerText) return false;
            const text = el.innerText.trim();
            const minLen = (isTelegram && el.matches('.translatable-message')) ? 2 : getImmersiveMinLength(el, isTwitter);
            if (text.length < minLen) return false;
            if (el.isContentEditable) return false;
                if (!isTwitter) {
                    if (isExcludedByImmersiveContext(el)) return false;
                    if (containsHardProtectedContent(el)) return false;
                    if (isGitHubMetadataContext(el)) return false;
                    if (isLinkedInMetadataContext(el)) return false;
                    if (ST.isPluginElement(el)) return false;
                }
                if (el.nextElementSibling?.classList.contains('st-immersive-wrapper')) return false;
                if (el.querySelector('.st-immersive-translation')) return false;
                if (ST.pendingTranslations.has(el)) return false;
            if (ST.detectLanguage(text) === targetLang) return false;
            return true;
        });

        newElements = filterContainedImmersiveElements(newElements);

        if (newElements.length === 0) return;
        const { cacheHits, cacheMisses } = splitCachedTranslations(newElements, targetLang);
        injectCachedTranslations(cacheHits);
        if (cacheMisses.length === 0) return;

        for (let i = 0; i < cacheMisses.length; i += IMMERSIVE_BATCH_SIZE) {
            if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== observerRunId) break;

            const batch = cacheMisses.slice(i, i + IMMERSIVE_BATCH_SIZE);
            batch.forEach(el => ST.pendingTranslations.add(el));
            const texts = batch.map(el => el.innerText.trim());
            batch.forEach(el => injectLoadingPlaceholder(el));

            try {
                const response = await ST.sendMessage({
                    action: 'translateBatch',
                    texts: texts,
                    to: targetLang
                }, 60000, '批量翻译超时');

                if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== observerRunId) break;

                if (response && response.results) {
                    batch.forEach((el, index) => {
                        const translation = response.results[index];
                        if (translation) {
                            const sourceText = el.innerText.trim();
                            cacheTranslation(targetLang, sourceText, translation);
                            clearTranslateFailed(el);
                            ST.injectTranslation(el, translation);
                            translatedSources.set(el, hashText(sourceText));
                        } else {
                            markTranslateFailed(el);
                        }
                    });
                } else if (response && response.error) {
                    batch.forEach(el => markTranslateFailed(el));
                }
            } catch (err) {
                console.error('[智译] 动态内容翻译失败:', err);
                batch.forEach(el => markTranslateFailed(el));
            } finally {
                batch.forEach(el => removeLoadingPlaceholder(el));
                batch.forEach(el => ST.pendingTranslations.delete(el));
            }

            if (i + IMMERSIVE_BATCH_SIZE < cacheMisses.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
    });

    ST.observers.mutation.observe(document.body, {
        childList: true,
        subtree: true
    });

    const RESCAN_INTERVAL = 3000;
    let lastRescanTime = 0;
    let rescanInFlight = false;

    const handleImmersiveScroll = () => {
        if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== observerRunId) {
            window.removeEventListener('scroll', handleImmersiveScroll);
            return;
        }
        if (rescanInFlight) return;

        const now = Date.now();
        if (now - lastRescanTime < RESCAN_INTERVAL) return;
        lastRescanTime = now;
        rescanInFlight = true;

        rescanUntranslatedElements(observerRunId, targetLang, isTwitter, isDiscord, isTelegram)
            .finally(() => { rescanInFlight = false; });
    };

    window.addEventListener('scroll', handleImmersiveScroll, { passive: true });
    ST.observers.scrollHandler = handleImmersiveScroll;

    console.log('[智译] DOM 观察器已启动');
};

/**
 * 停止 DOM 观察器
 */
ST.stopMutationObserver = function () {
    if (ST.observers.mutation) {
        ST.observers.mutation.disconnect();
        ST.observers.mutation = null;
        ST.pendingTranslations.clear();
        console.log('[智译] DOM 观察器已停止');
    }
    if (ST.observers.scrollHandler) {
        window.removeEventListener('scroll', ST.observers.scrollHandler);
        ST.observers.scrollHandler = null;
    }
};

console.log('[智译] Immersive module loaded');
