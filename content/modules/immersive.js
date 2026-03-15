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
    '.sidebar', '.menu', '.toolbar'
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

function hashText(text) {
    let h = 5381;
    for (let i = 0; i < text.length; i++) {
        h = ((h << 5) + h + text.charCodeAt(i)) | 0;
    }
    return h;
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

function markTranslateFailed(el) {
    el?.classList?.add?.('st-translate-failed');
}

function clearTranslateFailed(el) {
    el?.classList?.remove?.('st-translate-failed');
}

/**
 * 切换沉浸式翻译
 */
ST.toggleImmersive = async function () {
    if (ST.state.isImmersiveEnabled) {
        // 关闭沉浸式翻译
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
                    if (el.querySelector('.st-immersive-translation')) return false;
                    if (el.isContentEditable) return false;
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
                    if (el.querySelector('.st-immersive-translation')) return false;
                    if (el.isContentEditable) return false;
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
    paragraphs.forEach(p => injectLoadingPlaceholder(p));

    // 分批翻译
    let translatedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < paragraphs.length; i += IMMERSIVE_BATCH_SIZE) {
        if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== myRunId) break;

        const batch = paragraphs.slice(i, i + IMMERSIVE_BATCH_SIZE);
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
                        clearTranslateFailed(p);
                        const sourceText = p.innerText.trim();
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

        if (i + IMMERSIVE_BATCH_SIZE < paragraphs.length) {
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
            if (!isTwitter && !isTelegram) {
                if (isExcludedByImmersiveContext(el)) return false;
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

    for (let i = 0; i < filtered.length; i += IMMERSIVE_BATCH_SIZE) {
        if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== observerRunId) break;

        const batch = filtered.slice(i, i + IMMERSIVE_BATCH_SIZE);
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
                        clearTranslateFailed(el);
                        const sourceText = el.innerText.trim();
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

        if (i + IMMERSIVE_BATCH_SIZE < filtered.length) {
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
    const isInline = containerStyle.display.includes('inline');
    const isFlexItem = parentDisplay === 'flex' || parentDisplay === 'inline-flex';
    const isGridItem = parentDisplay === 'grid' || parentDisplay === 'inline-grid';

    const transEl = document.createElement('span');
    transEl.className = 'st-immersive-translation';
    transEl.innerText = translation;

    if (isFlexItem || isGridItem || isInline) {
        setNodePageColor(container, originalColor);
        container.classList.add('st-translated-inline');
        container.appendChild(transEl);
    } else if (container.matches('td, th, li, figcaption, dt, dd, caption')) {
        const blockTransEl = document.createElement('div');
        blockTransEl.className = 'st-immersive-translation';
        blockTransEl.innerText = translation;
        setNodePageColor(container, originalColor);
        container.classList.add('st-translated-inline');
        container.appendChild(blockTransEl);
    } else {
        const wrapper = document.createElement('div');
        wrapper.className = 'st-immersive-wrapper';
        setNodePageColor(wrapper, originalColor);

        const blockTransEl = document.createElement('div');
        blockTransEl.className = 'st-immersive-translation';
        blockTransEl.innerText = translation;

        if (container.matches('h1, h2, h3, h4, h5, h6')) {
            const headingStyle = window.getComputedStyle(container);
            blockTransEl.style.fontSize = `calc(${headingStyle.fontSize} * 0.85)`;
            blockTransEl.style.fontWeight = headingStyle.fontWeight;
        }

        wrapper.appendChild(blockTransEl);

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

        for (let i = 0; i < newElements.length; i += IMMERSIVE_BATCH_SIZE) {
            if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== observerRunId) break;

            const batch = newElements.slice(i, i + IMMERSIVE_BATCH_SIZE);
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
                            clearTranslateFailed(el);
                            const sourceText = el.innerText.trim();
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

            if (i + IMMERSIVE_BATCH_SIZE < newElements.length) {
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
