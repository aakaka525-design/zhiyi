# 054 — TTS 双重倍速修复 & 右键菜单 scheme 级 URL 过滤报告

- 状态: done
- 对应任务: [tasks/054-tts-double-speed-contextmenu-url-guard.md](../tasks/054-tts-double-speed-contextmenu-url-guard.md)
- 来源讨论: [discussions/054-tts-double-speed-contextmenu-url-guard.md](../discussions/054-tts-double-speed-contextmenu-url-guard.md)
- 执行日期: 2026-03-13

## 结果概览

本轮完成了 `A/B`：

- `A` popup 和 options 的 API TTS 播放链不再把 `speed` 同时用于“生成音频”和“offscreen 播放”，重复倍速问题已消除。
- `B` 右键菜单现在只在 `http/https` 文档上显示，不再在 `chrome://`、`about:`、`file://` 这类非内容脚本页面暴露入口。

## 已完成改动

### 54.1 A 去掉 offscreen 播放阶段的重复倍速

[popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 的远程 TTS 播放消息现在从：

```javascript
chrome.runtime.sendMessage({
    action: 'playAudioOffscreen',
    audioData,
    speed,
});
```

改成：

```javascript
chrome.runtime.sendMessage({
    action: 'playAudioOffscreen',
    audioData,
});
```

[options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 的 TTS 测试播放链也做了同样调整，`playAudioOffscreen` 不再接收 `speed`。

这样现在的实际行为是：

- OpenAI / Google / GLM TTS：`speed` 只在 API 生成阶段应用一次
- offscreen 播放阶段走默认 `1.0`
- system TTS 回退仍然保留 `utterance.rate = speed`

本轮没有改：

- [background/modules/tts.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/tts.js)
- [offscreen.js](/Users/xa/Desktop/projiect/zhiyi/offscreen/offscreen.js)
- sidebar / float-window 的现有 TTS 路径

### 54.2 B 右键菜单只显示在 http/https 页面

[menus.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/menus.js) 的 4 个 `chrome.contextMenus.create(...)` 现在都补了：

```javascript
documentUrlPatterns: ['http://*/*', 'https://*/*']
```

覆盖的菜单项包括：

- `translate-selection`
- `translate-page`
- `separator`
- `open-settings`

这次修复按 discussion 收紧后的边界执行，只解决 scheme 级过滤：

- `chrome://` / `about:` / `file://` / 其他非 `http/https` 页面：菜单不显示
- 普通 `http/https` 页面：菜单保持可见
- Chrome Web Store 这类 `https` 受限页面：仍可能显示，继续由 click handler 的 `try/catch` 兜底

本轮没有改：

- [setupMenuListeners()](/Users/xa/Desktop/projiect/zhiyi/background/modules/menus.js)
- popup 里的 `isSupportedPageUrl()`
- keyboard shortcut 处理链

## TDD 记录

本轮按 test-first 执行，先新增了 [tts-double-speed-contextmenu.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/tts-double-speed-contextmenu.test.mjs)。

首次运行：

```bash
node --test tests/tts-double-speed-contextmenu.test.mjs
```

时 2 个子测试全部失败，分别暴露出：

- popup / options 还在给 `playAudioOffscreen` 传 `speed`
- `menus.js` 还没有任何 `documentUrlPatterns`

补丁完成后，该新增测试转绿。

执行过程中，旧静态测试 [immersive-observer-test-timeout.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/immersive-observer-test-timeout.test.mjs) 仍锁着 `options.js` 旧的 playback payload，因此本轮同步把它更新为 `054` 的新消息结构。

## 验证

本轮实际跑过：

```bash
node --test tests/tts-double-speed-contextmenu.test.mjs
node --test tests/*.test.mjs
node --check popup/popup.js
node --check options/options.js
node --check background/modules/menus.js
git diff --check
```

验证结果：

- [tts-double-speed-contextmenu.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/tts-double-speed-contextmenu.test.mjs)：2/2 通过
- `node --test tests/*.test.mjs`：187/187 通过
- [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) `node --check` 通过
- [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) `node --check` 通过
- [menus.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/menus.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- popup 和 options 中 OpenAI / Google / GLM TTS 在非 1.0 语速下，不再出现明显二次加速
- `chrome://`、`about:`、`file://` 等页面的右键菜单不再显示翻译入口
- 普通 `http/https` 页面上的右键菜单仍可正常触发
- Chrome Web Store 等 `https` 受限页面仍可能显示菜单，但点击不会导致扩展崩溃
