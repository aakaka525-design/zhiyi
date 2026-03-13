/**
 * Smart Translator - 沉浸式翻译模块
 * 全页面双语对照翻译
 */

var ST = window.SmartTranslator;

/**
 * 切换沉浸式翻译
 */
ST.toggleImmersive = async function () {
    if (ST.state.isImmersiveEnabled) {
        // 关闭沉浸式翻译
        document.querySelectorAll('.st-immersive-translation, .st-immersive-wrapper').forEach(el => el.remove());
        ST.state.isImmersiveEnabled = false;
        ST.stopMutationObserver();
        ST.showToast('已关闭沉浸式翻译');
        return;
    }

    ST.state.isImmersiveEnabled = true;
    ST.showToast('正在启动沉浸式翻译...');
    ST.showProgress();

    // 获取要翻译的段落
    let paragraphs = [];
    const targetLang = ST.state.settings?.targetLang || 'zh';
    const isTwitter = window.location.hostname.includes('twitter.com') ||
        window.location.hostname.includes('x.com');

    if (isTwitter) {
        // Twitter 专用选择器
        const tweetTexts = document.querySelectorAll('[data-testid="tweetText"]');
        paragraphs = Array.from(tweetTexts).filter(el => {
            if (el.nextElementSibling?.classList.contains('st-immersive-wrapper')) return false;
            const text = el.innerText.trim();
            if (text.length < 5) return false;
            if (ST.detectLanguage(text) === targetLang) return false;
            return true;
        });
    } else {
        // 通用网站选择器
        const selectors = [
            'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'li', 'td', 'th', 'blockquote',
            '.markdown-body p', '.markdown-body li',
            '.comment-body p', '.js-comment-body p'
        ].join(', ');

        const excludeSelectors = [
            'nav', 'header', 'footer', 'aside',
            'button', 'a', 'input', 'select', 'label',
            '.Header', '.AppHeader', '.pagehead',
            '.btn', '.Button', '.Counter', '.Label',
            '.sidebar', '.menu', '.toolbar'
        ];

        paragraphs = Array.from(document.querySelectorAll(selectors))
            .filter(p => {
                const style = window.getComputedStyle(p);
                if (style.display === 'none' || style.visibility === 'hidden') return false;

                for (const selector of excludeSelectors) {
                    if (p.closest(selector) || p.matches(selector)) return false;
                }

                if (p.nextElementSibling?.classList.contains('st-immersive-wrapper')) return false;
                if (p.querySelector('.st-immersive-translation')) return false;
                if (ST.isPluginElement(p)) return false;

                const text = p.innerText.trim();
                if (/^[\d\s.,!?@#$%^&*()\-+=]+$/.test(text)) return false;
                if (text.length < 20) return false;
                if (ST.detectLanguage(text) === targetLang) return false;

                return true;
            })
            .filter((el, index, arr) => {
                return !arr.some((other, otherIndex) =>
                    otherIndex !== index && other.contains(el) && other !== el
                );
            });
    }

    console.log('[智译] 选中元素数量:', paragraphs.length);

    if (paragraphs.length === 0) {
        ST.hideProgress();
        ST.showToast('未找到可翻译的内容');
        ST.state.isImmersiveEnabled = false;
        return;
    }

    ST.showToast(`找到 ${paragraphs.length} 个段落，开始翻译...`);

    // 分批翻译
    const batchSize = 10;
    let translatedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < paragraphs.length; i += batchSize) {
        if (!ST.state.isImmersiveEnabled) break;

        const batch = paragraphs.slice(i, i + batchSize);
        const texts = batch.map(p => p.innerText.trim());

        try {
            const response = await ST.sendMessage({
                action: 'translateBatch',
                texts: texts,
                to: targetLang
            });

            if (response && response.results) {
                batch.forEach((p, index) => {
                    const translation = response.results[index];
                    if (translation) {
                        ST.injectTranslation(p, translation);
                    }
                });
            } else if (response && response.error) {
                errorCount += batch.length;
            }
        } catch (err) {
            console.error('批量翻译出错:', err);
            errorCount += batch.length;
        }

        translatedCount += batch.length;
        ST.updateProgress((translatedCount / paragraphs.length) * 100);

        if (i + batchSize < paragraphs.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    ST.hideProgress();

    if (errorCount > 0) {
        ST.showToast(`翻译完成，${errorCount} 个段落失败`);
    } else {
        ST.showToast(`翻译完成！共 ${translatedCount} 个段落`);
    }

    ST.startMutationObserver();
};

/**
 * 注入译文到页面
 */
ST.injectTranslation = function (container, translation) {
    const nextSibling = container.nextElementSibling;
    if (nextSibling && nextSibling.classList.contains('st-immersive-wrapper')) return;
    if (container.querySelector('.st-immersive-translation')) return;

    const parentStyle = container.parentNode ? window.getComputedStyle(container.parentNode) : null;
    const parentDisplay = parentStyle?.display || 'block';
    const containerStyle = window.getComputedStyle(container);
    const isInline = containerStyle.display.includes('inline');
    const isFlexItem = parentDisplay === 'flex' || parentDisplay === 'inline-flex';
    const isGridItem = parentDisplay === 'grid' || parentDisplay === 'inline-grid';

    const transEl = document.createElement('span');
    transEl.className = 'st-immersive-translation';
    transEl.innerText = translation;

    if (isFlexItem || isGridItem || isInline) {
        const separator = document.createElement('span');
        separator.className = 'st-translation-separator';
        separator.innerHTML = ' &nbsp;→&nbsp; ';
        separator.style.cssText = 'color: #8DA399; opacity: 0.6;';

        transEl.style.cssText = 'display: inline; font-style: normal; color: #8DA399; margin-left: 4px;';

        container.appendChild(separator);
        container.appendChild(transEl);
    } else {
        const wrapper = document.createElement('div');
        wrapper.className = 'st-immersive-wrapper';

        const blockTransEl = document.createElement('div');
        blockTransEl.className = 'st-immersive-translation';
        blockTransEl.innerText = translation;

        wrapper.appendChild(blockTransEl);

        if (container.parentNode) {
            container.parentNode.insertBefore(wrapper, container.nextSibling);
        }
    }
};

/**
 * 启动 DOM 变化观察器
 */
ST.startMutationObserver = function () {
    if (ST.observers.mutation) return;

    const isTwitter = window.location.hostname.includes('twitter.com') ||
        window.location.hostname.includes('x.com');

    ST.observers.mutation = new MutationObserver(async (mutations) => {
        if (!ST.state.isImmersiveEnabled) {
            ST.stopMutationObserver();
            return;
        }

        let newElements = [];
        const targetLang = ST.state.settings?.targetLang || 'zh';

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
                    } else {
                        const paragraphs = node.querySelectorAll ?
                            node.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote') : [];
                        newElements.push(...paragraphs);
                    }
                }
            }
        }

        // 过滤
        newElements = newElements.filter(el => {
            if (!el || !el.innerText) return false;
            const text = el.innerText.trim();
            if (text.length < 5) return false;
            if (el.nextElementSibling?.classList.contains('st-immersive-wrapper')) return false;
            if (ST.pendingTranslations.has(el)) return false;
            if (ST.detectLanguage(text) === targetLang) return false;
            return true;
        });

        if (newElements.length === 0) return;

        newElements.forEach(el => ST.pendingTranslations.add(el));

        const texts = newElements.map(el => el.innerText.trim());

        try {
            const response = await ST.sendMessage({
                action: 'translateBatch',
                texts: texts,
                to: targetLang
            });

            if (response && response.results) {
                newElements.forEach((el, index) => {
                    const translation = response.results[index];
                    if (translation) {
                        ST.injectTranslation(el, translation);
                    }
                    ST.pendingTranslations.delete(el);
                });
            }
        } catch (err) {
            console.error('[智译] 动态内容翻译失败:', err);
            newElements.forEach(el => ST.pendingTranslations.delete(el));
        }
    });

    ST.observers.mutation.observe(document.body, {
        childList: true,
        subtree: true
    });

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
};

console.log('[智译] Immersive module loaded');
