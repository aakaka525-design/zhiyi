export const SHORTCUT_SETTINGS_URL = 'chrome://extensions/shortcuts';

function normalizeString(value) {
    return (value || '').trim();
}

export function buildSettingsSnapshot(settings) {
    return {
        targetLang: settings.targetLang,
        enableSelection: Boolean(settings.enableSelection),
        enableShortcut: Boolean(settings.enableShortcut),
        showFloatingBall: Boolean(settings.showFloatingBall),
        enableAdBlock: Boolean(settings.enableAdBlock),
        provider: settings.provider,
        openaiApiKey: normalizeString(settings.openaiApiKey),
        openaiBaseUrl: normalizeString(settings.openaiBaseUrl),
        openaiModel: normalizeString(settings.openaiModel),
        geminiApiKey: normalizeString(settings.geminiApiKey),
        geminiModel: normalizeString(settings.geminiModel),
        deepseekApiKey: normalizeString(settings.deepseekApiKey),
        deepseekBaseUrl: normalizeString(settings.deepseekBaseUrl),
        deepseekModel: normalizeString(settings.deepseekModel),
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
