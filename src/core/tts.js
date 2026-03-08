/**
 * TTS 语音合成服务
 * 支持多种高质量 TTS 提供商
 */

export class TTSService {
    constructor(settings) {
        this.settings = settings;
    }

    /**
     * 朗读文本
     * @param {string} text 要朗读的文本
     * @param {string} lang 语言代码 (zh, en, ja, ko)
     */
    async speak(text, lang = 'zh') {
        if (!text) return;

        const provider = this.settings?.ttsProvider || 'system';
        const speed = this.settings?.ttsSpeed || 1.0;

        try {
            switch (provider) {
                case 'openai':
                    await this.speakOpenAI(text, lang, speed);
                    break;
                case 'edge':
                    await this.speakEdge(text, lang, speed);
                    break;
                case 'fish':
                    await this.speakFishAudio(text, lang, speed);
                    break;
                case 'system':
                default:
                    this.speakSystem(text, lang, speed);
                    break;
            }
        } catch (err) {
            console.error('[TTS] 朗读失败:', err);
            // 回退到系统语音
            this.speakSystem(text, lang, speed);
        }
    }

    /**
     * 系统语音 (Web Speech API)
     */
    speakSystem(text, lang, speed) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = speed;

        // 语言映射
        const langMap = {
            'zh': 'zh-CN',
            'en': 'en-US',
            'ja': 'ja-JP',
            'ko': 'ko-KR'
        };
        utterance.lang = langMap[lang] || lang;

        // 尝试选择更好的声音
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v =>
            v.lang.startsWith(langMap[lang] || lang) &&
            (v.name.includes('Neural') || v.name.includes('Enhanced') || v.name.includes('Siri'))
        );
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        window.speechSynthesis.speak(utterance);
    }

    /**
     * OpenAI TTS
     */
    async speakOpenAI(text, lang, speed) {
        const apiKey = this.settings?.openaiApiKey;
        const baseUrl = this.settings?.openaiBaseUrl || 'https://api.openai.com/v1';

        if (!apiKey) {
            throw new Error('请先配置 OpenAI API Key');
        }

        const response = await fetch(`${baseUrl}/audio/speech`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'tts-1',
                input: text,
                voice: this.settings?.ttsVoice || 'nova', // alloy, echo, fable, onyx, nova, shimmer
                speed: speed
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI TTS 请求失败: ${response.status}`);
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.playbackRate = 1; // speed已由API处理
        await audio.play();
    }

    /**
     * Edge TTS (通过后台代理)
     */
    async speakEdge(text, lang, speed) {
        // Edge TTS 声音映射
        const voiceMap = {
            'zh': 'zh-CN-XiaoxiaoNeural',
            'en': 'en-US-AriaNeural',
            'ja': 'ja-JP-NanamiNeural',
            'ko': 'ko-KR-SunHiNeural'
        };

        const voice = this.settings?.ttsVoice || voiceMap[lang] || voiceMap['zh'];

        // 发送到后台处理
        const response = await chrome.runtime.sendMessage({
            action: 'ttsEdge',
            text: text,
            voice: voice,
            rate: speed
        });

        if (response?.audioData) {
            const audioBlob = this.base64ToBlob(response.audioData, 'audio/mp3');
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            await audio.play();
        } else if (response?.error) {
            throw new Error(response.error);
        }
    }

    /**
     * Fish Audio TTS
     */
    async speakFishAudio(text, lang, speed) {
        const apiKey = this.settings?.fishAudioApiKey;
        const voiceId = this.settings?.fishAudioVoice || '';

        if (!apiKey) {
            throw new Error('请先配置 Fish Audio API Key');
        }

        const response = await fetch('https://api.fish.audio/v1/tts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                reference_id: voiceId || undefined,
                format: 'mp3',
                latency: 'normal'
            })
        });

        if (!response.ok) {
            throw new Error(`Fish Audio TTS 请求失败: ${response.status}`);
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.playbackRate = speed;
        await audio.play();
    }

    /**
     * 停止朗读
     */
    stop() {
        window.speechSynthesis.cancel();
        // 停止所有音频元素
        document.querySelectorAll('audio').forEach(a => a.pause());
    }

    /**
     * Base64 转 Blob
     */
    base64ToBlob(base64, mimeType) {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    }
}

/**
 * TTS 提供商列表
 */
export const TTS_PROVIDERS = [
    { id: 'system', name: '系统语音', description: '免费，质量一般' },
    { id: 'openai', name: 'OpenAI TTS', description: '高质量，复用现有Key' },
    { id: 'edge', name: 'Edge TTS', description: '微软神经语音，免费高质量' },
    { id: 'fish', name: 'Fish Audio', description: '超自然中文，需配置Key' }
];

/**
 * OpenAI 声音选项
 */
export const OPENAI_VOICES = [
    { id: 'nova', name: 'Nova', description: '女声，温暖自然' },
    { id: 'alloy', name: 'Alloy', description: '中性，平衡' },
    { id: 'echo', name: 'Echo', description: '男声，沉稳' },
    { id: 'fable', name: 'Fable', description: '英式口音' },
    { id: 'onyx', name: 'Onyx', description: '男声，低沉' },
    { id: 'shimmer', name: 'Shimmer', description: '女声，明亮' }
];

/**
 * Edge TTS 声音选项
 */
export const EDGE_VOICES = {
    'zh': [
        { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓', description: '女声，温柔' },
        { id: 'zh-CN-YunxiNeural', name: '云希', description: '男声，自然' },
        { id: 'zh-CN-XiaoyiNeural', name: '晓伊', description: '女声，活泼' },
        { id: 'zh-CN-YunjianNeural', name: '云健', description: '男声，专业' }
    ],
    'en': [
        { id: 'en-US-AriaNeural', name: 'Aria', description: 'Female, natural' },
        { id: 'en-US-GuyNeural', name: 'Guy', description: 'Male, friendly' },
        { id: 'en-US-JennyNeural', name: 'Jenny', description: 'Female, professional' }
    ],
    'ja': [
        { id: 'ja-JP-NanamiNeural', name: '七海', description: '女声' },
        { id: 'ja-JP-KeitaNeural', name: '慶太', description: '男声' }
    ],
    'ko': [
        { id: 'ko-KR-SunHiNeural', name: 'SunHi', description: '여성' },
        { id: 'ko-KR-InJoonNeural', name: 'InJoon', description: '남성' }
    ]
};
