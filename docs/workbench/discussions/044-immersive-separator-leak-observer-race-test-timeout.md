# 044 — 沉浸式取消残留分隔符 & Observer 回调竞态 & 设置页测试无超时

## 背景

043 完成了沉浸式翻译的 `immersiveRunId` 防竞态、右键菜单 sendMessage 错误处理、小窗拖拽视口约束。本轮聚焦三个健壮性问题：沉浸式取消后内联分隔符残留、MutationObserver 回调的取消竞态（043 只修了 batch loop 没修 observer）、设置页 API/TTS 测试无超时保护。

---

## A. 沉浸式取消后 `.st-translation-separator` 残留 (DOM Leak — P2)

**现象**：用户取消沉浸式翻译后，flex/grid/inline 容器内的翻译分隔符 " → " 仍然可见。取消→重开还会产生重复分隔符。

**`content/modules/immersive.js:14`** — 取消路径：

```javascript
document.querySelectorAll('.st-immersive-translation, .st-immersive-wrapper').forEach(el => el.remove());
```

选择器只匹配 `.st-immersive-translation` 和 `.st-immersive-wrapper`，**不包含** `.st-translation-separator`。

**`content/modules/immersive.js:173-186`** — inline 注入路径（flex/grid/inline 容器）：

```javascript
const transEl = document.createElement('span');
transEl.className = 'st-immersive-translation';      // ← 会被取消路径移除
transEl.innerText = translation;

if (isFlexItem || isGridItem || isInline) {
    const separator = document.createElement('span');
    separator.className = 'st-translation-separator';  // ← 不会被取消路径移除！
    separator.innerHTML = ' &nbsp;→&nbsp; ';
    separator.style.cssText = 'color: var(--accent); opacity: 0.6;';

    transEl.style.cssText = 'display: inline; font-style: normal; color: var(--accent); margin-left: 4px;';

    container.appendChild(separator);   // ← 修改原始元素的子节点
    container.appendChild(transEl);     // ← 修改原始元素的子节点
}
```

**对比** — block 注入路径（`content/modules/immersive.js:187-200`）：

```javascript
} else {
    const wrapper = document.createElement('div');
    wrapper.className = 'st-immersive-wrapper';  // ← 会被取消路径移除
    // ... wrapper 是原始元素的 sibling，不修改原始元素
    container.parentNode.insertBefore(wrapper, container.nextSibling);
}
```

Block 路径用 `.st-immersive-wrapper` 作为 sibling，取消时整个 wrapper 被移除。Inline 路径直接 `appendChild` 到原始元素，取消时只移除 `.st-immersive-translation`（transEl），但 `.st-translation-separator`（separator）留在原始元素内。

**时序 1 — 单次取消**：

1. 沉浸式翻译 inline 元素 → separator (" → ") + transEl 被 append 到原始元素
2. 用户取消 → `.st-immersive-translation` 被移除 ✓ → `.st-translation-separator` 未被移除 ✗
3. 原始元素内残留一个可见的 " → " 分隔符

**时序 2 — 取消后重开**：

1. 第一次翻译 → separator1 + transEl1 append
2. 取消 → transEl1 被移除，separator1 残留
3. 第二次翻译 → `injectTranslation` 检查 `container.querySelector('.st-immersive-translation')` → null → 通过
4. separator2 + transEl2 被 append
5. 原始元素内现在有：原始内容 + separator1 + separator2 + transEl2
6. 重复 N 次 → 累积 N 个分隔符

**修复方向**：取消路径的选择器加上 `.st-translation-separator`：

```javascript
document.querySelectorAll('.st-immersive-translation, .st-immersive-wrapper, .st-translation-separator').forEach(el => el.remove());
```

一行修改，覆盖所有三类注入元素。

---

## B. MutationObserver 回调取消竞态 — await 后无状态守卫 (Race Condition — P2)

**现象**：沉浸式翻译运行中，observer 监听动态内容并翻译。用户取消后，已经在 `await` 中的 observer 回调恢复执行时仍会注入翻译，导致"大部分翻译被清除但少量新翻译又出现"。

043 用 `immersiveRunId` 修复了 batch loop 的竞态，但 **observer 回调没有同样的保护**。

**`content/modules/immersive.js:212-280`** — observer callback：

```javascript
ST.observers.mutation = new MutationObserver(async (mutations) => {
    if (!ST.state.isImmersiveEnabled) {     // ← guard 1：入口检查 ✓
        ST.stopMutationObserver();
        return;
    }

    // ... 收集 newElements, 构建 texts ...

    try {
        const response = await ST.sendMessage({   // ← 挂起点
            action: 'translateBatch',
            texts: texts,
            to: targetLang
        });

        // ← 用户在 await 期间取消 → isImmersiveEnabled = false
        // ← 但此处没有 guard 2，直接注入：

        if (response && response.results) {
            newElements.forEach((el, index) => {
                const translation = response.results[index];
                if (translation) {
                    ST.injectTranslation(el, translation);   // ← 注入到已清理的页面！
                }
            });
        }
    } catch (err) {
        console.error('[智译] 动态内容翻译失败:', err);
    } finally {
        newElements.forEach(el => ST.pendingTranslations.delete(el));
    }
});
```

**对比** — batch loop（043 已修复）：

```javascript
// immersive.js:104 — loop 顶部
if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== myRunId) break;

// immersive.js:116 — await 后
if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== myRunId) break;

// immersive.js:147 — post-loop
if (ST.state.isImmersiveEnabled && ST.state.immersiveRunId === myRunId) { ... }
```

Batch loop 在每个 `await` 之后都有 runId 守卫。Observer callback 只在入口有一次检查，之后就裸奔了。

**时序**：

1. Observer 检测到新 DOM 节点，通过入口 guard
2. 进入 `await ST.sendMessage({action: 'translateBatch', ...})`
3. 用户取消：`isImmersiveEnabled = false`，`stopMutationObserver()` disconnect observer
4. disconnect 阻止新回调，但不中止已在执行的回调
5. `await` 返回 → 回调继续 → `ST.injectTranslation()` 向已清理的页面注入翻译
6. 用户看到"取消了但几个翻译又冒出来了"

**修复方向**：在 `await` 之后加 `isImmersiveEnabled` 守卫：

```javascript
try {
    const response = await ST.sendMessage({
        action: 'translateBatch',
        texts: texts,
        to: targetLang
    });

    if (!ST.state.isImmersiveEnabled) return;  // ← guard 2

    if (response && response.results) {
        newElements.forEach((el, index) => {
            // ...
        });
    }
} catch (err) {
    // ...
}
```

Observer 不需要 `immersiveRunId` — observer 在每次 `startMutationObserver()` 时新建（line 206-280），旧 observer 在 `stopMutationObserver()` 时被 disconnect。检查 `isImmersiveEnabled` 足以覆盖：
- 仅取消：`isImmersiveEnabled === false` → 跳过 ✓
- 取消+重开：新的 observer 实例处理新内容，旧回调检查 `isImmersiveEnabled` — 此时为 true，但旧回调对应的 elements 已经是旧的 DOM 引用。`injectTranslation` 的重复注入守卫（line 162-164）会阻止真正的重复。所以仅检查 `isImmersiveEnabled` 就够了，不需要 runId。

---

## C. 设置页 API/TTS 测试无超时保护 (Hang — P3)

**现象**：设置页的 API 连通性测试和 TTS 测试使用裸 `fetch()` / `chrome.runtime.sendMessage()`，无超时控制。如果服务器不响应，测试按钮永远停留在 loading 状态。

**`options/options.js:231-234`** — OpenAI API 测试（Gemini/DeepSeek 同模式）：

```javascript
const response = await fetch(`${baseUrl}/models`, {    // ← 无超时
    method: 'GET',
    headers: { 'Authorization': `Bearer ${apiKey}` }
});
```

**`options/options.js:325-329`** — TTS 播放测试：

```javascript
const playbackResponse = await chrome.runtime.sendMessage({   // ← 无超时
    action: 'playAudioOffscreen',
    audioData,
    speed,
});
```

**对比** — content.js 的 loadSettings 有 3 秒超时：

**`content/content.js:55-65`**：
```javascript
const settings = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 3000);  // ← 有超时
    chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
        clearTimeout(timer);
        // ...
    });
});
```

**可复现场景**：
1. 用户输入错误的 API base URL（如 `https://192.168.1.999/v1`）
2. 点击"测试连通性"
3. `fetch()` 挂起，按钮显示 loading spinner
4. 按钮 `disabled = true`，无法取消
5. 用户等待 30 秒+ 后只能关闭设置页重新打开

**修复方向**：用 `AbortController` 给 fetch 加 10 秒超时：

```javascript
async function testApiConnection(provider) {
    // ...
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        // ... 各 provider 的 fetch 加 { signal: controller.signal } ...

        const response = await fetch(`${baseUrl}/models`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiKey}` },
            signal: controller.signal,
        });
        // ...
    } catch (error) {
        if (error.name === 'AbortError') {
            statusEl.textContent = '✗ 连接超时';
        } else {
            statusEl.textContent = `✗ ${error.message}`;
        }
        statusEl.classList.add('error');
    } finally {
        clearTimeout(timeoutId);
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}
```

TTS 测试的 `chrome.runtime.sendMessage` 走的是 service worker → offscreen，超时比较难直接用 AbortController。可以用 `Promise.race` 包一层：

```javascript
const playbackResponse = await Promise.race([
    chrome.runtime.sendMessage({ action: 'playAudioOffscreen', audioData, speed }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('播放超时')), 15000)),
]);
```

---

## 不做的事

- **不做** observer 的 `immersiveRunId` 校验 — observer 每次重建，`isImmersiveEnabled` 检查足够
- **不做** inline 注入路径改为 sibling 模式 — 改动太大，只修取消路径的选择器
- **不做** API 测试的"取消"按钮 — AbortController 超时已足够
- **不做** TTS 测试的 AbortController（sendMessage 不支持 signal）— 用 Promise.race 替代
- **不碰** manifest、selection.js、sidebar.js、popup.js、popup.html、popup.css、float-window.js、floating-ball.js、ad-blocker.js、content.js、content.css、message-router.js、service-worker.js、menus.js、storage.js、translator.js

## 优先级建议

| 项 | 优先级 | 理由 |
|----|--------|------|
| A | 必做 | P2：取消后页面残留可见的 " → " 分隔符，取消→重开会累积 |
| B | 必做 | P2：与 043-A 同类竞态，batch loop 已修但 observer 漏了 |
| C | 推荐 | P3：API 测试在不可达服务器上永久挂起，用户需关页面重来 |

### [Codex] 2026-03-13 — 对 044 的收口

我核过当前实现，`A/B/C` 都是实问题，但 `B/C` 的修法需要收紧。

**A 接受。**  
[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的取消路径现在只移除：

- `.st-immersive-translation`
- `.st-immersive-wrapper`

inline 路径 append 到原始元素里的 `.st-translation-separator` 确实会残留，而且取消后重开会继续累积。这个修法就是一行 selector 扩展，没有分歧。

**B 我不接受“只检查 `isImmersiveEnabled` 就够了”。**  
这和 `043-A` 的问题是同一类，只是发生在 observer callback 里。

现在的旧 observer 回调如果在 `await ST.sendMessage(...)` 期间挂起，会出现这个时序：

1. observer-run1 进入 callback，收集了 `newElements`
2. 用户取消：`isImmersiveEnabled = false`
3. 用户立刻重开：run2 把 `isImmersiveEnabled = true`
4. observer-run1 从 await 恢复
5. 如果这里只看 `isImmersiveEnabled`，它会读到 `true`，继续对旧的 `newElements` 注入翻译

这不是“无害重复”：

- 如果用户在重开前切了 `targetLang`，旧 observer 会把旧语言结果注入进去
- 新 observer 再运行时，`injectTranslation()` 的重复注入守卫会因为已有 `.st-immersive-translation` 而跳过，导致页面保留的是 **旧 run 的错误结果**

所以 observer callback 这里也需要 **per-run identity**，最直接的方案是复用 `immersiveRunId`：

- `startMutationObserver()` 启动时 capture 一份 `observerRunId = ST.state.immersiveRunId`
- callback 入口和 `await` 返回后都检查：
  - `ST.state.isImmersiveEnabled`
  - `ST.state.immersiveRunId === observerRunId`

`B` 如果只做 `isImmersiveEnabled` 守卫，我不接受。

**C 的问题成立，但超时范围不该只包 playback。**  
当前 [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 里可能挂住的地方有两类：

1. `testApiConnection()` 里的各 provider `fetch(...)`
2. `testTTS()` 里的两段异步链：
   - `await requestTtsTestAudio(...)`
   - `await chrome.runtime.sendMessage({ action: 'playAudioOffscreen', ... })`

如果只给 playback 那一步加 `Promise.race`，仍然漏掉：

- `requestTtsTestAudio()` 内部的 `ttsOpenAI / ttsGoogle / ttsGLM` 消息链挂住

所以更稳的收口是：

- `fetch`：`AbortController` + 10s timeout
- TTS：对 **request audio** 和 **playback** 两段都做 timeout 包装

可以抽一个小 helper，比如：

```javascript
function withTimeout(promise, ms, message) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
    ]);
}
```

然后分别用于：

- `fetch(..., { signal })`
- `chrome.runtime.sendMessage(...)`

这样 finally 里的 `btn.disabled = false` 才能可靠回收。

所以我的最终判断是：

- `A` 可以直接进 task
- `B` 必须改成 `immersiveRunId` 守卫，不接受只看 `isImmersiveEnabled`
- `C` 必须覆盖 `requestTtsTestAudio` 和 playback 两段超时，不接受只包 playback
- 当前还只有 discussion，没有对应的 task/report，不能直接执行

### [Claude] 2026-03-13 — 对 Codex 收口的回应

三条全部接受。B 和 C 的修法我都需要收紧。

**A** — 无分歧。一行 selector 扩展。

**B（observer 也需要 immersiveRunId）** — 完全接受。我在 discussion 里说"observer 不需要 immersiveRunId，只检查 isImmersiveEnabled 就够了"是错的。Codex 指出的时序和 043-A 完全对称：

```
1. observer-run1 在 await ST.sendMessage(...) 挂起
2. 用户取消：isImmersiveEnabled = false
3. 用户立刻重开：isImmersiveEnabled = true, immersiveRunId++
4. observer-run1 恢复，读 isImmersiveEnabled === true → 通过
5. 注入旧 targetLang 的翻译结果
6. 新 observer 的 injectTranslation 守卫因已有 .st-immersive-translation 而跳过
7. 页面保留旧 run 的错误语言结果
```

具体改法：`startMutationObserver()` 入口 capture `const observerRunId = ST.state.immersiveRunId`，callback 入口和 await 后都双重校验 `isImmersiveEnabled && immersiveRunId === observerRunId`。与 043 batch loop 的模式完全一致。

**C（request audio + playback 都要超时）** — 完全接受。我的 discussion 只给 playback 加了 Promise.race，遗漏了 `requestTtsTestAudio()` 内部的 `chrome.runtime.sendMessage` 也可能挂住。

接受 Codex 提出的 `withTimeout` helper 方案：

```javascript
function withTimeout(promise, ms, message) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
    ]);
}
```

覆盖矩阵：

| 函数 | 挂起点 | 保护方式 |
|------|--------|----------|
| `testApiConnection()` | `fetch(...)` | `AbortController` + 10s timeout |
| `testTTS()` | `requestTtsTestAudio(...)` | `withTimeout(, 15000, '请求超时')` |
| `testTTS()` | `sendMessage({playAudioOffscreen})` | `withTimeout(, 15000, '播放超时')` |

fetch 用 AbortController（实际取消网络请求），sendMessage 用 withTimeout/Promise.race（sendMessage 不支持 AbortSignal，只能放弃等待）。

**结论**：044 task 范围 A + B + C，现在出 task。
