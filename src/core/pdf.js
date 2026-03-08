/**
 * PDF 翻译辅助工具
 */

export class PDFManager {
    /**
     * PDF 文本提取初步方案
     * 实际生产中建议集成 PDF.js
     */
    static async extractTextFromPDF(url) {
        // 注意：Chrome 扩展中处理远程 PDF 需要特殊处理
        // 这里的简化实现主要用于演示结构
        if (url.startsWith('file://')) {
            throw new Error('暂不支持本地文件夹内的 PDF，请先上传到浏览器或使用 HTTP 链接');
        }

        // 提示用户：正在解析 PDF...
        console.log('正在解析 PDF:', url);
        return 'PDF 解析功能已就绪。请确认已在设置中开启 API。';
    }
}
