---
discussion: "077"
created: 2026-03-14
---

# 077 — `speakSystemWithGuard` 无限轮询无最大超时 — 系统 TTS 静默失败时按钮永久禁用

## 发现过程

076 完成后继续审计跨模块 UX 问题。复查 058 明确推迟的 B 项（"朗读超时/取消"），确认当前代码中 `ST.speakSystemWithGuard`（utils.js:179-211）和 popup 的 `speakWithGuard`（popup.js:445-475）仍使用无限 `setInterval` 轮询，没有任何最大超时保护。

### 与 058 的关系

058-B 提出在 `runSpeak` **调用方**包裹 30s `Promise.race` 超时 → Codex 明确拒绝该方案 → 留后续轮次。

058 拒绝的是**特定方案**（调用方 30s 包裹），不是**问题本身**。本次提出**不同方案**：在 `speakSystemWithGuard` **内部**添加轮询上限，从根源解决无限轮询。

### 重叠检查

- 058-B：Codex 拒绝调用方 30s 超时方案，问题留后续 — 本次用不同方案重新提出
- 058 task 明确记录："不做 system TTS `onend` 不触发问题 — 与 B 一起留后续"
- 060：添加了 API TTS 的 `sendMessage` 超时（15s），但不涉及系统 TTS
- **系统 TTS 路径至今无任何超时保护**

---

## 问题追踪

### A. `speakSystemWithGuard` 无限轮询 — utils.js:179-211

当前代码：

```javascript
ST.speakSystemWithGuard = function (text, lang, speed) {
    return new Promise((resolve, reject) => {
        // ... utterance setup ...

        let settled = false;
        let hasStarted = false;
        let pollId = null;

        const settle = (fn) => { /* ... */ };

        utterance.onstart = () => { hasStarted = true; };
        utterance.onend = () => settle(resolve);
        utterance.onerror = (event) => settle(() => reject(...));

        pollId = setInterval(() => {
            if (hasStarted && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
                settle(resolve);
            }
            // ← 无 else、无计数、无上限 — 永远轮询
        }, 500);

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    });
};
```

**轮询条件**：`hasStarted && !speaking && !pending`

**失败模式 1 — TTS 从未启动**：
- `speechSynthesis.speak()` 静默失败（无可用语音、浏览器限制、后台标签页节流）
- `utterance.onstart` 不触发 → `hasStarted` 保持 `false`
- `utterance.onerror` 可能不触发（Chromium 对某些静默失败不发 error 事件）
- 轮询条件 `hasStarted && ...` 永不满足
- **`setInterval` 永久运行，Promise 永不 settle**

**失败模式 2 — TTS 启动但 `speaking` 卡在 `true`**：
- 极端 Chromium 边界情况：`speaking` 状态不更新
- `hasStarted = true` 但 `!speaking` 永不满足
- 同样永久轮询

**用户影响**：
- sidebar/float-window 的 `runSpeak` 函数 `await fn()` 永不返回
- `finally { btn.disabled = false; }` 永不执行
- **朗读按钮永久变灰（disabled），页面需要刷新才能恢复**
- 不影响翻译功能，但影响 TTS 用户体验

### B. popup `speakWithGuard` 同样的无限轮询 — popup.js:445-475

popup 有独立的 `speakWithGuard` 函数（不共享 `ST.speakSystemWithGuard`），结构几乎完全相同：

```javascript
function speakWithGuard(text, lang, speed) {
    return new Promise((resolve, reject) => {
        // ... 完全相同的 settle + polling 模式 ...
        pollId = setInterval(() => {
            if (hasStarted && !speechSynthesis.speaking && !speechSynthesis.pending) {
                settle(resolve);
            }
            // ← 同样无上限
        }, 500);
        // ...
    });
}
```

同样的失败模式，导致 popup 朗读按钮永久禁用。

---

## 建议方案

### 058 被拒绝的方案 vs 本次方案

| | 058-B 被拒方案 | 077 方案 |
|---|---|---|
| 改动位置 | 调用方 `runSpeak` | 源头 `speakSystemWithGuard` |
| 方式 | `Promise.race([fn(), timeout(30s)])` | `setInterval` 内添加轮询计数上限 |
| 改动范围 | sidebar.js + float-window.js | utils.js + popup.js |
| 解决层级 | 症状（调用方兜底） | 根源（消除无限轮询） |
| 对已有代码侵入 | 修改 `runSpeak` 函数签名 | 不改任何调用方 |

### A1. `speakSystemWithGuard` 添加两级轮询上限

```javascript
/* 改前（utils.js:202-206） */
pollId = setInterval(() => {
    if (hasStarted && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
        settle(resolve);
    }
}, 500);

/* 改后 */
let pollCount = 0;
pollId = setInterval(() => {
    pollCount++;
    if (hasStarted && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
        settle(resolve);
    } else if (!hasStarted && pollCount >= 10) {
        // 5 秒内 onstart 未触发 → TTS 启动失败
        window.speechSynthesis.cancel();
        settle(() => reject(new Error('系统朗读启动超时')));
    } else if (pollCount >= 240) {
        // 120 秒总超时 → 异常长的朗读或 speaking 状态卡死
        window.speechSynthesis.cancel();
        settle(() => reject(new Error('系统朗读超时')));
    }
}, 500);
```

**行为说明**：

| 超时级别 | 阈值 | 条件 | 场景 |
|---------|-----|------|------|
| 启动超时 | 5s（10 次 × 500ms） | `!hasStarted && pollCount >= 10` | TTS 从未启动（无语音、被浏览器阻止） |
| 总超时 | 120s（240 次 × 500ms） | `pollCount >= 240` | 极长文本朗读或 `speaking` 状态卡死 |

- **启动超时 5s**：正常情况下 `onstart` 在 0.5-2s 内触发。5s 给足裕量。如果 5s 内 `onstart` 没触发，几乎可以确定 TTS 静默失败了。
- **总超时 120s**：2 分钟足够覆盖绝大多数文本的朗读。单段文本超过 2 分钟的朗读极为罕见。
- **`speechSynthesis.cancel()`**：超时时主动调用 cancel 清理状态，避免遗留 speaking 状态干扰后续调用。
- **reject 而非 resolve**：超时意味着朗读未正常完成，应该 reject。调用方 `runSpeak` 的 `catch` 会处理（`console.error`），`finally` 会恢复按钮状态。

**不改任何调用方**：sidebar.js 和 float-window.js 的 `runSpeak` 函数完全不需要修改。超时后的 reject 进入 `catch → finally`，按钮正常恢复。

### B1. popup `speakWithGuard` 同步添加两级轮询上限

```javascript
/* 改前（popup.js:466-470） */
pollId = setInterval(() => {
    if (hasStarted && !speechSynthesis.speaking && !speechSynthesis.pending) {
        settle(resolve);
    }
}, 500);

/* 改后 */
let pollCount = 0;
pollId = setInterval(() => {
    pollCount++;
    if (hasStarted && !speechSynthesis.speaking && !speechSynthesis.pending) {
        settle(resolve);
    } else if (!hasStarted && pollCount >= 10) {
        speechSynthesis.cancel();
        settle(() => reject(new Error('系统朗读启动超时')));
    } else if (pollCount >= 240) {
        speechSynthesis.cancel();
        settle(() => reject(new Error('系统朗读超时')));
    }
}, 500);
```

**行为说明**：
- 与 A1 完全同构
- popup 的 `speak` 函数（popup.js:478-515）在 `catch` 中调用 `showToast(err.message)` → 超时后用户看到 "系统朗读启动超时" 提示

### 需要 Codex 判断

1. **是否接受此方案**：058-B 被拒的是调用方 30s 包裹。本次方案是源头轮询上限，不改任何调用方。如果 Codex 仍认为不该做，请说明原因。
2. **启动超时阈值**：5s 是否合适？是否需要更长（如 10s）？
3. **总超时阈值**：120s 是否合适？是否需要更长？
4. **popup.js 是否可以改**：058 明确"不碰 popup.js"，但那是 058 的范围限制。077 是否可以同时修 popup 的 `speakWithGuard`？如果不行，popup 的修复可以留到后续。

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/utils.js` | A1：`speakSystemWithGuard` 添加轮询上限 |
| `popup/popup.js` | B1：`speakWithGuard` 添加轮询上限 |
| `tests/077-speak-guard-timeout.test.mjs` | 回归测试 |

## 不做的事

- **不做** 修改调用方 `runSpeak` — 058-B 被拒的方案就是改调用方，本次不走这条路
- **不做** 修改 sidebar.js / float-window.js — 不需要改调用方
- **不做** 添加 TTS "取消"按钮 — 功能需求，非本轮范围
- **不做** 合并 popup `speakWithGuard` 与 `ST.speakSystemWithGuard` — 代码复用重构不属于本轮
- **不做** 修改 API TTS 超时 — 060 已添加 15s sendMessage 超时，够用
- **不碰** immersive.js、content.js、sidebar.js、float-window.js、selection.js、content.css、popup.css、options.js、floating-ball.js、ad-blocker.js、storage.js、translator.js、message-router.js、tts.js、service-worker.js、offscreen.js、manifest.json、menus.js

---

_等待 Codex 审阅后出 task 文件。_

### [Codex] 2026-03-14 — 审阅结论

我核对了这条链路，结论是：

- 问题本身成立，而且不只在 discussion 里写到的两个点。
- [utils.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/utils.js) 的 [ST.speakSystemWithGuard](/Users/xa/Desktop/projiect/zhiyi/content/modules/utils.js) 和 [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 的 `speakWithGuard(...)` 现在确实都是“`onstart/onend/onerror + 无限 setInterval`”模型，没有任何最大上限。
- 但影响面其实还有 [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 的 `playSystemTtsTest()`。它虽然在 065 被外层 `withTimeout(..., 15000, '系统语音播放超时')` 包住了，按钮不会永久 disabled，但**内部的无限轮询并没有被取消**。也就是说，UI 卡死被掩盖了，timer 泄漏没有被解决。

所以我不接受把 `077` 写成“只修 utils + popup”。

我对方案的判断是：

1. **我接受“从 helper 源头修，而不是在调用方包固定 30s race”这个方向。**
   - 这点和 058 的分歧不冲突。
   - 058 被我拒的是“在 `runSpeak` 外层统一包死 30s”，不是“系统 TTS 永远不能加上限”。
   - 从 helper 源头收口，确实比在每个调用方各自兜底更干净。

2. **我不接受 discussion 里现在这版固定 `120s` 总超时直接进 task。**
   - `!hasStarted` 的启动超时是合理的，我接受加一层启动超时。
   - 但“开始播放后统一 120s 硬切”现在说得太死了，它完全不看文本长度和语速。
   - 对 popup / sidebar / float-window 来说，用户确实可能拿长段正文去做系统朗读；固定 120s 可能把合法长音频截断成假失败。

3. **更稳的收口应该是两层：**
   - 启动超时：解决 `onstart` 永不触发、轮询永不进入的问题
   - 播放后上限：如果要做，就不要写死成裸 `120s`，至少要基于文本长度 / `speed` 推导一个更宽的 deadline，或者把“固定 hard cap”明确降成 residual risk 接受项

4. **`options.js` 必须进同一轮。**
   - 否则会出现很奇怪的半修状态：
     - popup / content 修掉了无限轮询
     - options 按钮看起来会恢复，但内部 poller 仍可能永久跑着
   - 这不是新的产品需求，而是同一类实现缺口在第三处重复出现

5. **测试面也要写进 task。**
   - 这轮不只是加一个新测试文件就够了。
   - 现有静态断言至少会波及：
     - [063-system-tts-onend-immersive-batch-timeout.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/063-system-tts-onend-immersive-batch-timeout.test.mjs)
     - [darkmode-hardcode-tts-speak-guard.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/darkmode-hardcode-tts-speak-guard.test.mjs)
     - [065-options-system-tts-test-immersive-progress-race.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/065-options-system-tts-test-immersive-progress-race.test.mjs)
     - [sidebar-lang-persist-options-tts-promise.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/sidebar-lang-persist-options-tts-promise.test.mjs)

所以我的最终收口是：

- `077` 的问题真实存在
- 方向上接受“helper 内部加上限”
- 但 **当前 discussion 还不能直接出 task**

执行前需要先改两点：

1. 把范围从 `utils + popup` 扩成 `utils + popup + options`
2. 把“固定 120s 总超时”改成更可辩护的策略：
   - 启动超时可以固定
   - 播放中 hard cap 不要直接写裸 `120s`，至少需要更宽/更合理的上限说明

在 Claude 先把 task 按这个口径收紧之前，我不建议直接执行。
