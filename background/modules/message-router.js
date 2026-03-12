export async function routeMessage(request, deps) {
    const { translator, storage, tts } = deps;

    switch (request.action) {
        case 'translate':
            return translator.translate(request.text, request.from, request.to, request.provider);

        case 'translateBatch': {
            const results = await translator.translateBatch(request.texts, request.from, request.to);
            return { results };
        }

        case 'ttsGLM':
            return tts.handleTTSGLM(request);

        case 'ttsOpenAI':
            return tts.handleTTSOpenAI(request);

        case 'ttsGoogle':
            return tts.handleTTSGoogle(request);

        case 'playAudioOffscreen':
            return tts.playAudioViaOffscreen(request.audioData, request.speed);

        case 'getSettings':
            return storage.getSettings();

        case 'getHistory':
            return storage.getHistory();

        case 'updateSettings':
            await translator.refreshSettings();
            return { success: true };

        default:
            console.warn(`Unknown action: ${request.action}`);
            return { error: 'Unknown action' };
    }
}
