# 063 — System TTS onend 不触发 & 沉浸式 translateBatch 超时报告

- 状态: done
- 对应任务: [tasks/063-system-tts-onend-immersive-batch-timeout.md](../tasks/063-system-tts-onend-immersive-batch-timeout.md)
- 来源讨论: [discussions/063-system-tts-onend-immersive-batch-timeout.md](../discussions/063-system-tts-onend-immersive-batch-timeout.md)
- 执行日期: 2026-03-14

## 结果概览

本轮完成了 `A + B + C`：

- `A` 内容脚本侧新增了共享的 `ST.speakSystemWithGuard(...)`，popup 侧新增了本地 `speakWithGuard(...)`，system TTS 现在不再只依赖 `utterance.onend`。
- `B` [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的两处 `translateBatch` 调用都显式加上了 `60000ms` timeout，后台消息悬挂时不会再把沉浸式进度条永久卡死。
- `C` 新增了 [063-system-tts-onend-immersive-batch-timeout.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/063-system-tts-onend-immersive-batch-timeout.test.mjs)；全量验证阶段还同步更新了 5 条旧静态断言，让它们和 `063` 的新 helper 结构对齐。

## 已完成改动

### 63.1 content-side `ST.speakSystemWithGuard(...)`

[utils.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/utils.js) 现在新增了：

```javascript
ST.speakSystemWithGuard = function (text, lang, speed) {
    return new Promise((resolve, reject) => {
        const langMap = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP', ko: 'ko-KR' };
        const resolvedLang = !lang || lang === 'auto' ? ST.detectLanguage(text) : lang;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = speed;
        utterance.lang = langMap[resolvedLang] || resolvedLang;

        let settled = false;
        let hasStarted = false;
        let pollId = null;

        const settle = (fn) => {
            if (settled) return;
            settled = true;
            if (pollId) clearInterval(pollId);
            fn();
        };

        utterance.onstart = () => { hasStarted = true; };
        utterance.onend = () => settle(resolve);
        utterance.onerror = (event) => settle(() => reject(new Error(event.error || '朗读失败')));

        pollId = setInterval(() => {
            if (hasStarted && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
                settle(resolve);
            }
        }, 500);

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    });
};
```

关键点是 `hasStarted`：

- 防止 `cancel() -> speak()` 之间 `speaking/pending` 暂时为 false 时被轮询提前误判结束
- 正常 `onend` 触发时，行为与之前一致
- Chromium 吞掉 `onend` 时，轮询会在播放真实结束后兜底 `resolve()`

### 63.2 sidebar / float-window 切到共享 helper

[sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 的：

```javascript
const speakSystem = (text, lang, speed) => ST.speakSystemWithGuard(text, lang, speed);
```

[float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) 的 system TTS 路径则改成：

```javascript
await ST.speakSystemWithGuard(text, resolvedLang, speed);
```

这样两个 content-side 入口都复用了同一套 Chromium workaround，同时保留了现有的：

- auto language 解析
- provider fallback
- `runSpeak(...)` 按钮 guard

### 63.3 popup 本地 `speakWithGuard(...)`

由于 popup 不在 content script 加载链中，这轮没有强行跨上下文复用 `ST.*`，而是在 [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 本地新增了：

```javascript
function speakWithGuard(text, lang, speed) { ... }
```

并把 system TTS 路径从内联 Promise 改成：

```javascript
await speakWithGuard(text, langMap[lang] || lang, speed);
```

popup 的 helper 与 content-side 逻辑对齐，但不重复做：

- `detectLanguage`
- `langMap` 选择之外的上下文耦合

### 63.4 沉浸式 `translateBatch` timeout

[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 两处 `translateBatch` 调用现在都变成了：

```javascript
const response = await ST.sendMessage({
    action: 'translateBatch',
    texts: texts,
    to: targetLang
}, 60000, '批量翻译超时');
```

覆盖了：

- 初始 batch loop
- MutationObserver 动态内容回调

这轮刻意用了 `60000ms`，没有机械沿用单条 translate 的 `30000ms`，因为 `translateBatch` 可能退回逐条串行路径。

## TDD 记录

本轮先新增了 [063-system-tts-onend-immersive-batch-timeout.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/063-system-tts-onend-immersive-batch-timeout.test.mjs)。

首次运行时，4 条子测试全部失败，精确暴露出：

- content-side 还没有 `ST.speakSystemWithGuard(...)`
- sidebar / float-window 还没有切到共享 helper
- popup 还没有本地 `speakWithGuard(...)`
- `immersive.js` 两处 `translateBatch` 还没有 `60000ms` timeout

补上最小实现后，新测试转绿。

全量验证阶段还同步更新了 5 条旧静态断言，它们原本锁定的是 pre-063 的 system TTS 结构：

- [css-token-and-speak.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/css-token-and-speak.test.mjs)
- [darkmode-hardcode-tts-speak-guard.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/darkmode-hardcode-tts-speak-guard.test.mjs)
- [error-state-tts-lang.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/error-state-tts-lang.test.mjs)
- [immersive-observer-test-timeout.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/immersive-observer-test-timeout.test.mjs)
- [polish-consistency.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/polish-consistency.test.mjs)

这些调整不是额外扩 scope，而是为了让已有静态断言接受 `063` 的合法结构变化。

## 验证

本轮实际跑过：

```bash
node --test tests/063-system-tts-onend-immersive-batch-timeout.test.mjs
node --test tests/css-token-and-speak.test.mjs tests/darkmode-hardcode-tts-speak-guard.test.mjs
node --test tests/error-state-tts-lang.test.mjs tests/immersive-observer-test-timeout.test.mjs tests/polish-consistency.test.mjs
node --test tests/*.test.mjs
node --check content/modules/utils.js
node --check content/modules/sidebar.js
node --check content/modules/float-window.js
node --check popup/popup.js
git diff --check
```

验证结果：

- [063-system-tts-onend-immersive-batch-timeout.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/063-system-tts-onend-immersive-batch-timeout.test.mjs)：4/4 通过
- `node --test tests/*.test.mjs`：210/210 通过
- [utils.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/utils.js) `node --check` 通过
- [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) `node --check` 通过
- [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) `node --check` 通过
- [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) `node --check` 通过
- `git diff --check` 无输出

补充说明：

- 全量测试过程中，之前出现过的 `ui-polish-architecture.test.mjs` Node test runner 反序列化噪音，这轮 fresh 全量运行没有复现。

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- popup / sidebar / float-window 在 system TTS 长文本播放结束后，即使 `onend` 没触发，朗读按钮也会恢复
- popup / sidebar / float-window 的 system TTS 不会在 `cancel() -> speak()` 的瞬间被提前解锁
- 沉浸式翻译的初始 batch 和 observer 动态翻译在后台消息悬挂时，会在超时后继续收尾，而不是把进度条永久卡住
