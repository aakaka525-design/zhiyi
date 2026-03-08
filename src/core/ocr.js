/**
 * OCR 翻译辅助工具
 */

export class OCRManager {
    /**
     * 截取屏幕区域进行 OCR (简化版，先处理右键点击的图片)
     */
    static async translateImageContent(imageUrl) {
        // 1. 获取图片 base64
        const base64 = await this.getBase64FromUrl(imageUrl);

        // 2. 发送给后台或直接调用 Gemini
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'translateImage',
                image: base64,
                to: 'zh'
            }, (response) => {
                if (response.error) reject(new Error(response.error));
                else resolve(response.text);
            });
        });
    }

    /**
     * 从 URL 获取图片的 Base64 数据
     */
    static async getBase64FromUrl(url) {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
}
