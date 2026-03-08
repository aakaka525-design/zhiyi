/**
 * Smart Translator - OCR 模块
 * 图片文字识别和翻译覆盖
 */

var ST = window.SmartTranslator;

/**
 * 调试日志 - 仅在 debugMode 开启时输出
 */
function debugLog(...args) {
    if (ST.state.settings?.debugMode) {
        console.log('[智译]', ...args);
    }
}

/**
 * 处理 OCR 翻译
 */
ST.handleOCR = async function (imageUrl, targetImage = null) {
    let imgElement = targetImage;
    if (!imgElement) {
        imgElement = document.querySelector(`img[src="${imageUrl}"]`);
    }

    // 无图片元素时使用气泡模式
    if (!imgElement) {
        const dummyRect = { bottom: 100, left: window.innerWidth / 2, width: 0 };
        ST.state.selection.rect = dummyRect;
        ST.showBubble('正在识别图片文字...');

        try {
            const result = await ST.sendMessage({
                action: 'translateImageUrl',
                imageUrl: imageUrl,
                to: ST.state.settings?.targetLang || 'zh'
            });
            if (result && result.text && ST.ui.bubble) {
                const resultDiv = ST.ui.bubble.querySelector('.st-bubble-result');
                resultDiv.innerHTML = `<pre style="white-space: pre-wrap; font-family: inherit;">${result.text}</pre>`;
            }
        } catch (err) {
            if (ST.ui.bubble) {
                ST.ui.bubble.querySelector('.st-bubble-result').innerHTML =
                    `<span style="color: #ff5252">OCR 失败: ${err.message}</span>`;
            }
        }
        return;
    }

    // === 漫画翻译覆盖层模式 ===

    // 检查是否已有覆盖层
    let existingWrapper = imgElement.parentElement;
    if (existingWrapper && existingWrapper.classList.contains('st-image-overlay-container')) {
        const overlay = existingWrapper.querySelector('.st-image-overlay');
        overlay.classList.toggle('hidden');
        return;
    }

    // 获取图片尺寸
    const rect = imgElement.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // 包裹图片
    const wrapper = document.createElement('div');
    wrapper.className = 'st-image-overlay-container';
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';
    wrapper.style.width = width + 'px';
    wrapper.style.height = height + 'px';
    imgElement.parentNode.insertBefore(wrapper, imgElement);
    wrapper.appendChild(imgElement);
    imgElement.style.display = 'block';
    imgElement.style.width = '100%';
    imgElement.style.height = '100%';

    // 创建覆盖层
    const overlay = document.createElement('div');
    overlay.className = 'st-image-overlay';
    overlay.innerHTML = `
        <div class="st-image-overlay-loading">
            <div class="st-spinner"></div>
            <span>正在汉化漫画...</span>
        </div>
    `;
    wrapper.appendChild(overlay);

    try {
        let boxes = null;
        let fromCache = false;

        // === 检查缓存 ===
        if (ST.translationCache && ST.translationCache.has(imageUrl)) {
            const cachedBoxes = ST.translationCache.get(imageUrl);
            if (cachedBoxes && cachedBoxes.length > 0) {
                debugLog('使用缓存的翻译结果:', cachedBoxes.length, '个文字框');
                boxes = cachedBoxes;
                fromCache = true;
            }
        }

        // 如果没有缓存，调用 API
        if (!boxes) {
            const result = await ST.sendMessage({
                action: 'translateMangaImage',
                imageUrl: imageUrl,
                pageUrl: window.location.href,
                to: ST.state.settings?.targetLang || 'zh'
            });

            if (result && result.boxes && result.boxes.length > 0) {
                boxes = result.boxes;

                // === 保存到缓存 ===
                if (ST.translationCache) {
                    ST.translationCache.save(imageUrl, boxes);
                }
            }
        }

        overlay.innerHTML = '';

        // 获取 wrapper 的实际尺寸用于坐标计算
        const wrapperRect = wrapper.getBoundingClientRect();
        const renderWidth = wrapperRect.width;
        const renderHeight = wrapperRect.height;
        debugLog(`渲染尺寸: ${renderWidth} x ${renderHeight}`);

        if (boxes && boxes.length > 0) {
            debugLog('渲染文字框:', boxes.length, '个', fromCache ? '(来自缓存)' : '(来自API)');

            // 创建嵌字层
            boxes.forEach((item, index) => {
                if (!item.box_2d) return;

                // box_2d 格式: [ymin, xmin, ymax, xmax] (归一化到 0-1000)
                let [y1, x1, y2, x2] = item.box_2d;

                // 确保坐标顺序正确
                const ymin = Math.min(y1, y2);
                const ymax = Math.max(y1, y2);
                const xmin = Math.min(x1, x2);
                const xmax = Math.max(x1, x2);

                const top = (ymin / 1000) * renderHeight;
                const left = (xmin / 1000) * renderWidth;
                const boxHeight = ((ymax - ymin) / 1000) * renderHeight;
                const boxWidth = ((xmax - xmin) / 1000) * renderWidth;

                // 判断是否有译文
                const hasTranslation = item.translated && item.translated.trim() !== '';

                debugLog(`文字框 ${index}: 原文="${item.original || '(空)'}" -> 译文="${hasTranslation ? item.translated?.substring(0, 15) + '...' : '(无)'}"`);
                debugLog(`文字框 ${index} 坐标: top=${top.toFixed(1)}, left=${left.toFixed(1)}, w=${boxWidth.toFixed(1)}, h=${boxHeight.toFixed(1)}`);

                // 创建检测区域边框（仅在调试模式下显示）
                if (ST.state.settings?.debugMode) {
                    const debugBox = document.createElement('div');
                    debugBox.className = 'st-manga-debug-box';
                    debugBox.style.cssText = `
                        position: absolute;
                        top: ${top}px;
                        left: ${left}px;
                        width: ${boxWidth}px;
                        height: ${boxHeight}px;
                        border: 3px ${hasTranslation ? 'solid #00ff00' : 'solid #ff6600'};
                        background: ${hasTranslation ? 'rgba(0,255,0,0.15)' : 'rgba(255,102,0,0.2)'};
                        box-sizing: border-box;
                        pointer-events: none;
                        z-index: 9999;
                    `;
                    // 添加序号标签
                    const label = document.createElement('span');
                    label.style.cssText = `
                        position: absolute;
                        top: -20px;
                        left: 0;
                        background: ${hasTranslation ? '#00ff00' : '#ff6600'};
                        color: #000;
                        font-size: 12px;
                        font-weight: bold;
                        padding: 2px 6px;
                        border-radius: 3px;
                        white-space: nowrap;
                    `;
                    label.textContent = `#${index} ${hasTranslation ? '✓' : '无文字'}`;
                    debugBox.appendChild(label);
                    overlay.appendChild(debugBox);
                }

                // 跳过没有译文的项（不创建文字覆盖层）
                if (!hasTranslation) {
                    return;
                }

                const textBox = document.createElement('div');
                textBox.className = 'st-manga-text-box';

                textBox.style.cssText = `
                    position: absolute;
                    top: ${top}px;
                    left: ${left}px;
                    width: ${boxWidth}px;
                    height: ${boxHeight}px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    text-align: center;
                    padding: 2px;
                    box-sizing: border-box;
                    overflow: hidden;
                    line-height: 1.2;
                    border-radius: 4px;
                    z-index: 1000;
                `;

                const fontSize = Math.max(12, Math.min(boxWidth / 4.5, boxHeight / 1.5, 20));
                textBox.style.fontSize = fontSize + 'px';

                // 应用字体
                const fontStyle = ST.state.settings?.mangaFontStyle || 'sans-serif';
                const fontFamilyMap = {
                    'sans-serif': '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif',
                    'rounded': '"Yuanti SC", "HanYi Wenhei", "PingFang SC", sans-serif',
                    'handwritten': '"STKaiti", "Kaiti SC", "KaiTi", "AR PL UKai CN", cursive',
                    'serif': '"STSong", "SimSun", "Songti SC", "Noto Serif SC", serif'
                };
                textBox.style.fontFamily = fontFamilyMap[fontStyle] || fontFamilyMap['sans-serif'];

                textBox.innerText = item.translated;
                textBox.title = `原文: ${item.original}`;

                overlay.appendChild(textBox);
            });

            // 控制栏
            const controls = document.createElement('div');
            controls.className = 'st-image-overlay-header';
            controls.style.cssText = 'position: absolute; top: 0; width: 100%;';
            controls.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 14px;">✨ 汉化已完成</span>
                </div>
                <div class="st-image-overlay-actions">
                    <div class="st-transparency-slider-container">
                        <span style="font-size: 10px; opacity: 0.8;">透明度</span>
                        <input type="range" class="st-transparency-slider" min="0" max="100" value="95">
                    </div>
                    <button class="st-image-overlay-btn" id="st-overlay-close">关闭</button>
                </div>
            `;
            overlay.insertBefore(controls, overlay.firstChild);

            // 透明度控制
            const slider = controls.querySelector('.st-transparency-slider');
            slider.oninput = (e) => {
                const val = e.target.value / 100;
                overlay.querySelectorAll('.st-manga-text-box').forEach(box => {
                    box.style.opacity = val;
                });
            };

            overlay.querySelector('#st-overlay-close').onclick = () => {
                wrapper.parentNode.insertBefore(imgElement, wrapper);
                wrapper.remove();
            };

        } else {
            // 回退模式
            overlay.innerHTML = `
                <div class="st-image-overlay-header">
                    <span>📖 文字识别结果</span>
                    <div class="st-image-overlay-actions">
                        <button class="st-image-overlay-btn" id="st-overlay-close">✕</button>
                    </div>
                </div>
                <div class="st-image-overlay-content">
                    <div class="translated-text">${result.raw || '未能识别到文字位置'}</div>
                </div>
            `;
            overlay.querySelector('#st-overlay-close').onclick = () => {
                wrapper.parentNode.insertBefore(imgElement, wrapper);
                wrapper.remove();
            };
        }
    } catch (err) {
        overlay.innerHTML = `<div style="color: #ff5252; padding: 20px; background: rgba(0,0,0,0.8); text-align: center;">❌ 汉化失败: ${err.message}</div>`;
        setTimeout(() => {
            wrapper.parentNode.insertBefore(imgElement, wrapper);
            wrapper.remove();
        }, 3000);
    }
};

/**
 * 图片 OCR 区域选择
 */
ST.startImageAreaSelection = function () {
    alert('请在图片上点击右键选择"翻译图片文字"');
};

console.log('[智译] OCR module loaded');
