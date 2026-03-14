# 065 — Options 系统 TTS 测试缺 Chromium onend 保护 & 沉浸式进度条快速切换竞态报告

- 状态: done
- 对应任务: [tasks/065-options-system-tts-test-immersive-progress-race.md](../tasks/065-options-system-tts-test-immersive-progress-race.md)
- 来源讨论: [discussions/065-options-system-tts-test-immersive-progress-race.md](../discussions/065-options-system-tts-test-immersive-progress-race.md)
- 执行日期: 2026-03-14

## 结果概览

本轮完成了 `A + B1 + B2 + C`：

- `A` [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 的系统 TTS 测试现在和 `063` 的 popup/content 路径一样，带 `hasStarted + speaking/pending` polling guard，外层同时补了 `15000ms` 的 `withTimeout(...)`。
- `B1` [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的 `hideProgress()` 现在只会由当前 `immersiveRunId` 的 active run 调用。
- `B2` [utils.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/utils.js) 现在会保存进度条隐藏定时器，并在 `showProgress()` 时先清掉挂起定时器，防止旧 hide 覆盖新 show。
- `C` 新增了 [065-options-system-tts-test-immersive-progress-race.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/065-options-system-tts-test-immersive-progress-race.test.mjs)，并同步更新了 1 条旧静态断言，让它对齐 `065` 的新 options TTS 结构。

## 已完成改动

### 65.1 options 系统 TTS 测试补 Chromium `onend` workaround

[options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 的 `playSystemTtsTest()` 原先仍是旧模式：

```javascript
utterance.onend = () => resolve();
utterance.onerror = (e) => reject(new Error(e.error || '播放失败'));
```

现在改成了和 `063` 已验证路径一致的结构：

```javascript
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
utterance.onerror = (e) => settle(() => reject(new Error(e.error || '播放失败')));

pollId = setInterval(() => {
    if (hasStarted && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
        settle(resolve);
    }
}, 500);
```

外层 `testTTS()` 的 system 分支也从：

```javascript
await playSystemTtsTest(testText, speed);
```

改成了：

```javascript
await withTimeout(playSystemTtsTest(testText, speed), 15000, '系统语音播放超时');
```

这样现在有两层保护：

- 正常 `onend` 触发时，行为与之前一致
- Chromium 吞 `onend` 时，polling 会在播放结束后兜底 resolve
- 极端情况下 polling 也不回收时，外层 `withTimeout(...)` 会让按钮恢复，而不是永久 disabled

这轮刻意没有把超时塞回 `playSystemTtsTest()` 内部，也没有把 `utterance.lang` 扩成动态读取，和 discussion 收窄后的边界一致。

### 65.2 沉浸式进度条加 runId 守卫

[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 在 batch loop 结束后原先无条件：

```javascript
ST.hideProgress();
```

现在改成：

```javascript
if (ST.state.immersiveRunId === myRunId) {
    ST.hideProgress();
}
```

这解决的是旧 run 在 `ON -> OFF -> ON` 快速切换后，退出时仍然把新 run 进度条隐藏的问题。

### 65.3 进度条工具层清掉挂起隐藏定时器

只做 `B1` 还不够，因为 [utils.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/utils.js) 原先的 `hideProgress()` 会挂一个匿名 `setTimeout(..., 500)`，而 `showProgress()` 并不会取消它。

现在改成了：

```javascript
let _hideProgressTimerId = null;
```

`showProgress()` 先清掉旧 timer：

```javascript
if (_hideProgressTimerId) {
    clearTimeout(_hideProgressTimerId);
    _hideProgressTimerId = null;
}
```

`hideProgress()` 则保存并清空 timer id：

```javascript
_hideProgressTimerId = setTimeout(() => {
    ST.ui.progress.style.display = 'none';
    _hideProgressTimerId = null;
}, 500);
```

这样即使旧 hide 先挂起，新的 show 也不会再被 500ms 后的旧定时器反向隐藏。

## TDD 记录

本轮先新增了 [065-options-system-tts-test-immersive-progress-race.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/065-options-system-tts-test-immersive-progress-race.test.mjs)。

初次运行时 4 条子测试全部失败，精确暴露出：

- options system TTS 还是旧 `onend` 模式
- system 分支还没有 `withTimeout(...)`
- immersive 结束后还在无条件 `hideProgress()`
- progress helper 还没有 timer id 清理

补上最小实现后，新测试转绿。

全量验证阶段还同步更新了 1 条旧静态断言：

- [sidebar-lang-persist-options-tts-promise.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/sidebar-lang-persist-options-tts-promise.test.mjs)

这不是额外扩 scope，只是让旧测试接受 `065` 对 options system TTS 的合法结构变化。

## 验证

本轮实际 fresh 跑过：

```bash
node --test tests/065-options-system-tts-test-immersive-progress-race.test.mjs
node --test tests/*.test.mjs
node --check options/options.js
node --check content/modules/immersive.js
node --check content/modules/utils.js
git diff --check
```

验证结果：

- [065-options-system-tts-test-immersive-progress-race.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/065-options-system-tts-test-immersive-progress-race.test.mjs)：4/4 通过
- `node --test tests/*.test.mjs`：217/217 通过
- [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) `node --check` 通过
- [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) `node --check` 通过
- [utils.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/utils.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- Options 页的 system TTS 测试在 Chromium 不触发 `onend` 时，最终仍会恢复按钮状态
- 沉浸式翻译在快速 `ON -> OFF -> ON` 切换时，新的进度条不会被旧 run 或旧 hide timer 隐掉
