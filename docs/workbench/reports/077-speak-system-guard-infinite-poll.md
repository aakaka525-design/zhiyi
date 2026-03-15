# 077 — 系统 TTS 启动超时守卫报告

- 状态: done
- 对应任务: [tasks/077-speak-system-guard-infinite-poll.md](../tasks/077-speak-system-guard-infinite-poll.md)
- 来源讨论: [discussions/077-speak-system-guard-infinite-poll.md](../discussions/077-speak-system-guard-infinite-poll.md)
- 执行日期: 2026-03-14

## 结果概览

本轮按收窄后的边界完成了 `A + B + C + D + E`：

- [utils.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/utils.js) 的 `ST.speakSystemWithGuard(...)` 现在有 `pollCount` 启动超时守卫。
- [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 的 `speakWithGuard(...)` 同步补上同构守卫。
- [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 的 `playSystemTtsTest(...)` 也补了同样的启动超时，消掉了内部无限轮询。
- 新增了 [077-speak-guard-timeout.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/077-speak-guard-timeout.test.mjs)。
- 原有静态断言不需要改；全量回归直接保持通过。

## 已完成改动

### 77.1 content 侧系统 TTS helper 现在会在 5 秒未启动时主动失败

[utils.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/utils.js) 的 `ST.speakSystemWithGuard(...)` 原来只有：

```javascript
pollId = setInterval(() => {
    if (hasStarted && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
        settle(resolve);
    }
}, 500);
```

现在补成了：

```javascript
let pollCount = 0;
pollId = setInterval(() => {
    pollCount++;
    if (hasStarted && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
        settle(resolve);
    } else if (!hasStarted && pollCount >= 10) {
        window.speechSynthesis.cancel();
        settle(() => reject(new Error('系统朗读启动超时')));
    }
}, 500);
```

这意味着：

- 如果 `speechSynthesis.speak()` 正常触发 `onstart`，后续逻辑不变
- 如果 5 秒内始终没进入播放态，就主动 `cancel()` 并 `reject`
- sidebar / float-window 的 `runSpeak(...).finally(...)` 现在能恢复按钮，不会再被永远卡住

### 77.2 popup 的本地 helper 现在和 content 侧保持同一启动超时语义

[popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 的 `speakWithGuard(...)` 现在补了同样的：

- `let pollCount = 0`
- `pollCount++`
- `!hasStarted && pollCount >= 10`
- `speechSynthesis.cancel()`
- `reject(new Error('系统朗读启动超时'))`

popup 的行为因此变成：

- 正常播放时仍然依赖 `onend / polling` 自然完成
- 5 秒内根本没启动时，`speak()` 会进入 `catch`
- popup 现有的错误提示链会展示「系统朗读启动超时」
- `btnSpeak.disabled` 会在外层 `finally` 正常恢复

### 77.3 options 的系统 TTS 测试不再只靠外层 15 秒 UI 超时兜底

[options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 的 `playSystemTtsTest(...)` 之前虽然被：

```javascript
await withTimeout(playSystemTtsTest(testText, speed), 15000, '系统语音播放超时');
```

包住了，但内部 poller 还是无上限的。

这轮补完后：

- `playSystemTtsTest(...)` 本身在 5 秒未启动时就会 `cancel + reject`
- 内部 `setInterval` 会通过 `settle()` 清掉
- 外层 `withTimeout(15000)` 保持不动，继续作为 UI 级兜底

这修掉的是 discussion 里指出的那条隐藏问题：

- 按钮看起来会恢复
- 但内部 interval 可能一直跑着

现在这条 timer 泄漏已经没有了。

## TDD 记录

本轮先新增了 [077-speak-guard-timeout.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/077-speak-guard-timeout.test.mjs)。

第一次运行时，失败点是准确的：

- `utils.js` 不存在 `pollCount`
- `popup.js` 不存在 `pollCount`
- `options.js` 不存在 `pollCount`

也就是说，红灯不是因为 task 写错，而是因为这三处 helper 确实都还缺启动超时守卫。

在补上最小实现后，专项测试转绿。

随后跑全量 `node --test tests/*.test.mjs`，原先预期可能需要同步更新的静态断言并没有失败，说明现有正则本身已经足够宽，不需要额外修改测试文件。

## 验证

本轮实际 fresh 跑过：

```bash
node --test tests/077-speak-guard-timeout.test.mjs
node --test tests/*.test.mjs
node --check content/modules/utils.js
node --check popup/popup.js
node --check options/options.js
git diff --check
```

验证结果：

- [077-speak-guard-timeout.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/077-speak-guard-timeout.test.mjs)：4/4 通过
- `node --test tests/*.test.mjs`：267/267 通过
- `node --check content/modules/utils.js`：通过
- `node --check popup/popup.js`：通过
- `node --check options/options.js`：通过
- `git diff --check`：无输出

## Residual Risk

这轮刻意没有做：

- 固定总超时硬限
- 基于文本长度 / 语速推导动态总超时
- 调用方 `runSpeak` 结构调整
- 合并 popup / content / options 的 3 个 helper

因此 residual risk 是：

- 如果浏览器进入极端状态：`onstart` 已触发，但 `speaking/pending` 永远不回落，当前 helper 仍可能长时间挂住
- 这条风险是 discussion 和 task 明确接受留下来的，不是本轮漏修

## 手动验证

这轮仍未做真实 Chrome 手测。待人工确认的页面级行为包括：

- sidebar / float-window / popup 的系统 TTS 在浏览器拒绝启动时，按钮会恢复而不是永久灰掉
- options 的系统 TTS 测试在浏览器拒绝启动时，会在 5 秒左右失败，不再等满 15 秒才由外层 UI 超时兜底
