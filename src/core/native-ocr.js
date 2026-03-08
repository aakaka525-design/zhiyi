/**
 * 智译翻译 - Native OCR 服务
 * 通过 Native Messaging 调用本地 PaddleOCR
 */

const NATIVE_HOST_NAME = 'com.smarttranslator.ocr_host';

class NativeOCRService {
    constructor() {
        this.isAvailable = null;
    }

    /**
     * 检查 Native Host 是否可用
     * 注意：不再缓存结果，每次都实际检查
     */
    async checkAvailability() {
        try {
            const response = await this.sendMessage({ action: 'ping' });
            this.isAvailable = response && response.status === 'ok' && response.paddle_available;
            return this.isAvailable;
        } catch (error) {
            console.error('[智译] Native OCR checkAvailability 失败:', error);
            console.warn('[智译] Native OCR 不可用:', error.message);
            this.isAvailable = false;
            return false;
        }
    }

    /**
     * 预加载 OCR 检测器模型
     * @param {string} detectorType - 'server' 或 'mobile'
     * @returns {Promise<boolean>} - 是否成功预加载
     */
    async preloadDetector(detectorType = 'server') {
        try {
            console.log(`[智译] 预加载 ${detectorType} 检测器...`);
            const response = await this.sendMessage({
                action: 'ping',
                detector_type: detectorType
            });
            const success = response && response.detector_preloaded;
            if (success) {
                console.log(`[智译] ${detectorType} 检测器预加载成功`);
            }
            return success;
        } catch (error) {
            console.warn('[智译] 检测器预加载失败:', error.message);
            return false;
        }
    }

    /**
     * 向 Native Host 发送消息
     */
    sendMessage(message) {
        return new Promise((resolve, reject) => {
            try {
                chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, message, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else if (response && response.error) {
                        reject(new Error(response.error));
                    } else {
                        resolve(response);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * 检测图片中的文字区域
     * @param {string} imageBase64 - Base64 编码的图片
     * @param {number} width - 图片宽度
     * @param {number} height - 图片高度
     * @returns {Promise<Array>} - 检测到的文字框
     */
    async detectText(imageBase64, width, height) {
        const isAvailable = await this.checkAvailability();
        if (!isAvailable) {
            throw new Error('Native OCR 服务不可用，请确保已安装并运行');
        }

        const response = await this.sendMessage({
            action: 'detect_and_translate',
            image: imageBase64,
            width: width,
            height: height
        });

        return response.boxes || [];
    }

    /**
     * 混合模式：只检测文字区域，返回裁剪图片
     * 用于配合云端 AI 进行识别翻译
     * @param {string} imageBase64 - Base64 编码的图片
     * @param {number} width - 图片宽度
     * @param {number} height - 图片高度
     * @returns {Promise<Array>} - 检测到的区域，包含裁剪图片 base64
     */
    async detectRegionsOnly(imageBase64, width, height) {
        const isAvailable = await this.checkAvailability();
        if (!isAvailable) {
            throw new Error('Native OCR 服务不可用，请确保已安装并运行');
        }

        const response = await this.sendMessage({
            action: 'detect_only',
            image: imageBase64,
            width: width,
            height: height
        });

        return response.regions || [];
    }

    /**
     * 高级模式：由 Native Host 内部循环调用 AI 进行识别翻译
     * @param {string} imageBase64 
     * @param {number} width 
     * @param {number} height 
     * @param {string} apiKey - PPInfra API Key (可选，从扩展设置传入)
     * @param {string} detectorType - 检测器类型: 'server' (精度高) 或 'mobile' (速度快)
     */
    async detectTextAI(imageBase64, width, height, apiKey = null, detectorType = 'server') {
        const isAvailable = await this.checkAvailability();
        if (!isAvailable) {
            throw new Error('Native OCR 服务不可用，请确保已安装并运行');
        }

        const message = {
            action: 'detect_ai',
            image: imageBase64,
            width: width,
            height: height,
            detector_type: detectorType
        };

        // 如果提供了 apiKey，添加到消息中
        if (apiKey) {
            message.api_key = apiKey;
        }

        const response = await this.sendMessage(message);

        return response.boxes || [];
    }

    /**
     * 使用本地 OCR 检测并结合 AI 翻译
     * @param {string} imageBase64 - Base64 编码的图片
     * @param {number} width - 图片宽度
     * @param {number} height - 图片高度
     * @param {Function} translateFn - 翻译函数
     * @returns {Promise<Object>} - 包含翻译后的文字框
     */
    async detectAndTranslate(imageBase64, width, height, translateFn) {
        // 1. 使用 PaddleOCR 检测文字位置
        const boxes = await this.detectText(imageBase64, width, height);

        if (!boxes || boxes.length === 0) {
            return { boxes: [] };
        }

        // 2. 提取原文
        const originalTexts = boxes.map(box => box.text);

        console.log('[智译] Native OCR 识别原文:', originalTexts);

        // 3. 批量翻译
        let translatedTexts;
        if (translateFn) {
            translatedTexts = await translateFn(originalTexts);
        } else {
            translatedTexts = originalTexts; // 如果没有翻译函数，保留原文
        }

        // 4. 组合结果
        const result = boxes.map((box, index) => ({
            original: box.text,
            translated: translatedTexts[index] || box.text,
            box_2d: box.box_2d,
            confidence: box.confidence
        }));

        return { boxes: result };
    }
}

// 导出单例
export const nativeOCR = new NativeOCRService();
export default NativeOCRService;
