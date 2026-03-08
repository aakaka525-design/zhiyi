/**
 * Offscreen Document - 用于在独立环境播放音频
 * 不受网页 CSP 限制
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'playAudio' && request.audioData) {
        playAudio(request.audioData, request.speed || 1.0)
            .then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ error: err.message }));
        return true; // 保持消息通道打开
    }
});

async function playAudio(dataUrl, speed = 1.0) {
    const audio = new Audio(dataUrl);
    audio.playbackRate = speed;

    return new Promise((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = (e) => reject(new Error('Audio playback failed'));
        audio.play().catch(reject);
    });
}
