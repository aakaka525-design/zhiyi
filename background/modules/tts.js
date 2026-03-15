import { fetchWithTimeout } from '../../src/core/fetch-with-timeout.js';

let creatingOffscreen = null;
const DEFAULT_GOOGLE_TTS_VOICE = 'cmn-CN-Chirp3-HD-Aoede';

function getGoogleTtsLanguageCode(voice = DEFAULT_GOOGLE_TTS_VOICE) {
    const [language, region] = typeof voice === 'string' ? voice.split('-') : [];
    if (language && region) {
        return `${language}-${region}`;
    }
    return 'cmn-CN';
}

async function ensureOffscreenDocument() {
    const offscreenUrl = chrome.runtime.getURL('offscreen/offscreen.html');

    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl]
    });

    if (existingContexts.length > 0) return;

    if (creatingOffscreen) {
        await creatingOffscreen;
        return;
    }

    creatingOffscreen = chrome.offscreen.createDocument({
        url: offscreenUrl,
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Playing TTS audio for translation extension'
    });

    try {
        await creatingOffscreen;
    } finally {
        creatingOffscreen = null;
    }
}

export async function playAudioViaOffscreen(audioData, speed = 1.0) {
    await ensureOffscreenDocument();
    return chrome.runtime.sendMessage({ action: 'playAudio', audioData, speed });
}

export async function stopAudioViaOffscreen() {
    const offscreenUrl = chrome.runtime.getURL('offscreen/offscreen.html');
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl]
    });

    if (existingContexts.length === 0) {
        return { success: true };
    }

    return chrome.runtime.sendMessage({ action: 'stopAudio' });
}

export async function handleTTSGLM(request) {
    try {
        const apiKey = request.apiKey;
        const voice = request.voice || 'tongtong';
        const text = request.text;
        const speed = request.speed || 1.0;

        if (!apiKey) {
            return { error: '缺少 ppinfra API Key' };
        }

        const response = await fetchWithTimeout('https://api.ppinfra.com/v3/glm-tts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                input: text,
                voice: voice,
                speed: speed,
                response_format: 'wav'
            })
        }, 12000, 'TTS 请求超时');

        if (!response.ok) {
            const errText = await response.text();
            console.error('[TTS] GLM 响应错误:', errText);
            return { error: errText };
        }

        const audioBlob = await response.blob();
        const reader = new FileReader();
        const audioData = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result); // data:audio/wav;base64,...
            reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
            reader.readAsDataURL(audioBlob);
        });

        return { audioData };
    } catch (err) {
        console.error('[TTS] GLM TTS 失败:', err);
        return { error: err.message };
    }
}

export async function handleTTSOpenAI(request) {
    try {
        const { apiKey, baseUrl, text, voice, speed } = request;
        if (!apiKey) return { error: '缺少 OpenAI API Key' };

        const response = await fetchWithTimeout(`${baseUrl || 'https://api.openai.com/v1'}/audio/speech`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'tts-1',
                input: text,
                voice: voice || 'nova',
                speed: speed || 1.0
            })
        }, 12000, 'TTS 请求超时');

        if (!response.ok) {
            return { error: `OpenAI TTS 失败: ${response.status}` };
        }

        const audioBlob = await response.blob();
        const reader = new FileReader();
        const audioData = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
            reader.readAsDataURL(audioBlob);
        });

        return { audioData };
    } catch (err) {
        console.error('[TTS] OpenAI 失败:', err);
        return { error: err.message };
    }
}

export async function handleTTSGoogle(request) {
    try {
        const { apiKey, text, voice, speed } = request;
        if (!apiKey) return { error: '缺少 Gemini API Key' };

        const selectedVoice = voice || DEFAULT_GOOGLE_TTS_VOICE;
        const voiceLang = getGoogleTtsLanguageCode(selectedVoice);
        const response = await fetchWithTimeout(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input: { text },
                voice: { languageCode: voiceLang, name: selectedVoice },
                audioConfig: { audioEncoding: 'MP3', speakingRate: speed || 1.0 }
            })
        }, 12000, 'TTS 请求超时');

        if (!response.ok) {
            const err = await response.json();
            return { error: err.error?.message || 'Google TTS 失败' };
        }

        const data = await response.json();
        if (data.audioContent) {
            return { audioData: `data:audio/mp3;base64,${data.audioContent}` };
        }
        return { error: 'No audio content' };
    } catch (err) {
        console.error('[TTS] Google 失败:', err);
        return { error: err.message };
    }
}
