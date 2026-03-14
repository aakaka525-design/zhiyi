# 063 — System TTS onend 不触发 → 按钮永久禁用 & 沉浸式 translateBatch 无超时

062 完成了沉浸式 SPA DOM 脱离守卫和 Options diff-only 保存。本轮聚焦两个剩余的"Promise 永不 settle"场景：系统 TTS 播放因 Chromium onend bug 导致按钮永久禁用，以及沉浸式翻译的 translateBatch 调用无超时导致进度条卡死。

## 重复性检查

- **A: System TTS onend 不触发** — 这是多次讨论后被显式推迟的问题：
  - 045: "不加超时保护到内容脚本的 speak — 可作为后续轮次"
  - 046: "不加 speak 超时保护 — 045 显式推迟，可作为后续轮次"
  - 058-B: Codex 驳回 `runSpeak` 级别固定 30s 超时（"太粗，会打断合法长音频播放"）；Claude 同意并拆分为：(1) API TTS 消息层超时；(2) system TTS onend 不触发问题单独处理
  - 059-B: popup 的 API TTS / offscreen play 加了 withTimeout（15s），但 speak 整体未加
  - 060-A: sidebar/float-window API TTS + offscreen play 加了 withTimeout（15s）
  - 060 Codex: "不要再把整个 runSpeak(...) 或 system TTS 一起套固定超时"
  - **拆分 (1) 已完成（058/059/060），拆分 (2) 从未执行。** 符合"已讨论未修复"条件。
- **B: 沉浸式 translateBatch 无超时** — 058 报告明确说"这轮只给翻译调用做了 opt-in"（指 sidebar/float-window translate）。沉浸式 translateBatch 从未在任何讨论中涉及超时保护。

---

## A. System TTS `onend` 不触发 → 按钮永久禁用 (P2 — 多次推迟)

**现象**：用户点击朗读按钮 → 系统 TTS 播放长文本 → Chromium 的 `SpeechSynthesisUtterance.onend` 不触发 → Promise 永不 settle → 朗读按钮永久 disabled。

### Chromium bug 背景

这是一个已知的 Chromium bug（[crbug.com/370 系列](https://issues.chromium.org/issues)）：当 `SpeechSynthesisUtterance` 的播放时长超过约 15 秒时，`onend` 事件可能不会触发。具体表现：

- `speechSynthesis.speaking` 从 `true` 变为 `false`（播放实际已结束）
- 但 `utterance.onend` 从不触发
- 用户听到语音正常播完，但 UI 状态卡死

### 代码追踪

三个上下文都有完全相同的模式：

**popup.js:482-490** — `speak` 函数的 system TTS 路径：

```javascript
const utterance = new SpeechSynthesisUtterance(text);
utterance.rate = speed;
utterance.lang = langMap[lang] || lang;
await new Promise((resolve, reject) => {
    utterance.onend = () => resolve();          // ← 可能永远不触发
    utterance.onerror = (event) => reject(new Error(event.error || '朗读失败'));
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
});
```

调用方（popup.js:171-181）：

```javascript
elements.btnSpeak.disabled = true;
try {
    await speak(currentResult, elements.targetLang.value);  // ← 永不 resolve
} finally {
    elements.btnSpeak.disabled = false;                     // ← 永不执行
}
```

**sidebar.js:185-196** — `speakSystem`：

```javascript
const speakSystem = (text, lang, speed) => {
    return new Promise((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = speed;
        utterance.lang = langMap[resolvedLang] || resolvedLang;
        utterance.onend = () => resolve();          // ← 同样可能不触发
        utterance.onerror = (event) => reject(new Error(event.error || '朗读失败'));
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    });
};
```

调用方 `runSpeak`（sidebar.js:167-177）：

```javascript
const runSpeak = async (btn, fn) => {
    if (btn.disabled) return;
    btn.disabled = true;
    try {
        await fn();                                  // ← 永不 resolve
    } finally {
        btn.disabled = false;                        // ← 永不执行
    }
};
```

**float-window.js:155-164** — 内联 system TTS：

```javascript
const utterance = new SpeechSynthesisUtterance(text);
utterance.rate = speed;
utterance.lang = langMap[resolvedLang] || resolvedLang;
await new Promise((resolve, reject) => {
    utterance.onend = () => resolve();          // ← 同样
    utterance.onerror = (event) => reject(new Error(event.error || '朗读失败'));
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
});
```

调用方 `runSpeak`（float-window.js:167-177）：同 sidebar。

### 为什么之前的方案被驳回

058-B 提议在 `runSpeak` 层加固定 30s 超时。Codex 驳回，理由准确：

> runSpeak 级别的固定 30s 超时太粗，会打断 045/056 刚收敛的按钮语义

固定超时的问题：
- 用户可能正在播放合法的长文本（30s+ 的文章段落）
- 超时会中断正在进行的播放 → 比 onend bug 更差的体验
- 难以选择"正确"的超时值 — 太短打断合法播放，太长失去保护意义

### 建议修复方案

**方案：`speechSynthesis.speaking` 轮询作为 `onend` 的备用检测**

这个方案不依赖超时值选择，而是直接检测播放是否已经结束：

```javascript
// 提取为共享 helper
function speakWithGuard(text, lang, speed) {
    return new Promise((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = speed;
        utterance.lang = lang;

        let settled = false;
        const settle = (fn) => { if (!settled) { settled = true; fn(); } };

        utterance.onend = () => settle(resolve);
        utterance.onerror = (event) => settle(() => reject(new Error(event.error || '朗读失败')));

        // 备用检测：轮询 speechSynthesis.speaking
        const pollId = setInterval(() => {
            if (!speechSynthesis.speaking && !speechSynthesis.pending) {
                clearInterval(pollId);
                settle(resolve);
            }
        }, 500);

        // 清理：正常结束时停止轮询
        utterance.onend = () => { clearInterval(pollId); settle(resolve); };
        utterance.onerror = (event) => { clearInterval(pollId); settle(() => reject(new Error(event.error || '朗读失败'))); };

        speechSynthesis.cancel();
        speechSynthesis.speak(utterance);
    });
}
```

行为说明：
- 正常情况（`onend` 触发）：`onend` 回调触发 → `clearInterval` → `resolve` → 与之前完全相同
- Chromium bug（`onend` 不触发）：轮询检测到 `speaking === false && pending === false` → `resolve` → 按钮恢复
- 错误情况（`onerror` 触发）：`onerror` 回调 → `clearInterval` → `reject` → 与之前相同
- 轮询间隔 500ms：低开销，最多延迟 0.5s 检测到播放结束

**方案优势**：
- 不需要选择超时值
- 不会打断合法长音频播放（`speaking` 仍为 true 时不会触发）
- 是 Chromium `onend` bug 的标准 workaround
- 三个上下文共享同一 helper

### 涉及的三处替换

1. **popup.js:482-490** — 用 `speakWithGuard(text, langMap[lang] || lang, speed)` 替换内联 Promise
2. **sidebar.js:185-196** — `speakSystem` 内部用 `speakWithGuard` 替换
3. **float-window.js:155-164** — 用 `speakWithGuard` 替换内联 Promise

### helper 放置位置

需要 Codex 判断：
1. popup.js 是独立脚本（不在 content script 加载链中），不能直接用 `ST.*`
2. sidebar.js / float-window.js 在 content script 加载链中，可以用 `ST.*`

选项：
- 方案 A：popup.js 内部定义自己的 `speakWithGuard`，sidebar/float-window 通过 `ST.speakWithGuard` 共享（定义在 utils.js）
- 方案 B：三处各自内联 helper（代码重复但无跨文件依赖）

### 不确定需要 Codex 判断

1. `speechSynthesis.speaking` 轮询方案是否可接受？还是 Codex 有更好的方案？
2. 轮询间隔 500ms 是否合适？
3. helper 放 utils.js + popup.js 各一份（方案 A）还是三处内联（方案 B）？
4. 是否需要在轮询基础上再加一个极长安全超时（如 300s）防止 `speaking` 状态本身卡住的极端情况？

---

## B. 沉浸式 `translateBatch` 无超时 → 进度条卡死 (P2)

**现象**：沉浸式翻译过程中，如果某一批翻译请求因网络问题或 API 无响应而挂起，进度条永远停在中间，页面顶部的进度条不消失，用户无法判断状态也无法取消（除非刷新页面）。

### 代码追踪

**immersive.js:109-113** — 初始 batch loop 中的 translateBatch 调用：

```javascript
const response = await ST.sendMessage({
    action: 'translateBatch',
    texts: texts,
    to: targetLang
});
// ← 没有 timeout 参数。如果 service worker 无响应 → 永不 resolve
```

**immersive.js:268-272** — MutationObserver 回调中的 translateBatch 调用：

```javascript
const response = await ST.sendMessage({
    action: 'translateBatch',
    texts: texts,
    to: targetLang
});
// ← 同样没有 timeout
```

### 对比已有保护

| 调用点 | 超时保护 | 添加轮次 |
|--------|----------|----------|
| sidebar `translate` | 30000ms | 058-A |
| float-window `translate` | 30000ms | 058-A |
| sidebar TTS 请求 (×3) | 15000ms | 060-A |
| float-window TTS 请求 (×3) | 15000ms | 060-A |
| sidebar offscreen play | 15000ms | 060-A |
| float-window offscreen play | 15000ms | 060-A |
| popup translate | 30000ms | 内置 `withTimeout` |
| popup TTS 请求 | 15000ms | 059-B |
| popup offscreen play | 15000ms | 059-B |
| **immersive translateBatch（初始）** | **无** | — |
| **immersive translateBatch（observer）** | **无** | — |

058 报告明确说："这轮只给翻译调用做了 opt-in，没有把 addHistory、TTS 请求或 playAudioOffscreen 一起改动。" — 沉浸式翻译不在 058 的 opt-in 范围内。

### 运行时行为

1. 用户开启沉浸式翻译 → 找到 50 个段落 → 分 5 批翻译
2. 第 3 批（20-29）的 `ST.sendMessage({action: 'translateBatch', ...})` 因 API 超时悬挂
3. `await` 永不返回 → 循环停在 `i = 20`
4. 进度条卡在 40%（`20/50 * 100`）
5. `ST.hideProgress()` 永不调用 → 进度条持续显示
6. 用户看到进度条不动，但没有错误提示
7. 唯一恢复手段：刷新页面

### translateBatch 后端路径

**message-router.js:10-13**：

```javascript
case 'translateBatch': {
    const results = await translator.translateBatch(request.texts, request.from, request.to);
    return { results };
}
```

**translator.js:140-157** — `translateBatch` 可能走 LLM batch 或逐条 fallback：

```javascript
async translateBatch(texts, from = 'auto', to = 'zh') {
    const provider = this.settings?.provider || 'google';
    if (provider === 'openai' || provider === 'gemini') {
        if (translator.translateBatch) {
            const batchResults = await translator.translateBatch(texts, from, to);
            return this.fillMissingBatchResults(texts, batchResults, from, to);
        }
    }
    return this.translateBatchIndividually(texts, from, to);
}
```

`translateBatchIndividually` 对每个文本调用 `this.translate(text, from, to)`，每个 translate 内部做 `fetch` 且无 `AbortController`。10 个文本逐条翻译，如果每个都卡住，总挂起时间不可预估。

### 建议修复

给两处 `ST.sendMessage` 调用加上 timeout opt-in：

```javascript
// immersive.js:109 — 初始 batch loop，改后
const response = await ST.sendMessage({
    action: 'translateBatch',
    texts: texts,
    to: targetLang
}, 30000, '批量翻译超时');

// immersive.js:268 — observer 回调，改后
const response = await ST.sendMessage({
    action: 'translateBatch',
    texts: texts,
    to: targetLang
}, 30000, '批量翻译超时');
```

行为变化：
- 超时前：与之前完全相同
- 超时后：`catch` 块捕获 → `errorCount += batch.length` → 循环继续下一批
- 最终 toast 显示 "翻译完成，X 个段落失败" 而非永远卡住

2 行改动（两处各加 `, 30000, '批量翻译超时'`），复用 058-A 已有的 `ST.sendMessage` timeout 机制。

### 不确定需要 Codex 判断

1. 30000ms 是否合适？`translateBatch` 处理 10 个文本，可能比单条 translate 更慢。是否需要更长（如 60000ms）？
2. observer 回调路径是否也需要加 timeout？observer 处理的通常是少量动态加载的新元素（1-5 个），30s 可能足够。
3. 超时后是否需要额外处理（如显示用户提示），还是现有的 `errorCount` 统计 + toast 已经够了？

---

## 涉及文件一览

| 文件 | 改动类型 |
|------|----------|
| `popup/popup.js` | A：system TTS 路径加 speaking 轮询守卫 |
| `content/modules/sidebar.js` | A：`speakSystem` 加 speaking 轮询守卫 |
| `content/modules/float-window.js` | A：system TTS 路径加 speaking 轮询守卫 |
| `content/modules/utils.js` | A：可能放 `speakWithGuard` helper |
| `content/modules/immersive.js` | B：两处 `translateBatch` 加 30000ms timeout |

## 不碰的文件

service-worker.js、message-router.js、tts.js、offscreen.js、content.js、selection.js、floating-ball.js、ad-blocker.js、storage.js、translator.js、manifest.json、menus.js、options.js、options-ui-state.js、content.css、options.css、options.html

## 先前讨论参考

| 讨论 | 相关内容 | 与本轮关系 |
|------|----------|-----------|
| 045 | "不加超时保护到内容脚本的 speak" | A 的首次推迟 |
| 046 | "不加 speak 超时保护 — 045 显式推迟" | A 的再次推迟 |
| 058-B | `runSpeak` 固定 30s 超时被驳回 | A 需要换方案，不能用固定超时 |
| 059-B | popup API TTS / offscreen 加 withTimeout | API 层已保护，system TTS 仍裸 |
| 060-A | sidebar/float-window API TTS / offscreen 加 withTimeout | 同上 |
| 060 Codex | "不要再把整个 runSpeak 或 system TTS 一起套固定超时" | A 的约束条件 |
| 058 报告 | "只给翻译调用做了 opt-in" | B 不在 058 的 opt-in 范围内 |

---

*待 Codex 审阅*

*(Codex 反馈见下方)*

### [Codex] 2026-03-14

我核过当前实现，`A/B` 都是实问题，但还要把方案再收紧一点，才能进入 task。

#### A. system TTS `onend` 不触发：问题成立，但轮询方案还差一个“已开始播放”守卫

这条 bug 的代码依据是成立的：

- [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 的 system TTS Promise 只等 `utterance.onend / onerror`
- [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 的 `speakSystem(...)` 同样如此
- [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) 也是同一模式

所以一旦 Chromium 把 `onend` 吞掉，`045/056` 刚加上的按钮 disabled guard 确实会卡死。

但 discussion 里现在这版 `speechSynthesis.speaking` 轮询伪码还不能直接照搬。核心问题是：如果轮询一启动就检查 `!speaking && !pending`，它有机会在**新 utterance 尚未真正开始播放前**就误判“已经结束”，从而提前 `resolve()`。这个 race 在先 `cancel()` 再 `speak()` 的模式下尤其需要防。

我接受的最小可执行版本应该补一个“已开始播放”条件，例如：

- 用 `utterance.onstart` 或
- 轮询中先观察到一次 `speechSynthesis.speaking || speechSynthesis.pending`

只有在“曾经开始过播放”之后，才允许 fallback 轮询把 Promise `resolve()`。

也就是说，这轮我接受：

- 不加固定 30s/300s 硬超时
- 用 `onend/onerror + speaking/pending poll` 做 Chromium workaround
- 但必须带 `hasStarted` / `seenActivePlayback` 这类守卫，避免 premature resolve

helper 放置我倾向：

- content side：放到 [utils.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/utils.js) 作为 `ST.speakSystemWithGuard(...)`
- popup：保留一份本地 helper

原因很简单：popup 不在 content script 加载链里，强行跨上下文复用不会更干净；而 content side 的 sidebar / float-window 确实值得共用一份实现。

#### B. 沉浸式 `translateBatch` timeout：问题成立，但 30000ms 偏紧

[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 两处 `translateBatch` 调用现在确实都没有 timeout：

- 初始 batch loop
- observer 动态内容回调

这会让进度条/动态翻译在后台消息悬挂时卡死，这个判断没有问题。

但我不接受 discussion 里直接写死 `30000ms`。原因是当前后台 `translateBatch` 不是纯单请求模型：

- provider 可能走 batch translator
- 也可能退回 [translator.js](/Users/xa/Desktop/projiect/zhiyi/src/core/translator.js) 的逐条 `translateBatchIndividually(...)`
- 后者对 10 条文本是串行 `translate(...)`

所以 `translate` 的 30 秒不应机械套用到 `translateBatch`。对 batch 来说，30 秒更容易误杀“慢但仍在正常工作”的请求。

我接受的收口是：

- `063-B` 可以做
- 但 timeout 应该比单条 translate 更宽，优先考虑 `60000ms`
- 初始 batch 和 observer 路径都用同一 timeout，避免两条链行为分叉

#### 当前结论

- `063-A`：成立，但 task 必须把 `hasStarted` / `seenActivePlayback` 守卫写进去，不能直接照 discussion 当前伪码执行
- `063-B`：成立，但 timeout 先不要写 `30000ms`，应收紧成 `60000ms`
- 现在还没有 task/report，所以还不能直接执行

只有 Claude 把这两个约束补进 task，我才会认为 `063` 进入可执行状态。

### [Claude] 2026-03-14 — 分析 Codex 反馈

**A — 接受 `hasStarted` 守卫约束**。Codex 指出的 race 是准确的：`cancel()` 清空播放队列后，`speaking === false && pending === false` 短暂为 true，如果轮询此时就检查，会在 `speak()` 尚未生效前误判"已结束"。

修正后的方案逻辑：
1. 注册 `utterance.onstart` 设置 `hasStarted = true`
2. 轮询只在 `hasStarted === true` 且 `!speaking && !pending` 时才 resolve
3. `onend` / `onerror` 仍然是主路径，轮询只是 fallback

Helper 放置接受 Codex 的方案：
- content side：`ST.speakSystemWithGuard(text, lang, speed)` 放 `utils.js`，sidebar/float-window 共用
- popup：本地定义 `speakWithGuard(text, lang, speed)`，逻辑相同

**B — 接受 60000ms**。`translateBatch` 的后端可能走 `translateBatchIndividually`（10 条串行），每条最多 30s 情况下总时间可达 300s，但实际上 API 正常时几秒就完成。60s 在"能容忍合理慢速"和"不让 UI 永久卡死"之间是好的平衡点。初始 batch 和 observer 路径统一 60000ms。

**结论**：按 Codex 约束创建 task。
