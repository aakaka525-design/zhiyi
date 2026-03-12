/**
 * Smart Translator - 侧边栏模块
 * 侧边栏 UI 和交互逻辑
 */

var ST = window.SmartTranslator;

/**
 * 创建侧边栏
 */
ST.createSidebar = function () {
    if (document.getElementById('st-sidebar')) return;

    ST.ui.sidebar = document.createElement('div');
    ST.ui.sidebar.id = 'st-sidebar';
    ST.ui.sidebar.innerHTML = `
        <div class="st-sidebar-header">
            <span class="st-sidebar-title">智译侧边栏</span>
            <div class="st-sidebar-close" id="st-sidebar-close">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </div>
        </div>
        <div class="st-sidebar-content">
            <div class="st-sidebar-controls">
                <select class="st-lang-select" id="st-sidebar-source-lang">
                    <option value="auto">自动检测</option>
                    <option value="zh">中文</option>
                    <option value="en">English</option>
                    <option value="ja">日本語</option>
                    <option value="ko">한국어</option>
                </select>
                <button class="st-control-btn" id="st-sidebar-swap-btn" title="互换语言">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 16V4M7 4L3 8M7 4l4 4M17 8v12M17 20l4-4M17 20l-4-4"/></svg>
                </button>
                <select class="st-lang-select" id="st-sidebar-target-lang">
                    <option value="zh">中文</option>
                    <option value="en">English</option>
                    <option value="ja">日本語</option>
                    <option value="ko">한국어</option>
                </select>
                <button class="st-control-btn" id="st-sidebar-clear-btn" title="清空" style="margin-left: auto;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            <div class="st-sidebar-search">
                <div style="position: relative;">
                    <textarea class="st-sidebar-input" id="st-sidebar-input" placeholder="输入要翻译的文字..."></textarea>
                    <button class="st-control-btn" id="st-sidebar-speak-source" title="朗读原文" style="position: absolute; right: 4px; bottom: 4px; opacity: 0.6;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                    </button>
                </div>
                <button class="st-sidebar-btn" id="st-sidebar-translate-btn">翻译</button>
            </div>

            <div class="st-sidebar-result-card" id="st-sidebar-result">
                <div class="st-result-header">
                    <span id="st-result-lang">翻译结果</span>
                    <div class="st-result-actions">
                        <button class="st-control-btn" id="st-sidebar-speak-result" title="朗读译文">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                        </button>
                        <button class="st-control-btn" id="st-result-copy" title="复制">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        </button>
                    </div>
                </div>
                <div class="st-result-text" id="st-result-content"></div>
            </div>

            <div class="st-sidebar-history">
                <div class="st-history-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    最近记录
                </div>
                <div class="st-history-list" id="st-sidebar-history-list">
                    <div style="font-size: 12px; color: #999; text-align: center; padding: 20px;">暂无记录</div>
                </div>
            </div>

            <div class="st-sidebar-info" style="margin-top: auto; font-size: 12px; color: #666; text-align: center; padding-bottom: 20px;">
                快捷键: <span style="background: #eee; padding: 2px 6px; border-radius: 4px;">Alt + S</span>
            </div>
        </div>
    `;
    document.body.appendChild(ST.ui.sidebar);

    // 创建悬浮切换按钮
    ST.ui.sidebarBtn = document.createElement('div');
    ST.ui.sidebarBtn.id = 'st-sidebar-toggle-btn';
    ST.ui.sidebarBtn.innerHTML = `
        <svg class="st-toggle-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
    `;
    document.body.appendChild(ST.ui.sidebarBtn);

    // DOM 元素引用
    const closeBtn = ST.ui.sidebar.querySelector('#st-sidebar-close');
    const input = ST.ui.sidebar.querySelector('#st-sidebar-input');
    const translateBtn = ST.ui.sidebar.querySelector('#st-sidebar-translate-btn');
    const resultCard = ST.ui.sidebar.querySelector('#st-sidebar-result');
    const resultContent = ST.ui.sidebar.querySelector('#st-result-content');
    const resultLang = ST.ui.sidebar.querySelector('#st-result-lang');
    const copyBtn = ST.ui.sidebar.querySelector('#st-result-copy');
    const clearBtn = ST.ui.sidebar.querySelector('#st-sidebar-clear-btn');
    const swapBtn = ST.ui.sidebar.querySelector('#st-sidebar-swap-btn');
    const sourceLangSelect = ST.ui.sidebar.querySelector('#st-sidebar-source-lang');
    const targetLangSelect = ST.ui.sidebar.querySelector('#st-sidebar-target-lang');
    const speakSourceBtn = ST.ui.sidebar.querySelector('#st-sidebar-speak-source');
    const speakResultBtn = ST.ui.sidebar.querySelector('#st-sidebar-speak-result');
    const historyList = ST.ui.sidebar.querySelector('#st-sidebar-history-list');

    // 初始化语言选择
    if (ST.state.settings) {
        sourceLangSelect.value = ST.state.settings.sourceLang || 'auto';
        targetLangSelect.value = ST.state.settings.targetLang || 'zh';
    }

    // 事件绑定
    ST.ui.sidebarBtn.onclick = () => ST.toggleSidebar();
    closeBtn.onclick = () => ST.toggleSidebar();

    // 清空
    clearBtn.onclick = () => {
        input.value = '';
        resultCard.classList.remove('active');
        input.focus();
    };

    // 互换
    swapBtn.onclick = () => {
        const s = sourceLangSelect.value;
        const t = targetLangSelect.value;
        if (s !== 'auto') {
            sourceLangSelect.value = t;
            targetLangSelect.value = s;
        }
    };

    // 朗读辅助函数 - 使用配置的 TTS 服务
    const speak = async (text, lang) => {
        if (!text) return;

        const settings = ST.state.settings || {};
        const provider = settings.ttsProvider || 'system';
        const speed = settings.ttsSpeed || 1.0;

        try {
            switch (provider) {
                case 'openai':
                    await speakOpenAI(text, settings);
                    break;
                case 'google':
                    await speakGoogle(text, lang, settings);
                    break;
                case 'glm':
                    await speakGLM(text, settings);
                    break;
                default:
                    speakSystem(text, lang, speed);
            }
        } catch (err) {
            console.error('[TTS] 朗读失败:', err);
            speakSystem(text, lang, speed);
        }
    };

    const speakSystem = (text, lang, speed) => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = speed;
        utterance.lang = lang === 'zh' ? 'zh-CN' : lang;
        window.speechSynthesis.speak(utterance);
    };

    // 通用音频播放函数 - 使用 Offscreen 播放以避免 CSP 问题
    const playAudioFromDataUrl = async (dataUrl, speed = 1.0) => {
        const result = await ST.sendMessage({
            action: 'playAudioOffscreen',
            audioData: dataUrl,
            speed
        });
        if (result?.error) throw new Error(result.error);
    };

    const speakOpenAI = async (text, settings) => {
        const apiKey = settings.openaiApiKey;
        if (!apiKey) { speakSystem(text, 'zh', 1.0); return; }

        const response = await ST.sendMessage({
            action: 'ttsOpenAI',
            apiKey,
            baseUrl: settings.openaiBaseUrl,
            text,
            voice: settings.ttsVoice || 'nova',
            speed: settings.ttsSpeed || 1.0
        });

        if (response?.audioData) {
            await playAudioFromDataUrl(response.audioData);
        } else {
            throw new Error(response?.error || 'OpenAI TTS failed');
        }
    };

    const speakGoogle = async (text, lang, settings) => {
        const apiKey = settings.geminiApiKey;
        if (!apiKey) {
            speakSystem(text, lang, 1.0);
            return;
        }

        const voice = settings.ttsVoice || ST.getDefaultGoogleTtsVoice(lang);

        const response = await ST.sendMessage({
            action: 'ttsGoogle',
            apiKey,
            text,
            voice,
            speed: settings.ttsSpeed || 1.0
        });

        if (response?.audioData) {
            await playAudioFromDataUrl(response.audioData);
        } else {
            speakSystem(text, lang, settings.ttsSpeed || 1.0);
        }
    };

    const speakGLM = async (text, settings) => {
        const apiKey = settings.deepseekApiKey;
        if (!apiKey) {
            speakSystem(text, 'zh', 1.0);
            return;
        }

        const voice = settings.ttsVoice || 'tongtong';

        const response = await ST.sendMessage({
            action: 'ttsGLM',
            apiKey,
            text,
            voice,
            speed: settings.ttsSpeed || 1.0
        });

        if (response?.audioData) {
            await playAudioFromDataUrl(response.audioData);
        } else {
            speakSystem(text, 'zh', settings.ttsSpeed || 1.0);
        }
    };

    speakSourceBtn.onclick = () => speak(input.value, sourceLangSelect.value);
    speakResultBtn.onclick = () => speak(resultContent.innerText, targetLangSelect.value);

    // 翻译逻辑
    translateBtn.onclick = async () => {
        const text = input.value.trim();
        if (!text) return;

        translateBtn.innerText = '翻译中...';
        translateBtn.disabled = true;

        try {
            const response = await ST.sendMessage({
                action: 'translate',
                text: text,
                from: sourceLangSelect.value,
                to: targetLangSelect.value
            });

            if (response && response.text) {
                resultCard.classList.add('active');
                resultContent.innerText = response.text;
                resultContent.style.color = '';
                resultLang.innerText = `翻译结果 (${targetLangSelect.value})`;
                // 刷新历史记录
                setTimeout(() => ST.refreshSidebarHistory(), 500);
            }
        } catch (err) {
            resultCard.classList.add('active');
            resultContent.textContent = `错误: ${err.message}`;
            resultContent.style.color = '#ff5252';
        } finally {
            translateBtn.innerText = '翻译';
            translateBtn.disabled = false;
        }
    };

    copyBtn.onclick = () => {
        navigator.clipboard.writeText(resultContent.innerText);
        const originalIcon = copyBtn.innerHTML;
        copyBtn.innerHTML = '<span style="font-size: 10px; color: var(--accent);">已复制</span>';
        setTimeout(() => {
            copyBtn.innerHTML = originalIcon;
        }, 1500);
    };

    // 加载历史记录
    ST.refreshSidebarHistory = async () => {
        try {
            const history = await ST.sendMessage({ action: 'getHistory' });
            historyList.replaceChildren();

            if (history && history.length > 0) {
                const top5 = history.slice(0, 5);
                top5.forEach((item) => {
                    const historyItem = document.createElement('div');
                    historyItem.className = 'st-history-item';
                    historyItem.dataset.source = item.source;
                    historyItem.dataset.target = item.target;

                    const sourceDiv = document.createElement('div');
                    sourceDiv.className = 'st-history-source';
                    sourceDiv.textContent = item.source;

                    const targetDiv = document.createElement('div');
                    targetDiv.className = 'st-history-target';
                    targetDiv.textContent = item.target;

                    historyItem.append(sourceDiv, targetDiv);
                    historyItem.onclick = () => {
                        input.value = historyItem.dataset.source;
                        resultContent.innerText = historyItem.dataset.target;
                        resultContent.style.color = '';
                        resultCard.classList.add('active');
                        translateBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    };

                    historyList.appendChild(historyItem);
                });
            } else {
                const emptyState = document.createElement('div');
                emptyState.style.fontSize = '12px';
                emptyState.style.color = '#999';
                emptyState.style.textAlign = 'center';
                emptyState.style.padding = '20px';
                emptyState.textContent = '暂无记录';
                historyList.appendChild(emptyState);
            }
        } catch (err) {
            console.error('加载历史记录失败:', err);
        }
    };

    // 快捷键 Alt + S
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key.toLowerCase() === 's') {
            ST.toggleSidebar();
        }
    });

    // 首次加载历史记录
    ST.refreshSidebarHistory();
};

/**
 * 切换侧边栏显示
 */
ST.toggleSidebar = function () {
    if (!ST.ui.sidebar || !ST.ui.sidebarBtn) {
        ST.createSidebar();
    }
    const isActive = ST.ui.sidebar.classList.toggle('active');
    ST.ui.sidebarBtn.classList.toggle('sidebar-active');

    if (isActive) {
        ST.refreshSidebarHistory();
        setTimeout(() => {
            ST.ui.sidebar.querySelector('#st-sidebar-input').focus();
        }, 400);
    }
};

console.log('[智译] Sidebar module loaded (Enhanced)');
