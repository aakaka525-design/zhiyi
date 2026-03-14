# 059 — Background Settings Patch 单入口 & Popup 翻译/TTS 超时保护报告

- 状态: done
- 对应任务: [tasks/059-storage-race-popup-timeout.md](../tasks/059-storage-race-popup-timeout.md)
- 来源讨论: [discussions/059-storage-race-popup-timeout.md](../discussions/059-storage-race-popup-timeout.md)
- 执行日期: 2026-03-14

## 结果概览

本轮完成了 `A + B`：

- `A` settings partial write 现在统一经由 background 的 `patchSettings` 单入口串行化处理，popup / options / content script 不再各自做 `get → merge → set`。
- `B` popup 的翻译、远程 TTS 音频请求和 offscreen 播放都补上了本地 timeout，挂起时不会再把 popup UI 永久锁死。

## 已完成改动

### 59.1 A Background `patchSettings` 单入口

[message-router.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/message-router.js) 新增了 module-level 的：

```javascript
let settingsQueue = Promise.resolve();
```

以及新的 `patchSettings` case：

```javascript
case 'patchSettings': {
    const task = settingsQueue.then(async () => {
        await storage.updateSettings(request.updates);
        await translator.refreshSettings();
        return { success: true };
    });
    settingsQueue = task.catch(() => {});
    return task;
}
```

这样所有 settings partial write 都会通过同一个 background 队列串行落盘。  
这轮没有改 [storage.js](/Users/xa/Desktop/projiect/zhiyi/src/core/storage.js) 的 `updateSettings()` 实现，而是把它收敛成“只在 background 内部使用”。

对应调用方已全部改成发消息，而不是本地写 storage：

- [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js)
- [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js)
- [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js)
- [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js)

其中：

- sidebar / float-window 的 `saveLanguageSettings(partialSettings)` 现在都是 fire-and-forget：
  ```javascript
  ST.sendMessage({ action: 'patchSettings', updates: partialSettings });
  ```
- popup 的 `saveLanguageSettings()` 改成：
  ```javascript
  chrome.runtime.sendMessage({ action: 'patchSettings', updates: {...} });
  ```
- options 的 `saveSettings()` 和 `saveImmediateToggle()` 现在直接 `await chrome.runtime.sendMessage({ action: 'patchSettings', ... })`，不再拆成 `StorageManager.updateSettings(...) + updateSettings` 两步。

### 59.2 B Popup 本地 timeout

[popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 顶部新增了局部 `withTimeout(...)`，保持和 options 页相同模式，但没有抽共享 helper：

```javascript
function withTimeout(promise, ms, message = '请求超时') {
    let timeoutId;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(message)), ms);
        }),
    ]).finally(() => clearTimeout(timeoutId));
}
```

这轮实际只包了 3 条 popup 路径：

1. `handleTranslate()` 里的 `translator.translate(...)`
   - `30000ms`
   - 超时消息：`翻译请求超时`

2. `speak()` 里的 `requestTtsAudio(...)`
   - `15000ms`
   - 超时消息：`TTS 请求超时`

3. `speak()` 里的 `chrome.runtime.sendMessage({ action: 'playAudioOffscreen', ... })`
   - `15000ms`
   - 超时消息：`播放超时`

远程 TTS 路径超时后仍保持现有 fallback 行为：popup 会回退到 system TTS。  
这轮刻意没有给 system TTS 本身加硬 timeout，保持和 056 的收口一致。

## TDD 记录

本轮先新增了 [059-storage-race-popup-timeout.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/059-storage-race-popup-timeout.test.mjs)。

首次运行时，两条子测试都失败，分别暴露出：

- `message-router.js` 还没有 `patchSettings` 队列入口，sidebar / float-window / popup / options 也还没统一走消息写入
- popup 还没有本地 `withTimeout(...)`，翻译和远程 TTS 路径也都没有 timeout 包装

实现补丁后，这条新增测试转绿。  
全量验证阶段还同步更新了两条旧静态断言：

- [immersive-selection-options-toggle.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/immersive-selection-options-toggle.test.mjs)
- [sidebar-lang-persist-options-tts-promise.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/sidebar-lang-persist-options-tts-promise.test.mjs)

它们原本锁定的是 `059` 之前的旧实现，和本轮任务目标冲突；更新后与 `patchSettings` 新模型对齐。

## 验证

本轮实际跑过：

```bash
node --test tests/059-storage-race-popup-timeout.test.mjs
node --test tests/immersive-selection-options-toggle.test.mjs tests/sidebar-lang-persist-options-tts-promise.test.mjs
node --test tests/*.test.mjs
node --check background/modules/message-router.js
node --check content/modules/sidebar.js
node --check content/modules/float-window.js
node --check popup/popup.js
node --check options/options.js
git diff --check
```

验证结果：

- [059-storage-race-popup-timeout.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/059-storage-race-popup-timeout.test.mjs)：2/2 通过
- `node --test tests/*.test.mjs`：197/197 通过
- [message-router.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/message-router.js) `node --check` 通过
- [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) `node --check` 通过
- [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) `node --check` 通过
- [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) `node --check` 通过
- [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) `node --check` 通过
- `git diff --check` 无输出

补充说明：

- 第一次全量 `node --test tests/*.test.mjs` 时，`ui-polish-architecture.test.mjs` 出现过一次 Node test runner 反序列化异常；该文件单跑是绿的，随后重跑全量也绿，因此本轮按偶发 runner 噪音记录，不归因为 `059` 代码回归。

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- sidebar / float-window 快速切换 source/target 语言时，不再互相覆盖
- popup / options / content script 并发改 settings 时，最后结果不再被旧值写回
- popup 翻译请求挂起 30 秒后，会恢复按钮并显示 `翻译请求超时`
- popup 远程 TTS 请求或 offscreen 播放挂起 15 秒后，不会把朗读按钮永久锁死
