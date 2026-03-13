/**
 * Smart Translator - 翻译小窗模块
 * 悬浮翻译窗口 UI 和交互
 */

var ST = window.SmartTranslator;

/**
 * 创建翻译小窗
 */
ST.createFloatWindow = function () {
    if (document.getElementById('st-float-window')) return;

    ST.ui.floatWindow = document.createElement('div');
    ST.ui.floatWindow.id = 'st-float-window';
    ST.ui.floatWindow.innerHTML = `
        <div class="st-float-header">
            <div class="st-float-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10zM2 12h20"></path></svg>
                <span>智译小窗</span>
            </div>
            <div class="st-float-actions">
                <button class="st-control-btn" id="st-float-speak-source" title="朗读原文" style="padding: 2px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                </button>
                <button class="st-control-btn" id="st-float-clear-btn" title="清空" style="padding: 2px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
                <div class="st-float-close" id="st-float-close" title="关闭">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </div>
            </div>
        </div>
        <div class="st-float-content">
            <div class="st-float-input-group">
                <textarea class="st-float-input" id="st-float-input" placeholder="输入要翻译的内容..."></textarea>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                    <div style="display: flex; gap: 4px; align-items: center;">
                        <select class="st-lang-select" id="st-float-target-lang" style="padding: 2px 4px; font-size: 11px;">
                            <option value="zh">译中</option>
                            <option value="en">译英</option>
                            <option value="ja">译日</option>
                            <option value="ko">译韩</option>
                        </select>
                    </div>
                    <button class="st-float-btn" id="st-float-translate-btn">快译</button>
                </div>
            </div>
            <div class="st-float-result" id="st-float-result">
                <div class="st-result-header" style="margin-bottom: 8px;">
                    <span>结果</span>
                    <button class="st-control-btn" id="st-float-speak-result" title="朗读译文" style="padding: 2px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                    </button>
                </div>
                <div class="st-float-result-text" id="st-float-result-text"></div>
            </div>
        </div>
    `;
    document.body.appendChild(ST.ui.floatWindow);

    // DOM 元素
    const closeBtn = ST.ui.floatWindow.querySelector('#st-float-close');
    const input = ST.ui.floatWindow.querySelector('#st-float-input');
    const translateBtn = ST.ui.floatWindow.querySelector('#st-float-translate-btn');
    const resultArea = ST.ui.floatWindow.querySelector('#st-float-result');
    const resultText = ST.ui.floatWindow.querySelector('#st-float-result-text');
    const header = ST.ui.floatWindow.querySelector('.st-float-header');
    const clearBtn = ST.ui.floatWindow.querySelector('#st-float-clear-btn');
    const speakSourceBtn = ST.ui.floatWindow.querySelector('#st-float-speak-source');
    const speakResultBtn = ST.ui.floatWindow.querySelector('#st-float-speak-result');
    const targetLangSelect = ST.ui.floatWindow.querySelector('#st-float-target-lang');

    // 初始化语言
    if (ST.state.settings) {
        targetLangSelect.value = ST.state.settings.targetLang || 'zh';
    }

    closeBtn.onclick = () => ST.toggleFloatWindow();

    // 清空
    clearBtn.onclick = () => {
        input.value = '';
        resultArea.classList.remove('active');
        input.focus();
    };

    // 朗读函数 - 使用后台代理绕过 CSP
    const speak = async (text, lang) => {
        if (!text) return;
        const settings = ST.state.settings || {};
        const provider = settings.ttsProvider || 'system';
        const speed = settings.ttsSpeed || 1.0;

        // 通用音频播放函数 - 使用 Offscreen 播放以避免 CSP 问题
        const playAudio = async (dataUrl, playbackSpeed = 1.0) => {
            const result = await ST.sendMessage({
                action: 'playAudioOffscreen',
                audioData: dataUrl,
                speed: playbackSpeed
            });
            if (result?.error) throw new Error(result.error);
        };

        try {
            if (provider === 'openai' && settings.openaiApiKey) {
                const response = await ST.sendMessage({
                    action: 'ttsOpenAI',
                    apiKey: settings.openaiApiKey,
                    baseUrl: settings.openaiBaseUrl,
                    text,
                    voice: settings.ttsVoice || 'nova',
                    speed
                });
                if (response?.audioData) { await playAudio(response.audioData); return; }
            } else if (provider === 'google' && settings.geminiApiKey) {
                const response = await ST.sendMessage({
                    action: 'ttsGoogle',
                    apiKey: settings.geminiApiKey,
                    text,
                    voice: settings.ttsVoice || ST.getDefaultGoogleTtsVoice(lang),
                    speed
                });
                if (response?.audioData) { await playAudio(response.audioData); return; }
            } else if (provider === 'glm' && settings.deepseekApiKey) {
                const response = await ST.sendMessage({
                    action: 'ttsGLM',
                    apiKey: settings.deepseekApiKey,
                    text,
                    voice: settings.ttsVoice || 'tongtong',
                    speed
                });
                if (response?.audioData) { await playAudio(response.audioData); return; }
            }
        } catch (err) {
            console.error('[TTS] 朗读失败:', err);
        }
        // 回退到系统语音
        const langMap = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP', ko: 'ko-KR' };
        const resolvedLang = !lang || lang === 'auto' ? ST.detectLanguage(text) : lang;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = speed;
        utterance.lang = langMap[resolvedLang] || resolvedLang;
        window.speechSynthesis.speak(utterance);
    };

    speakSourceBtn.onclick = () => speak(input.value);
    speakResultBtn.onclick = () => speak(resultText.innerText, targetLangSelect.value);

    // 回车翻译
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            translateBtn.click();
        }
    });

    translateBtn.onclick = async () => {
        const text = input.value.trim();
        if (!text) return;

        translateBtn.innerText = '...';
        translateBtn.disabled = true;

        try {
            const response = await ST.sendMessage({
                action: 'translate',
                text: text,
                to: targetLangSelect.value
            });

            if (response && response.text) {
                resultArea.classList.add('active');
                resultText.innerText = response.text;
                resultText.style.color = '';
            } else {
                resultArea.classList.add('active');
                resultText.textContent = `翻译失败: ${response?.error || '未知错误'}`;
                resultText.style.color = 'var(--error)';
            }
        } catch (err) {
            resultArea.classList.add('active');
            resultText.innerText = '错误: ' + err.message;
            resultText.style.color = 'var(--error)';
        } finally {
            translateBtn.innerText = '快译';
            translateBtn.disabled = false;
        }
    };

    // 拖动
    let isDragging = false;
    let startX, startY, initialX, initialY;

    header.onmousedown = (e) => {
        if (e.target.closest('.st-control-btn') || e.target.closest('.st-float-close')) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = ST.ui.floatWindow.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;

        document.onmousemove = (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            ST.ui.floatWindow.style.left = `${initialX + dx}px`;
            ST.ui.floatWindow.style.top = `${initialY + dy}px`;
            ST.ui.floatWindow.style.right = 'auto';
        };

        document.onmouseup = () => {
            isDragging = false;
            document.onmousemove = null;
            document.onmouseup = null;
        };
    };

};

/**
 * 切换小窗显示
 */
ST.toggleFloatWindow = function () {
    if (!ST.ui.floatWindow) {
        ST.createFloatWindow();
    }
    const isActive = ST.ui.floatWindow.classList.toggle('active');
    if (isActive) {
        setTimeout(() => {
            ST.ui.floatWindow.querySelector('#st-float-input').focus();
        }, 100);
    }
};

console.log('[智译] FloatWindow module loaded (Enhanced)');
