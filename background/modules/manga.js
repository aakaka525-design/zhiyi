
import { fetchWithTimeout } from './utils.js';
import { QwenVLTranslator } from '../../src/core/qwenvl.js';
import { nativeOCR } from '../../src/core/native-ocr.js';

export async function handleMangaImage(request, translator) {
    if (!translator) {
        throw new Error('Translator not initialized');
    }

    // 根据用户设置选择漫画翻译引擎
    const mangaOcrSetting = translator.settings?.mangaOcrEngine || 'qwenvl-30b';
    let mangaEngine = null;
    let mangaEngineName = '';

    if (mangaOcrSetting === 'local-paddleocr-vl') {
        return handlePaddleOCRVL(request, translator);
    } else if (mangaOcrSetting === 'local-smoldocling') {
        return handleSmolDocling(request, translator);
    } else if (mangaOcrSetting === 'local-hybrid') {
        return handleHybridMode(request, translator);
    } else if (mangaOcrSetting === 'local-paddle') {
        return handleLocalPaddle(request, translator);
    }

    // Default Cloud Processing
    return handleCloudManga(request, translator, mangaOcrSetting);
}

// -----------------------------------------------------------------------------
// PaddleOCR-VL Mode: Local VL model for detection + recognition, cloud translation
// -----------------------------------------------------------------------------

async function handlePaddleOCRVL(request, translator) {
    console.log('[智译] 使用 PaddleOCR-VL 本地模型');

    const mangaBase64 = await fetchImageBase64(request.imageUrl);

    // 调用本地 PaddleOCR-VL 进行 OCR（检测+识别）
    const ocrResult = await nativeOCR.sendMessage({
        action: 'paddleocr_vl',
        image: mangaBase64,
        width: 1000,
        height: 1000
    });

    if (ocrResult.error) {
        throw new Error(ocrResult.error);
    }

    const regions = ocrResult.regions || [];
    if (regions.length === 0) {
        console.log('[智译] PaddleOCR-VL: 未检测到文字');
        return { boxes: [] };
    }

    console.log('[智译] PaddleOCR-VL: 检测到', regions.length, '个区域');

    // 翻译识别结果
    const targetLang = request.to || 'zh';
    const resultBoxes = [];

    for (const region of regions) {
        const recognized = region.text || '';
        let translated = '';

        if (recognized && recognized.trim()) {
            console.log(`[智译] 区域${region.index}: "${recognized.substring(0, 30)}..."`);
            try {
                const translateEngine = translator.providers[translator.settings?.provider || 'gemini'];
                if (translateEngine) {
                    translated = await translateEngine.translate(recognized, 'auto', targetLang);
                } else {
                    translated = recognized;
                }
            } catch (e) {
                console.warn('[智译] 翻译失败:', e.message);
                translated = recognized;
            }
        }

        // 即使没有识别出文字，保留检测框以便前端调试显示
        resultBoxes.push({
            original: recognized || '',
            translated: translated || recognized || '',
            box_2d: region.box_2d,
            confidence: 0.95
        });
    }

    console.log('[智译] PaddleOCR-VL 完成:', resultBoxes.length, '个文字框');
    return { boxes: resultBoxes };
}

// -----------------------------------------------------------------------------
// Sub-handlers for different modes
// -----------------------------------------------------------------------------

async function handleSmolDocling(request, translator) {
    // SmolDocling 模式：本地 256M 模型进行完整 OCR
    console.log('[智译] 使用 SmolDocling 本地模型');

    // 获取图片数据
    const mangaBase64 = await fetchImageBase64(request.imageUrl);

    // 调用本地 SmolDocling 进行 OCR
    const ocrResult = await nativeOCR.sendMessage({
        action: 'smol_docling',
        image: mangaBase64,
        width: 1000,
        height: 1000
    });

    if (ocrResult.error) {
        throw new Error(ocrResult.error);
    }

    // 翻译识别结果
    const targetLang = request.to || 'zh';
    const boxes = ocrResult.boxes || [];

    for (const box of boxes) {
        if (box.original && !box.translated) {
            try {
                const translateEngine = translator.providers[translator.settings?.provider || 'gemini'];
                if (translateEngine) {
                    box.translated = await translateEngine.translate(box.original, 'auto', targetLang);
                } else {
                    box.translated = box.original;
                }
            } catch (e) {
                box.translated = box.original;
            }
        }
    }

    console.log('[智译] SmolDocling 完成:', boxes.length, '个文字框');
    return { boxes };
}

async function handleHybridMode(request, translator) {
    // 混合模式：本地检测 + 云端识别翻译
    // 现在已重构为由 Python 端内部处理循环，极大提高效率和稳定性
    console.log('[智译] 使用混合模式: 本地检测 + 云端识别 (Python 端处理)');

    const mangaBase64 = await fetchImageBase64(request.imageUrl);
    const imageWidth = request.imageWidth || 1000;
    const imageHeight = request.imageHeight || 1000;

    // 从 Chrome 存储中获取 PPInfra API Key (存储键名为 deepseekApiKey)
    // 以及检测器类型 (ocrDetectorType: 'server' 或 'mobile')
    let ppinfraApiKey = null;
    let detectorType = 'server';
    try {
        const storage = await chrome.storage.local.get(['settings']);
        ppinfraApiKey = storage.settings?.deepseekApiKey || null;
        detectorType = storage.settings?.ocrDetectorType || 'server';
        if (ppinfraApiKey) {
            console.log('[智译] 混合模式: 已获取 PPInfra API Key');
        } else {
            console.warn('[智译] 混合模式: 未找到 PPInfra API Key，将尝试使用 config.txt');
        }
        console.log(`[智译] 混合模式: 使用 ${detectorType} 检测器`);
    } catch (e) {
        console.warn('[智译] 混合模式: 读取设置失败', e.message);
    }

    try {
        // 直接调用带 AI 参数的 nativeOCR，传入 API Key 和检测器类型
        const boxes = await nativeOCR.detectTextAI(mangaBase64, imageWidth, imageHeight, ppinfraApiKey, detectorType);

        if (!boxes || boxes.length === 0) {
            console.log('[智译] 混合模式: 未检测到文字或 AI 识别失败');
            return { boxes: [] };
        }

        const result = boxes.map((box, index) => ({
            original: box.text,
            translated: box.translation || box.text, // 优先使用 Python 返回的翻译
            box_2d: box.box_2d,
            confidence: box.confidence || 0.95
        }));

        console.log('[智译] 混合模式完成:', result.length, '个文字框');
        return { boxes: result };

    } catch (e) {
        console.error('[智译] 混合模式: 失败', e.message);
        // 如果 native 失败，回退到纯云端模式（作为兜底）
        return handleCloudManga(request, translator, 'qwenvl-30b');
    }
}

async function handleLocalPaddle(request, translator) {
    console.log('[智译] 使用本地 PaddleOCR');
    const mangaBase64 = await fetchImageBase64(request.imageUrl);
    const imageWidth = request.imageWidth || 1000;
    const imageHeight = request.imageHeight || 1000;

    const boxes = await nativeOCR.detectText(mangaBase64, imageWidth, imageHeight);
    if (!boxes || boxes.length === 0) return { boxes: [] };

    const originalTexts = boxes.map(box => box.text);
    const translateEngine = translator.providers[translator.settings?.provider || 'gemini'];
    let translatedTexts = originalTexts;

    if (translateEngine) {
        try {
            const translations = await translateEngine.translateBatch(originalTexts, 'auto', request.to || 'zh');
            translatedTexts = translations;
        } catch (e) {
            console.warn('[智译] 批量翻译失败，使用原文:', e.message);
        }
    }

    const result = boxes.map((box, index) => ({
        original: box.text,
        translated: translatedTexts[index] || box.text,
        box_2d: box.box_2d,
        confidence: box.confidence
    }));

    console.log('[智译] 本地 OCR 结果:', result.length, '个文字框');
    return { boxes: result };
}

async function handleCloudManga(request, translator, mangaOcrSetting) {
    let mangaEngine = null;
    let mangaEngineName = '';

    if (mangaOcrSetting === 'custom') {
        const customKey = translator.settings?.customMangaApiKey;
        const customUrl = translator.settings?.customMangaBaseUrl;
        const customModel = translator.settings?.customMangaModel;

        if (!customKey || !customUrl || !customModel) {
            throw new Error('请在设置中填写完整的自定义漫画 API 配置（API Key、Base URL、模型名称）');
        }
        mangaEngine = new QwenVLTranslator(customKey, customUrl, customModel);
        mangaEngineName = `自定义 (${customModel})`;
    } else if (mangaOcrSetting === 'gemini') {
        mangaEngine = translator.providers.gemini;
        mangaEngineName = 'Gemini';
    } else {
        mangaEngine = translator.providers.qwenvl;
        mangaEngineName = mangaOcrSetting === 'qwenvl-8b' ? 'Qwen-VL-8B' : 'Qwen-VL-30B';
        if (mangaEngine) {
            mangaEngine.model = mangaOcrSetting === 'qwenvl-8b' ? 'qwen/qwen3-vl-8b-instruct' : 'qwen/qwen3-vl-30b-a3b-instruct';
        }
    }

    // 回退逻辑
    if (!mangaEngine || !mangaEngine.apiKey) {
        if (mangaOcrSetting !== 'gemini' && translator.providers.gemini?.apiKey) {
            mangaEngine = translator.providers.gemini;
            mangaEngineName = 'Gemini (回退)';
        } else if (mangaOcrSetting === 'gemini' && translator.providers.qwenvl?.apiKey) {
            mangaEngine = translator.providers.qwenvl;
            mangaEngineName = 'Qwen-VL (回退)';
        }
    }

    if (!mangaEngine || !mangaEngine.apiKey) {
        throw new Error('漫画翻译需要配置 API Key。请在设置页面配置。');
    }

    console.log('[智译] 使用引擎:', mangaEngineName);
    const mangaBase64 = await fetchImageBase64(request.imageUrl);
    console.log('[智译] 图片数据长度:', mangaBase64.length);

    try {
        const mangaResult = await mangaEngine.translateImageWithBoxes(mangaBase64, request.to || 'zh');
        console.log('[智译] 漫画翻译结果:', mangaResult);
        return mangaResult;
    } catch (mangaErr) {
        console.error('[智译] 漫画翻译失败:', mangaErr);
        throw new Error(`漫画翻译失败: ${mangaErr.message}`);
    }
}

async function fetchImageBase64(imageUrl) {
    const response = await fetchWithTimeout(imageUrl, {
        method: 'GET',
        headers: {
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
    }, 30000);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const blob = await response.blob();
    if (blob.size === 0) throw new Error('Empty image');

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
