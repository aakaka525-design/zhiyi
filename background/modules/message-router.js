let settingsQueue = Promise.resolve();

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

        case 'stopAudio':
            return tts.stopAudioViaOffscreen();

        case 'getSettings':
            return storage.getSettings();

        case 'getHistory':
            return storage.getHistory();

        case 'addHistory':
            return storage.addHistory(request.item);

        case 'patchSettings': {
            const task = settingsQueue.then(async () => {
                await storage.updateSettings(request.updates);
                await translator.refreshSettings();
                return { success: true };
            });
            settingsQueue = task.catch(() => {});
            return task;
        }

        case 'updateSettings':
            await translator.refreshSettings();
            return { success: true };

        default:
            console.warn(`Unknown action: ${request.action}`);
            return { error: 'Unknown action' };
    }
}
