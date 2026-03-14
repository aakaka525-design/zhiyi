
export function createContextMenus() {
    chrome.contextMenus.removeAll(() => {
        // 翻译选中文本
        chrome.contextMenus.create({
            id: 'translate-selection',
            title: '翻译选中文本',
            contexts: ['selection'],
            documentUrlPatterns: ['http://*/*', 'https://*/*'],
        });

        // 翻译整个页面
        chrome.contextMenus.create({
            id: 'translate-page',
            title: '沉浸式翻译此页面',
            contexts: ['page'],
            documentUrlPatterns: ['http://*/*', 'https://*/*'],
        });

        // 分隔线
        chrome.contextMenus.create({
            id: 'separator',
            type: 'separator',
            contexts: ['selection', 'page'],
            documentUrlPatterns: ['http://*/*', 'https://*/*'],
        });

        // 打开设置
        chrome.contextMenus.create({
            id: 'open-settings',
            title: '翻译设置',
            contexts: ['selection', 'page'],
            documentUrlPatterns: ['http://*/*', 'https://*/*'],
        });
    });
}

export function setupMenuListeners() {
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
        switch (info.menuItemId) {
            case 'translate-selection':
                if (info.selectionText && tab?.id) {
                    try {
                        await chrome.tabs.sendMessage(tab.id, {
                            action: 'showTranslation',
                            text: info.selectionText,
                        });
                    } catch (err) {
                        console.warn('右键翻译失败:', err);
                    }
                }
                break;

            case 'translate-page':
                if (tab?.id) {
                    try {
                        await chrome.tabs.sendMessage(tab.id, {
                            action: 'toggleImmersive',
                        });
                    } catch (err) {
                        console.warn('右键沉浸翻译失败:', err);
                    }
                }
                break;

            case 'open-settings':
                chrome.runtime.openOptionsPage();
                break;
        }
    });
}
