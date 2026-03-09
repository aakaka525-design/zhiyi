
export function createContextMenus() {
    chrome.contextMenus.removeAll(() => {
        // 翻译选中文本
        chrome.contextMenus.create({
            id: 'translate-selection',
            title: '翻译选中文本',
            contexts: ['selection'],
        });

        // 翻译整个页面
        chrome.contextMenus.create({
            id: 'translate-page',
            title: '沉浸式翻译此页面',
            contexts: ['page'],
        });

        // 分隔线
        chrome.contextMenus.create({
            id: 'separator',
            type: 'separator',
            contexts: ['selection', 'page'],
        });

        // 打开设置
        chrome.contextMenus.create({
            id: 'open-settings',
            title: '翻译设置',
            contexts: ['selection', 'page'],
        });
    });
}

export function setupMenuListeners() {
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
        switch (info.menuItemId) {
            case 'translate-selection':
                if (info.selectionText) {
                    // 向 content script 发送消息，显示翻译结果
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'showTranslation',
                        text: info.selectionText,
                    });
                }
                break;

            case 'translate-page':
                chrome.tabs.sendMessage(tab.id, {
                    action: 'toggleImmersive',
                });
                break;

            case 'open-settings':
                chrome.runtime.openOptionsPage();
                break;
        }
    });
}
