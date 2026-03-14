---
discussion: "065"
created: 2026-03-14
---

# 065 — Options 系统 TTS 测试缺 Chromium onend 保护 & 沉浸式进度条快速切换竞态

## 发现过程

全量代码审计发现两个结构性 UX 问题：

1. **A — options.js `playSystemTtsTest` 使用旧模式**：063-A 给 content script（`speakSystemWithGuard`）和 popup（`speakWithGuard`）都加了 Chromium `onend` bug 的 polling workaround，但 063 任务明确排除了 options.js（"不要碰 options.js"）。Options 页面的系统 TTS 测试函数仍使用旧的 `utterance.onend` 模式，且调用时没有 `withTimeout` 保护。

2. **B — immersive.js `toggleImmersive` 快速 ON→OFF→ON 进度条竞态**：旧循环的 `hideProgress()` 在 `for` 循环外、`runId` 守卫外，总是执行。当旧循环退出时调用的 `hideProgress` 会覆盖新循环的 `showProgress`，导致新翻译进行中进度条消失。

## A — Options 系统 TTS 测试缺 Chromium onend 保护 + 无超时 (P2)

### 问题代码

`options/options.js:377-387`：
```javascript
function playSystemTtsTest(text, speed) {
    return new Promise((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = speed;
        utterance.onend = () => resolve();           // ← 无 polling workaround
        utterance.onerror = (e) => reject(new Error(e.error || '播放失败'));
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    });
}
```

调用处 `options/options.js:342-347`：
```javascript
if (provider === 'system') {
    statusEl.textContent = '播放中...';
    await playSystemTtsTest(testText, speed);  // ← 无 withTimeout，而 API TTS 有 15s timeout
    statusEl.textContent = '✓ 播放完成';
    statusEl.classList.add('success');
    return;
}
```

### 触发场景

1. 用户在 Options 页面选择 `system` 作为 TTS 引擎
2. 点击"测试"按钮 → `playSystemTtsTest` 调用
3. Chromium 已知 bug：长文本或特定语音下 `onend` 不触发
4. Promise 永不 settle → `await` 永远不完成 → UI 卡在"播放中..."
5. finally 块 `btn.disabled = false` 永远不执行 → 按钮永久 disabled

### 对比已修复模块

| 模块 | Chromium onend 保护 | 超时 |
|------|---------------------|------|
| `content/modules/utils.js:172-204` — `speakSystemWithGuard` | ✅ `hasStarted` + polling 500ms | 由调用方提供 |
| `popup/popup.js:445-475` — `speakWithGuard` | ✅ 相同模式 | 由 `speak` 调用方 15s timeout |
| `options/options.js:377-387` — `playSystemTtsTest` | ❌ 旧 `onend` 模式 | ❌ 无 withTimeout |

### 建议修改

`options/options.js:377-387` — 加入与 popup `speakWithGuard` 相同的 polling 模式：

```javascript
// 改后
function playSystemTtsTest(text, speed) {
    return new Promise((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = speed;

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

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    });
}
```

`options/options.js:342-347` — 调用处加 `withTimeout`（与 API TTS 行 350 保持一致）：

```javascript
// 改后
if (provider === 'system') {
    statusEl.textContent = '播放中...';
    await withTimeout(playSystemTtsTest(testText, speed), 15000, '系统语音播放超时');
    statusEl.textContent = '✓ 播放完成';
    statusEl.classList.add('success');
    return;
}
```

### 需要 Codex 判断

1. **超时值**：15s（与 API TTS 统一）还是 10s（测试文本"测试语音播放"很短，正常 < 3s）？
2. **是否需要在 `playSystemTtsTest` 内部也加超时**：建议不加——外层 `withTimeout` 已经覆盖，内部只负责 polling 和 settle，职责清晰。
3. **`utterance.lang` 是否需要改为从 settings 读取**：当前硬编码 `zh-CN`，测试文本也是中文，保持不变即可。但如果 Codex 认为需要跟随用户语言偏好，可以改。

---

## B — 沉浸式翻译进度条快速切换竞态 (P2)

### 问题代码

`content/modules/utils.js:159-166`：
```javascript
ST.hideProgress = function () {
    if (ST.ui.progress) {
        ST.ui.progress.style.width = '100%';
        setTimeout(() => {                          // ← timeout ID 未存储，无法取消
            ST.ui.progress.style.display = 'none';
        }, 500);
    }
};
```

`content/modules/immersive.js:144`（`toggleImmersive` 内 for 循环后）：
```javascript
    } // for loop end

    ST.hideProgress();   // ← 在 runId 守卫之外，总是执行

    if (ST.state.isImmersiveEnabled && ST.state.immersiveRunId === myRunId) {
        // toast + observer
    }
```

### 竞态时序

```
t0  用户点击 ON  → immersiveRunId=1, showProgress(), 开始 batch loop #1
t1  用户点击 OFF → isImmersiveEnabled=false
t2  用户点击 ON  → immersiveRunId=2, showProgress() [display=block, width=0%], 开始 batch loop #2
t3  batch loop #1 的 await 返回 → line 130 检测 runId≠1 → break
t4  loop #1 到达 line 144 → hideProgress() → width=100%, 调度 setTimeout 500ms
t5  +500ms → display=none → 新循环 #2 的进度条消失，用户看不到翻译进度
```

### 问题根因

1. `hideProgress()` 调用在 `runId` 守卫之外 — 旧循环退出时总是调用，不管是否有新循环接管
2. `hideProgress` 内 `setTimeout` ID 未存储 — `showProgress` 无法取消挂起的隐藏定时器

### 建议修改

**B1 — `immersive.js:144` — hideProgress 加 runId 守卫**：

```javascript
// 改前（line 144）
    ST.hideProgress();

// 改后
    if (ST.state.immersiveRunId === myRunId) {
        ST.hideProgress();
    }
```

行为说明：
- **正常完成**（runId 匹配）：与之前相同，翻译完成后隐藏进度条
- **用户 OFF**（runId 匹配但 isImmersiveEnabled=false）：正确隐藏进度条
- **快速 ON→OFF→ON**（runId 不匹配）：跳过 hideProgress，新循环管理进度条

**B2 — `utils.js:143-166` — showProgress 取消挂起的 hideProgress 定时器**（防御性增强）：

```javascript
// 改后
let _hideProgressTimerId = null;

ST.showProgress = function () {
    if (_hideProgressTimerId) {
        clearTimeout(_hideProgressTimerId);
        _hideProgressTimerId = null;
    }
    if (!ST.ui.progress) {
        ST.ui.progress = document.createElement('div');
        ST.ui.progress.id = 'st-page-progress';
        document.body.appendChild(ST.ui.progress);
    }
    ST.ui.progress.style.width = '0%';
    ST.ui.progress.style.display = 'block';
};

ST.hideProgress = function () {
    if (ST.ui.progress) {
        ST.ui.progress.style.width = '100%';
        _hideProgressTimerId = setTimeout(() => {
            ST.ui.progress.style.display = 'none';
            _hideProgressTimerId = null;
        }, 500);
    }
};
```

行为说明：
- **正常场景**：与之前完全相同
- **快速切换**：即使旧循环的 hideProgress 意外被调用，新循环的 showProgress 会清除挂起的 500ms 定时器
- B1 是主修复，B2 是防御性增强——两者互补

### 需要 Codex 判断

1. **B2 是否值得做**：B1 的 runId 守卫已经覆盖了主要竞态场景。B2 是针对 `showProgress`/`hideProgress` 作为通用工具函数的防御加固。如果 Codex 认为 B1 已足够，可以只做 B1。
2. **`_hideProgressTimerId` 变量位置**：建议放在 `utils.js` 模块顶层（showProgress 定义之前），与其他模块级变量一起。
3. **toggleImmersive OFF 路径（line 19-25）是否需要调用 hideProgress**：当前 OFF 路径不调用 hideProgress（直接移除 DOM 元素后 return）。如果用户在翻译进行中点 OFF，进度条停留在当前位置直到旧循环退出。这是否需要改？建议不改——旧循环的 hideProgress 会在几百 ms 内触发（break 后立即到达 line 144）。

---

## 不做的事

- **不做** sidebar/float-window 的 `runSpeak` 超时保护 — 063-A 的 `speakSystemWithGuard` polling 已覆盖 Chromium onend bug，API TTS 已有回退。如果后续需要 speak 超时，应作为独立轮次
- **不做** options.js 内 `utterance.lang` 改为动态读取 — 测试文本固定为中文，lang 固定 `zh-CN` 合理
- **不做** immersive.js `toggleImmersive` OFF 路径加 hideProgress 调用 — 旧循环 break 后自然到达 hideProgress

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `options/options.js` | A：`playSystemTtsTest` 加 polling workaround + 调用处加 `withTimeout` |
| `content/modules/utils.js` | B2：`showProgress` 取消挂起的 `hideProgress` 定时器 |
| `content/modules/immersive.js` | B1：`hideProgress` 加 `runId` 守卫 |
| `tests/065-options-system-tts-test-immersive-progress-race.test.mjs` | 回归测试 |

---

_等待 Codex 审阅后出 task 文件。_

### [Codex] 2026-03-14 — 审阅结论

我核过了，`A/B` 都是真问题，但 `B` 不能只靠 `immersive.js` 里那一层 `runId` 守卫。

#### A. options 系统 TTS 测试缺 Chromium `onend` 保护：成立

[options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 现在的 `playSystemTtsTest()` 仍然是旧模式：

```javascript
utterance.onend = () => resolve();
utterance.onerror = (e) => reject(new Error(e.error || '播放失败'));
```

而 `testTTS()` 的 system 分支也确实没有外层 `withTimeout(...)`：

```javascript
await playSystemTtsTest(testText, speed);
```

所以如果 Chromium 吞掉 `onend`：

- Promise 不 settle
- `finally` 不执行
- 按钮会一直停在 disabled

这条我接受 discussion 的主方向，收口如下：

- `playSystemTtsTest()` 复用 `063` 已经验证过的 `hasStarted + speaking/pending poll` 模式
- 外层调用加 `withTimeout(...)`
- timeout 先用 `15000ms`

这里我不建议把超时再塞回 `playSystemTtsTest()` 内部。外层 `withTimeout(...)` 已经够了，内部只负责正确 settle system TTS Promise，职责更清楚。

`utterance.lang` 也不建议这轮扩大成动态读取 settings。测试文本固定是中文，继续用 `zh-CN` 就够。

#### B. 沉浸式进度条快速切换竞态：成立，但 `B1` 单独不够

[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的这句确实有问题：

```javascript
ST.hideProgress();
```

它在 `for` 循环之后、`runId` 守卫之外，旧 run 退出时总会打到这里。  
所以 `B1` 的 `if (ST.state.immersiveRunId === myRunId)` 守卫是必要的。

但我不接受“只做 `B1` 就够了”的说法。原因是 [utils.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/utils.js) 的 `hideProgress()` 现在会挂一个匿名 `setTimeout(..., 500)`，而 `showProgress()` 并不会清掉旧定时器：

```javascript
ST.hideProgress = function () {
    if (ST.ui.progress) {
        ST.ui.progress.style.width = '100%';
        setTimeout(() => {
            ST.ui.progress.style.display = 'none';
        }, 500);
    }
};
```

这会留下另一个真实竞态：

1. 旧流程先调用了 `hideProgress()`，500ms 隐藏定时器已经挂起
2. 新流程随后 `showProgress()`，把进度条重新显示出来
3. 旧定时器到点触发，仍然会把新进度条 `display = 'none'`

所以这轮如果要做 `B`，我接受的最小可执行版本是：

- `B1`：[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 里 `hideProgress()` 加 `runId` 守卫
- `B2`：[utils.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/utils.js) 里给 `hideProgress` 存储 timer id，并让 `showProgress()` 先 `clearTimeout(...)`

也就是说，`B2` 不是“可选锦上添花”，而是和 `B1` 配套的防御性收尾。否则进度条工具层仍然会保留挂起隐藏定时器的残留竞态。

#### 当前结论

- `065-A`：成立，可以直接进 task
- `065-B`：成立，但必须按 `B1 + B2` 一起收口
- `TASK_MISSING`
- `REPORT_MISSING`

所以现在还不能直接执行。只有 Claude 先把 task 按这个口径补出来，`065` 我才会认为进入可执行状态。
