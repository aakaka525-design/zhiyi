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
    if (request.action === 'stopAudio') {
        if (cancelCurrent) cancelCurrent();
        sendResponse({ success: true });
        return;
    }
});

let currentAudio = null;
let cancelCurrent = null;

async function playAudio(dataUrl, speed = 1.0) {
    if (cancelCurrent) cancelCurrent();

    const audio = new Audio(dataUrl);
    audio.playbackRate = speed;

    return new Promise((resolve, reject) => {
        currentAudio = audio;
        cancelCurrent = () => {
            audio.pause();
            currentAudio = null;
            cancelCurrent = null;
            resolve();
        };

        audio.onended = () => {
            if (currentAudio === audio) { currentAudio = null; cancelCurrent = null; }
            resolve();
        };
        audio.onerror = () => {
            if (currentAudio === audio) { currentAudio = null; cancelCurrent = null; }
            reject(new Error('Audio playback failed'));
        };
        audio.play().catch((err) => {
            if (currentAudio === audio) { currentAudio = null; cancelCurrent = null; }
            reject(err);
        });
    });
}
