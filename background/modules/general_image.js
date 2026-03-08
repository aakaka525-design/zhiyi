
import { fetchWithTimeout, blobToBase64 } from './utils.js';

export async function handleTranslateImageUrl(request, translator) {
    const ocrProvider = request.provider || translator.settings?.provider || 'gemini';
    const ocrEngine = translator.providers[ocrProvider];

    if (!ocrEngine || !ocrEngine.apiKey) {
        throw new Error(`请先在设置中配置 ${ocrProvider} API Key 以使用图片翻译功能`);
    }

    // 在背景脚本中 fetch 图片（避免 CORS），添加浏览器 headers 绕过防盗链
    try {
        console.log('[智译] 正在获取图片:', request.imageUrl);
        const imgResponse = await fetchWithTimeout(request.imageUrl, {
            method: 'GET',
            headers: {
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
            },
            mode: 'cors',
            credentials: 'omit',
        }, 15000); // 15秒获取超时

        if (!imgResponse.ok) {
            throw new Error(`HTTP ${imgResponse.status}: ${imgResponse.statusText}`);
        }

        const imgBlob = await imgResponse.blob();
        console.log('[智译] 图片获取成功, 大小:', imgBlob.size, '类型:', imgBlob.type);

        if (imgBlob.size === 0) {
            throw new Error('图片内容为空');
        }

        // 将 blob 转为 base64
        const base64Image = await blobToBase64(imgBlob);

        // Fix: Use ocrEngine instead of undefined geminiOcr
        const ocrResult = await ocrEngine.translateImage(base64Image, request.to || 'zh');
        return { text: ocrResult };
    } catch (fetchErr) {
        console.error('[智译] 图片获取失败:', fetchErr, 'URL:', request.imageUrl);
        throw new Error(`无法获取图片: ${fetchErr.message}`);
    }
}

export async function handleTranslateImage(request, translator) {
    const imgProvider = request.provider || translator.settings?.provider || 'gemini';
    const imgEngine = translator.providers[imgProvider];

    if (!imgEngine || !imgEngine.apiKey) {
        throw new Error(`请先在设置中配置 ${imgProvider} API Key 以使用图片翻译功能`);
    }
    const imageResult = await imgEngine.translateImage(request.image, request.to || 'zh');
    return { text: imageResult };
}
