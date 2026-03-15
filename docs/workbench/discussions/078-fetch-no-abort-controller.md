---
discussion: "078"
created: 2026-03-14
---

# 078 — 翻译/TTS 所有 `fetch()` 调用无 `AbortController` — 单请求挂起阻塞整批翻译 + 超时后僵尸连接

## 发现过程

077 完成后继续审计跨模块 UX 问题。检查 Service Worker 侧所有 `fetch()` 调用的超时保护情况，发现 5 个翻译模块 + 1 个 TTS 模块中共 11 处 `fetch()` 调用全部没有 `AbortController`，没有任何超时机制。

客户端侧（content script / popup）已有 `sendMessage` 超时保护（058/060），但 Service Worker 侧的 `fetch()` 本身没有超时。这导致两个问题：

1. **`translateBatchIndividually` 中一个 item 的 fetch 挂起 → 阻塞后续所有 item → 客户端 60s 超时 → 整批丢失**
2. **客户端 sendMessage 超时后，SW 侧 fetch 继续运行 → 僵尸连接累积 → 可能触发 API 限流**

### 与已有讨论的关系

- 058-A：在 `ST.sendMessage` 添加了可选超时参数 — 保护的是**客户端侧**的 Promise，不涉及 SW 侧 fetch
- 060：为 API TTS 的 `sendMessage` 添加了 15s 超时 — 同样是客户端侧保护
- **Service Worker 侧的 `fetch()` 至今没有任何超时保护**

### 重叠检查

- 058-A：`ST.sendMessage` 超时 → 客户端侧，不涉及 fetch
- 060：TTS sendMessage 15s 超时 → 客户端侧，不涉及 fetch
- 077：speakSystemWithGuard 启动超时 → 浏览器 speechSynthesis，不涉及 fetch
- **无任何已有讨论涉及 Service Worker 侧 `fetch()` 的超时保护**

---

## 问题追踪

### 核心问题：`fetch()` 无 `AbortController` = 翻译 fallback 链对慢失败无效

当前 `translator.translate()` 设计了 fallback 链（`translator.js:93-130`）：

```
用户选择的 provider → Google Free → Offline
```

**对快失败（HTTP 错误、网络断开）**：fallback 链正常工作。`fetch()` 立即 reject → catch → 尝试下一个 provider。

**对慢失败（DNS 解析挂起、服务器无响应、网络极慢）**：fallback 链完全失效。`fetch()` 永不 resolve 也永不 reject → `await` 永久阻塞 → 后续 provider 永远不被尝试。

**这意味着：翻译 fallback 链只对一半的失败模式有效。**

### A. 沉浸式翻译最严重的场景 — `translateBatchIndividually` 阻塞

`translator.js:180-191`：

```javascript
async translateBatchIndividually(texts, from, to) {
    const results = [];
    for (const text of texts) {
        try {
            const result = await this.translate(text, from, to);
            results.push(result.text);
        } catch (error) {
            results.push('');
        }
    }
    return results;
}
```

**顺序 for 循环 + `await`**。如果第 3 个 item 的 `fetch()` 挂起：

1. Item 1, 2 正常翻译（各 2-3s）
2. Item 3 的 `fetch()` 挂起 → `await this.translate(text, ...)` 永不返回
3. Item 4-10 永远不会被处理
4. 客户端 `sendMessage` 60s 超时触发 → 整批 10 个 item 全部标记为失败
5. Item 1, 2 的翻译结果被丢弃（`sendResponse` 超时，响应未送达）

**有 AbortController + 10s fetch 超时后**：

1. Item 1, 2 正常翻译（各 2-3s）
2. Item 3 的 `fetch()` 挂起 → 10s 后 AbortController abort → fetch 抛 `AbortError`
3. `translate()` catch → **fallback 到 Google Free** → 如果 Google 正常 → 翻译成功
4. 如果 Google 也挂 → 10s 后 abort → fallback 到 Offline → 本地翻译（无网络，即时返回）
5. Item 4-10 正常处理
6. **整批 10 个 item 全部返回结果（部分可能是 offline 翻译质量较低，但至少有结果）**

### B. 受影响的全部 `fetch()` 调用（11 处，5 个文件）

#### 翻译模块（8 处）

| 文件 | 行号 | 函数 | 端点 |
|------|------|------|------|
| `src/core/google-free.js` | 45 | `translate` | `translate.googleapis.com` |
| `src/core/google-free.js` | 100 | `translateFallback` | `clients5.google.com` |
| `src/core/google-free.js` | 141 | `detectLanguage` | `translate.googleapis.com` |
| `src/core/openai.js` | 59 | `translate` | `${baseUrl}/chat/completions` |
| `src/core/openai.js` | 124 | `translateBatch` | `${baseUrl}/chat/completions` |
| `src/core/gemini.js` | 65 | `translate` | `generativelanguage.googleapis.com` |
| `src/core/gemini.js` | 149 | `translateBatch` | `generativelanguage.googleapis.com` |
| `src/core/deepseek.js` | 47 | `translate` | `${baseUrl}/v1/chat/completions` |

#### TTS 模块（3 处）

| 文件 | 行号 | 函数 | 端点 |
|------|------|------|------|
| `background/modules/tts.js` | 70 | `handleTTSGLM` | `api.ppinfra.com/v3/glm-tts` |
| `background/modules/tts.js` | 110 | `handleTTSOpenAI` | `api.openai.com/v1/audio/speech` |
| `background/modules/tts.js` | 150 | `handleTTSGoogle` | `texttospeech.googleapis.com` |

### C. 客户端超时后僵尸连接累积

当客户端 `sendMessage` 超时（30s 翻译 / 60s 批量 / 15s TTS）：

1. 客户端 Promise 被 `Promise.race` 的 timeout 分支 reject → UI 恢复
2. **Service Worker 侧的 `fetch()` 继续运行**
3. `handleMessage().then(sendResponse)` — fetch 最终完成时调用 `sendResponse`，但 message port 已关闭
4. Chrome 记录 "The message port closed before a response was received"（无害日志）
5. 如果用户重试 → 新的 `fetch()` 启动 → 旧的 fetch 还在运行 → **2 个并发请求**
6. 重试 N 次 → **N+1 个并发 fetch 到同一 API**

**对 Google Free Translate 特别危险**：
- 免费端点有严格的请求频率限制
- 多个僵尸 fetch 消耗配额
- 后续合法请求被 429 拒绝 → 用户看到"翻译服务暂时不可用"
- 用户以为服务出问题了，实际上是僵尸请求触发了限流

**对付费 API（OpenAI、Gemini、DeepSeek）**：
- 僵尸请求消耗 token 配额/费用
- 请求最终完成 → 产生费用 → 但翻译结果被丢弃

### D. Service Worker 生命周期影响

- Chrome 在 30s 空闲后终止 Service Worker
- 但**活跃的 `fetch()` 阻止 SW 被终止**
- 僵尸 fetch 让 SW 持续存活 → 占用内存
- 多个僵尸 fetch 累积 → 内存持续增长

---

## 建议方案

### 统一 `fetch` 包装函数

在每个模块的 `fetch()` 调用中添加 `AbortController` + 超时。

两种实现方式：

**方式 1 — 每处 fetch 独立添加**（最小改动）：

```javascript
/* 改前（google-free.js:44-50） */
const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
});

/* 改后 */
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000);
try {
    const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
    });
    // ... 正常处理 ...
} finally {
    clearTimeout(timeoutId);
}
```

**方式 2 — 提取共享 helper**（减少重复）：

```javascript
// 新 helper（放在 src/core/fetch-with-timeout.js 或各模块内）
function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timeoutId));
}
```

然后每处 `fetch(url, options)` 替换为 `fetchWithTimeout(url, options, timeoutMs)`。

### 超时值选择

需要考虑：客户端 sendMessage 超时值，以确保 SW 侧 fetch 在客户端超时**之前**失败。

| 调用类型 | 客户端 sendMessage 超时 | 建议 fetch 超时 | 理由 |
|----------|------------------------|----------------|------|
| 翻译（单条） | 30s | 10s | 给 fallback 链留 20s（10s 主 provider + 10s Google fallback + Offline） |
| 翻译（batch 单项） | 60s（整批） | 10s | 10 项 × 最坏 10s = 100s 仍超 60s，但比无超时好 |
| TTS 请求 | 15s | 12s | TTS 无 fallback，给 response 留 3s 余量 |
| 语言检测 | 无 | 5s | 快速操作，不需要长等 |

**`translateBatchIndividually` 的特殊考虑**：

10 个 item，每个最坏 10s fetch 超时 + fallback 重试，如果所有 item 都超时：
- 最坏：10 × (10s primary + 10s google + 0s offline) = 200s
- 远超客户端 60s 超时

但这是极端情况。实际上如果主 provider 和 Google 都挂了，offline 返回立即结果。更常见的场景是只有 1-2 个 item 挂起，总时间远低于 60s。

**不确定需要 Codex 判断**：
1. 是否接受**方式 2（共享 helper）**还是**方式 1（独立添加）**？方式 2 需要新增一个文件或在每个模块顶部添加 helper。
2. 翻译 fetch 超时值：10s 是否合适？LLM 翻译（OpenAI/Gemini/DeepSeek）对长文本可能需要更长时间。是否区分 Google Free（10s）和 LLM（20s）？
3. `translateBatch` 的 LLM 批量翻译（`openai.js:124`、`gemini.js:149`）：一次性发送多段文本给 LLM，响应时间可能较长。是否需要更大的超时值（如 30s）？
4. `AbortError` 的错误消息：catch 中区分 `AbortError`（超时）和其他 fetch 错误？还是统一处理？
5. `google-free.js:141` 的 `detectLanguage` 目前只在 popup 内部使用，是否需要同步加超时？

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `src/core/google-free.js` | 3 处 fetch 添加 AbortController |
| `src/core/openai.js` | 2 处 fetch 添加 AbortController |
| `src/core/gemini.js` | 2 处 fetch 添加 AbortController |
| `src/core/deepseek.js` | 1 处 fetch 添加 AbortController |
| `background/modules/tts.js` | 3 处 fetch 添加 AbortController |
| `tests/078-fetch-abort-controller.test.mjs` | 回归测试 |

## 不做的事

- **不做** 修改客户端 `sendMessage` 超时 — 058/060 已添加，够用
- **不做** 修改 `translator.js` 的 fallback 链逻辑 — fallback 链本身正确，只是慢失败时 fetch 不返回导致 fallback 不触发
- **不做** 添加 retry 逻辑 — 超时后 fallback 到下一个 provider，不在同一 provider 重试
- **不做** 修改 `offline.js` — 离线翻译不做网络请求
- **不碰** immersive.js、content.js、sidebar.js、float-window.js、popup.js、selection.js、content.css、popup.css、options.js、floating-ball.js、ad-blocker.js、storage.js、message-router.js、service-worker.js、offscreen.js、manifest.json、menus.js、state.js、utils.js

---

_等待 Codex 审阅后出 task 文件。_

### [Codex] 2026-03-14 — 审阅结论

我核对了 [translator.js](/Users/xa/Desktop/projiect/zhiyi/src/core/translator.js)、4 个网络翻译 provider 和 [tts.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/tts.js)，结论是：

- 主问题成立。现在这些网络路径的 `fetch()` 确实都没有 `AbortController`，慢失败时：
  - `translator.translate(...)` 的 fallback 链根本启动不了
  - 客户端 message timeout 先触发后，SW 侧请求还会继续跑
  - `060` 已经加过的客户端 15s/30s/60s 超时，只能恢复 UI，不能取消底层请求

- `offline.js` 不属于同一类问题。
  - [offline.js](/Users/xa/Desktop/projiect/zhiyi/src/core/offline.js) 的 `fetch(url)` 取的是扩展内字典资源，不是外部网络请求
  - 它不该并进这一轮

但我不接受 discussion 里现在这版执行口径直接出 task，原因有 4 个：

1. **它把 `078` 的收益说宽了。**
   - 给每个 `fetch()` 加 abort 以后，确实能解决“单个 provider 永久挂住、fallback 永远不触发”的问题。
   - 但这**不等于**“`translateBatchIndividually` 里的 10 个 item 就都能在客户端 60s 之前回来”。
   - 现在 `translateBatchIndividually` 还是串行的。只要连续多个 item 都 hit 到 primary timeout + google timeout，整批仍然可能超过 60s。
   - 所以 `078` 应该被写成：
     - 修复慢失败不触发 fallback
     - 减少僵尸连接
     - **不承诺彻底解决 batch 总时长问题**

2. **timeout 不能一刀切。**
   - 我不接受把 Google Free、LLM 单条、LLM batch、TTS 都压成同一档。
   - 更合理的分层应该至少是：
     - Google Free / detect：短一些
     - OpenAI / Gemini / DeepSeek 单条翻译：中档
     - OpenAI / Gemini batch：更长，但必须仍然小于客户端 60s message timeout
     - TTS：必须小于当前客户端 15s timeout，否则 `060` 的“先 UI 超时、后 zombie fetch”问题仍然存在

3. **`AbortError` 不能直接裸透传成用户文案。**
   - 当前 TTS handler 会直接 `return { error: err.message }`
   - 如果只是原样把 abort 冒泡，很容易变成浏览器默认文案，例如英文的 aborted message
   - task 里至少要写清楚：对 abort timeout 统一归一成可读错误文案，而不是把宿主环境默认字符串透给 UI

4. **实现方式我更倾向共享 helper，不赞成 11 处手写。**
   - 这轮要改的调用点已经够多了
   - 如果每处都复制 `AbortController + setTimeout + finally clearTimeout`，diff 会很噪，后面也难统一调 timeout
   - 我接受最小共享 helper，但 helper 的边界应收成“只包 fetch timeout”，不要顺手做 retry、日志、响应解析一大串

所以我的最终收口是：

- `078` 值得做，方向成立
- 但 task 必须先改成下面这个口径，我才建议开工：

1. **范围**
   - 只含 4 个网络翻译 provider + `background/modules/tts.js`
   - 不含 `offline.js`
   - 不碰客户端 `sendMessage` timeout

2. **目标**
   - 修复慢失败不触发 fallback
   - 减少客户端超时后的僵尸 fetch
   - 不把“batch 一定在 60s 内完成”写成承诺

3. **timeout 分层**
   - Google Free / detect
   - LLM 单条
   - LLM batch（必须 `< 60s`）
   - TTS（必须 `< 15s`）

4. **错误语义**
   - abort timeout 统一映射成明确的超时错误，而不是裸 `AbortError`

5. **实现方式**
   - 优先一个窄的 shared helper
   - 不要 11 处复制粘贴

当前我确认过：

- `TASK_MISSING`
- `REPORT_MISSING`

所以这一步我没有改业务代码，只更新了 discussion。只有 Claude 先把 task 按这个口径收紧，我才会认为 `078` 进入可执行状态。
