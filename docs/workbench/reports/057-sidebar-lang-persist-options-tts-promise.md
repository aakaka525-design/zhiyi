# 057 — 侧边栏/小窗语言持久化 & Options TTS 测试按钮 Promise 化报告

- 状态: done
- 对应任务: [tasks/057-sidebar-lang-persist-options-tts-promise.md](../tasks/057-sidebar-lang-persist-options-tts-promise.md)
- 来源讨论: [discussions/057-sidebar-lang-persist-options-tts-promise.md](../discussions/057-sidebar-lang-persist-options-tts-promise.md)
- 执行日期: 2026-03-13

## 结果概览

本轮完成了 `A/B`：

- `A` sidebar 和 float-window 的语言选择现在会写回 `settings` 存储，跨页面重新打开后不再退回默认语言。
- `B` options 页 system TTS 测试路径已 Promise 化，测试按钮会等播放结束后再恢复，不再允许快速重复打断重播。

## 已完成改动

### 57.1 A 侧边栏 / 小窗语言持久化

[sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 新增了局部 `saveLanguageSettings(partialSettings)` helper，内部直接用 Promise 版：

```javascript
const result = await chrome.storage.local.get('settings');
await chrome.storage.local.set({
    settings: { ...settings, ...partialSettings },
});
```

然后把它接到三条真实语言变化路径上：

- `sourceLangSelect` 的 `change`
- `targetLangSelect` 的 `change`
- `swapBtn.onclick` 互换后保存 `{ sourceLang: t, targetLang: s }`

[float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) 也新增了同结构 helper，并把 `targetLangSelect` 的 `change` 接到保存逻辑。

这次没有改 [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 的现有 `saveLanguageSettings()`，也没有改 [content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) 的 `chrome.storage.onChanged`；内容侧设置同步仍由现有监听器接管。

### 57.2 B Options 系统 TTS 测试 Promise 化

[options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 的 `playSystemTtsTest(text, speed)` 现在返回 Promise，并用 `utterance.onend / utterance.onerror` 结束：

```javascript
return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => resolve();
    utterance.onerror = (e) => reject(new Error(e.error || '播放失败'));
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
});
```

`testTTS()` 的 system 分支也改成：

- 播放前：`播放中...`
- `await playSystemTtsTest(...)`
- 播放结束后：`✓ 播放完成`

这样 `finally` 里的 `btn.disabled = false` 会在语音真正播放结束后才执行。API TTS 路径和 `withTimeout(...)` 没有改。

## TDD 记录

本轮先新增了 [sidebar-lang-persist-options-tts-promise.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/sidebar-lang-persist-options-tts-promise.test.mjs)。

首次运行时，两条子测试都失败，分别暴露出：

- sidebar / float-window 尚未把语言变化写回 `settings`
- options 的 `playSystemTtsTest()` 仍是同步函数，`testTTS()` 也没有 `await`

实现补丁后，该新增测试转绿。  
全量验证阶段还同步更新了一条旧静态断言 [float-ime-swap-paste.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/float-ime-swap-paste.test.mjs)，让它接受 sidebar swap 中新增的语言持久化调用。

## 验证

本轮实际跑过：

```bash
node --test tests/sidebar-lang-persist-options-tts-promise.test.mjs
node --test tests/*.test.mjs
node --check content/modules/sidebar.js
node --check content/modules/float-window.js
node --check options/options.js
git diff --check
```

验证结果：

- [sidebar-lang-persist-options-tts-promise.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/sidebar-lang-persist-options-tts-promise.test.mjs)：2/2 通过
- `node --test tests/*.test.mjs`：193/193 通过
- [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) `node --check` 通过
- [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) `node --check` 通过
- [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- 侧边栏切换目标语言后，跳转新页面重新打开仍保持上次选择
- 小窗切换目标语言后，重新打开仍保持上次选择
- sidebar 执行 swap 后，刷新或切页后 source/target 语言保持互换后的值
- options 页 system TTS 测试按钮在整段播放结束前保持 disabled
