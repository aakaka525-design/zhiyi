export const SHORTCUT_SETTINGS_URL = 'chrome://extensions/shortcuts';

export function buildSettingsSnapshot(settings) {
    return {
        targetLang: settings.targetLang,
        enableSelection: Boolean(settings.enableSelection),
        enableShortcut: Boolean(settings.enableShortcut),
        showFloatingBall: Boolean(settings.showFloatingBall),
        enableAdBlock: Boolean(settings.enableAdBlock),
        provider: settings.provider,
        openaiApiKey: settings.openaiApiKey || '',
        openaiBaseUrl: settings.openaiBaseUrl || '',
        openaiModel: settings.openaiModel || '',
        geminiApiKey: settings.geminiApiKey || '',
        geminiModel: settings.geminiModel || '',
        deepseekApiKey: settings.deepseekApiKey || '',
        deepseekBaseUrl: settings.deepseekBaseUrl || '',
        deepseekModel: settings.deepseekModel || '',
        darkMode: Boolean(settings.darkMode),
        debugMode: Boolean(settings.debugMode),
        ttsProvider: settings.ttsProvider || 'system',
        ttsSpeed: Number(settings.ttsSpeed) || 1,
        ttsVoiceOpenai: settings.ttsVoiceOpenai || '',
        ttsVoiceGoogle: settings.ttsVoiceGoogle || '',
        ttsVoiceGlm: settings.ttsVoiceGlm || '',
    };
}

export function hasUnsavedChanges(initialSnapshot, currentSnapshot) {
    return JSON.stringify(initialSnapshot) !== JSON.stringify(currentSnapshot);
}

export function getShortcutSettingsToastMessage(copySucceeded) {
    if (copySucceeded) {
        return '已复制快捷键设置地址，请粘贴到浏览器地址栏打开';
    }
    return `请在浏览器地址栏输入 ${SHORTCUT_SETTINGS_URL}`;
}

export function getSaveButtonLabel(isDirty) {
    return isDirty
        ? '保存并应用配置（有未保存更改）'
        : '保存并应用配置';
}
