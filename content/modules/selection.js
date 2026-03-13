/**
 * Smart Translator - 划词翻译模块
 * 处理文本选择、翻译图标和翻译气泡
 */

var ST = window.SmartTranslator;

/**
 * 处理鼠标抬起事件（划词检测）
 */
ST.handleMouseUp = function (e) {
    if (!ST.state.settings?.enableSelection) return;
    if (ST.isPluginElement(e.target)) return;

    const selection = window.getSelection();
    const text = selection.toString().trim();

    ST.removeIcon();

    if (text && text.length > 0 && text.length < 2000) {
        ST.state.selection.text = text;
        ST.state.selection.range = selection.getRangeAt(0);
        ST.state.selection.rect = ST.state.selection.range.getBoundingClientRect();

        // 长文本直接显示翻译气泡
        if (text.length >= 5) {
            ST.showBubble(text);
        } else {
            // 短文本显示触发图标
            ST.showIcon(e.pageX, e.pageY);
        }
    }
};

/**
 * 处理鼠标按下事件（关闭气泡）
 */
ST.handleMouseDown = function (e) {
    if (!ST.isPluginElement(e.target)) {
        ST.removeBubble();
        ST.removeIcon();
    }
};

/**
 * 处理双击翻译
 */
ST.handleDoubleClick = function (e) {
    if (!ST.state.settings?.enableSelection) return;
    if (e.target.matches('input, textarea, [contenteditable="true"]')) {
        return;
    }
    if (ST.isPluginElement(e.target)) {
        return;
    }

    const text = window.getSelection().toString().trim();

    if (text && text.length >= 2 && text.length <= 500) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            ST.state.selection.rect = range.getBoundingClientRect();
            ST.state.selection.text = text;
            ST.showBubble(text);
        }
    }
};

/**
 * 显示翻译触发图标
 */
ST.showIcon = function (x, y) {
    if (ST.ui.icon) ST.removeIcon();

    ST.ui.icon = document.createElement('div');
    ST.ui.icon.id = 'smart-translator-icon';
    ST.ui.icon.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2v3M22 22l-5-10-5 10M14 18h6"/>
    </svg>
    `;
    ST.ui.icon.style.left = `${x + 10}px`;
    ST.ui.icon.style.top = `${y + 10}px`;

    document.body.appendChild(ST.ui.icon);

    ST.ui.icon.addEventListener('mouseup', (e) => {
        e.stopPropagation();
        ST.showBubble(ST.state.selection.text);
        ST.removeIcon();
    });
};

/**
 * 移除翻译图标
 */
ST.removeIcon = function () {
    if (ST.ui.icon) {
        ST.ui.icon.remove();
        ST.ui.icon = null;
    }
};

/**
 * 显示翻译气泡
 */
ST.showBubble = async function (text) {
    if (ST.ui.bubble) ST.removeBubble();

    ST.ui.bubble = document.createElement('div');
    ST.ui.bubble.id = 'smart-translator-bubble';

    // 加载状态
    ST.ui.bubble.innerHTML = `
    <div class="st-bubble-header">
      <span class="st-bubble-logo">智译翻译</span>
      <div class="st-bubble-actions">
        <button class="st-action-btn" id="st-copy-btn" title="复制">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="st-bubble-result">
      <div class="st-loading-dots"><span></span><span></span><span></span></div>
    </div>
    `;

    // 定位气泡
    const rect = resolveBubbleRect();
    ST.ui.bubble.style.position = 'fixed';
    if (rect) {
        ST.state.selection.rect = rect;
        ST.ui.bubble.style.top = `${rect.bottom + 10}px`;
        ST.ui.bubble.style.left = `${Math.max(10, rect.left)}px`;
    } else {
        const fallbackPosition = getFallbackBubblePosition();
        ST.ui.bubble.style.top = `${fallbackPosition.top}px`;
        ST.ui.bubble.style.left = `${fallbackPosition.left}px`;
    }
    ST.ui.bubble.style.zIndex = '2147483647';

    document.body.appendChild(ST.ui.bubble);

    try {
        const response = await ST.sendMessage({
            action: 'translate',
            text: text,
            from: ST.detectLanguage(text),
            to: ST.state.settings?.targetLang || 'zh'
        });

        const resultDiv = ST.ui.bubble?.querySelector('.st-bubble-result');
        if (!resultDiv) return;

        if (response && response.text) {
            renderBubbleMessage(resultDiv, response.text);

            // 绑定复制
                const copyBtn = ST.ui.bubble.querySelector('#st-copy-btn');
                if (copyBtn) {
                    copyBtn.onclick = () => {
                        navigator.clipboard.writeText(response.text);
                        copyBtn.style.color = 'var(--accent)';
                        setTimeout(() => copyBtn.style.color = '', 1000);
                    };
                }
        } else {
            renderBubbleMessage(resultDiv, `翻译失败: ${response?.error || '未知错误'}`, true);
        }
    } catch (err) {
        const resultDiv = ST.ui.bubble?.querySelector('.st-bubble-result');
        if (resultDiv) {
            renderBubbleMessage(resultDiv, `请求失败: ${err.message || '未知错误'}`, true);
        }
    }
};

function resolveBubbleRect() {
    if (isUsableRect(ST.state.selection.rect)) {
        return ST.state.selection.rect;
    }

    const selection = window.getSelection?.();
    if (selection?.rangeCount > 0) {
        const rangeRect = selection.getRangeAt(0).getBoundingClientRect();
        if (isUsableRect(rangeRect)) {
            return rangeRect;
        }
    }

    return null;
}

function isUsableRect(rect) {
    return Boolean(
        rect
        && Number.isFinite(rect.left)
        && Number.isFinite(rect.bottom)
        && rect.width > 0
        && rect.height > 0
    );
}

function getFallbackBubblePosition() {
    return {
        top: 100,
        left: Math.max(10, (window.innerWidth / 2) - 150),
    };
}

function renderBubbleMessage(container, message, isError = false) {
    container.textContent = message;
    container.style.color = isError ? 'var(--error)' : '';
}

/**
 * 移除翻译气泡
 */
ST.removeBubble = function () {
    if (ST.ui.bubble) {
        ST.ui.bubble.remove();
        ST.ui.bubble = null;
    }
};

console.log('[智译] Selection module loaded');
