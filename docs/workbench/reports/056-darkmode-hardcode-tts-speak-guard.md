# 056 — 深色模式硬编码背景迁移 & 系统 TTS 朗读按钮 Promise 化报告

- 状态: done
- 对应任务: [tasks/056-darkmode-hardcode-tts-speak-guard.md](../tasks/056-darkmode-hardcode-tts-speak-guard.md)
- 来源讨论: [discussions/056-darkmode-hardcode-tts-speak-guard.md](../discussions/056-darkmode-hardcode-tts-speak-guard.md)
- 执行日期: 2026-03-13

## 结果概览

本轮完成了 `A/B`：

- `A` 内容脚本主容器的浅色硬编码背景/边框已收口到现有主题 token，并补了悬浮球专用 `--surface-ball`，内容侧深色模式现在能完整覆盖这些容器。
- `B` popup、sidebar、float-window 的 system TTS 路径都已 Promise 化，朗读按钮会等到语音播放结束或报错后再恢复可点击。

## 已完成改动

### 56.1 A 深色模式硬编码背景迁移

[content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 在浅色和深色 token 块里新增了：

```css
--surface-ball: rgba(255, 255, 255, 0.6);
--surface-ball: rgba(30, 34, 43, 0.6);
```

随后把这批内容脚本主容器的硬编码浅色值收口到变量：

- `#smart-translator-bubble` → `background: var(--surface)`
- `#st-sidebar` → `background: var(--surface)` + `border-left: 1px solid var(--border-color)`
- `.st-sidebar-search` → `border: 1px solid var(--border-color)`
- `#st-float-window` → `background: var(--surface)` + `border: 1px solid var(--border-color)`
- `.st-float-header` → `background: var(--bg-secondary)`
- `#st-sidebar-toggle-btn` → `background: var(--surface)`
- `#st-floating-ball` → `background: var(--surface-ball)`

这次没有改 `--surface` / `--bg-secondary` / `--border-color` 的值，也没有动 `box-shadow` 和 `backdrop-filter`。

### 56.2 B 系统 TTS Promise 化

[popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 的 system TTS 路径改成了：

```javascript
await new Promise((resolve, reject) => {
    utterance.onend = () => resolve();
    utterance.onerror = (event) => reject(new Error(event.error || '朗读失败'));
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
});
```

[sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 里：

- `speakSystem()` 现在返回 Promise
- `default` 分支、`catch` 回退、`openai/google/glm` 缺 key 回退、`google/glm` 无 `audioData` 回退都改成了 `return speakSystem(...)`

这样 `runSpeak(btn, fn)` 的 `await fn()` 会真实等待 system TTS 播放结束。

[float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) 的最终 system fallback 也改成了同样的 Promise 包装；API TTS 失败或缺 key 时，按钮会在系统语音播完后才恢复。

## TDD 记录

本轮先新增了 [darkmode-hardcode-tts-speak-guard.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/darkmode-hardcode-tts-speak-guard.test.mjs)。

首次运行时，测试暴露出两类真实缺口：

- `content/content.css` 仍保留多处浅色硬编码背景/边框
- popup / sidebar / float-window 的 system TTS 路径还是同步返回

补丁完成后，这条新增测试已转绿。  
全量测试阶段还补齐了两条旧静态断言，使它们对齐 Promise 化后的 `speakSystem()` 结构：

- [error-state-tts-lang.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/error-state-tts-lang.test.mjs)
- [tts-fallback-token-gaps.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/tts-fallback-token-gaps.test.mjs)

## 验证

本轮实际跑过：

```bash
node --test tests/darkmode-hardcode-tts-speak-guard.test.mjs
node --test tests/*.test.mjs
node --check content/modules/sidebar.js
node --check content/modules/float-window.js
node --check popup/popup.js
git diff --check
```

验证结果：

- [darkmode-hardcode-tts-speak-guard.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/darkmode-hardcode-tts-speak-guard.test.mjs)：2/2 通过
- `node --test tests/*.test.mjs`：191/191 通过
- [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) `node --check` 通过
- [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) `node --check` 通过
- [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- 内容脚本深色模式下，气泡、侧边栏、小窗、侧边栏切换按钮、悬浮球都不再出现浅色底板
- popup / sidebar / float-window 的 system TTS 按钮在整段朗读完成前保持禁用
- system TTS 出错时，按钮会恢复，不会卡死在 disabled
