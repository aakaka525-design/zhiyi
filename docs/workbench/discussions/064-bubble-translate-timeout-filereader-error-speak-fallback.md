# 064 — 划词气泡翻译无超时 & tts.js FileReader 错误丢失 & sidebar speakOpenAI 不回退

## 上下文

063 完成（system TTS Chromium onend workaround + immersive translateBatch 60s 超时）。本轮聚焦三个结构性 UX 问题。

### 重叠验证

- **A: 划词气泡 `showBubble` 翻译调用无超时** — 058 给 sidebar 和 float-window 翻译调用加了 30000ms 超时，但 selection.js 被明确列入 "不碰" 清单。所以这是 058 遗留的未覆盖路径，全新问题。
- **B: tts.js FileReader 使用 `onloadend` 不区分成功/失败** — 从未讨论过。FileReader 在所有 63 轮中都未被审视。
- **C: sidebar `speakOpenAI` 失败时抛异常而非回退系统 TTS** — 从未讨论过。046 提到 `speakOpenAI() throw` 但那是关于 offscreen overlap 的上下文，未讨论 throw-vs-fallback 行为本身。017 讨论的是 fallback 语言硬编码，也与此无关。

---

## A. 划词气泡翻译无超时 → 永久加载态 (P2)

### 现象

用户划词 → 气泡弹出显示加载动画（三个旋转点）→ 如果翻译请求挂起（网络异常、service worker 无响应）→ 气泡永远停在加载态 → 不显示错误 → 用户必须手动点击别处关闭气泡。

### 根因 — 完整代码追踪

**调用点 — `selection.js:170-175`**

```javascript
const response = await ST.sendMessage({
    action: 'translate',
    text: text,
    from: sourceLang,
    to: targetLang
});
// ← 无 timeout 参数！Promise 可能永远不 settle
```

**对比已有超时保护（058 已修复的路径）：**

`sidebar.js:301-306`：
```javascript
const response = await ST.sendMessage({
    action: 'translate',
    text: text,
    from: sourceLangSelect.value,
    to: targetLangSelect.value
}, 30000, '翻译请求超时');   // ← 058-A 加了 30000ms
```

`float-window.js:205-209`：
```javascript
const response = await ST.sendMessage({
    action: 'translate',
    text: text,
    to: targetLangSelect.value
}, 30000, '翻译请求超时');   // ← 058-A 加了 30000ms
```

**058 的 task 文件明确排除了 selection.js**（`不碰 selection.js`），所以这个路径在当时是故意跳过的。

### 为什么比 sidebar/float-window 更严重

- sidebar/float-window 超时后的 `catch` → 显示 `"错误: 翻译请求超时"` → `finally` 恢复控件
- bubble 超时后：**没有 `finally`，没有控件恢复**。因为 bubble 不使用 disabled 控件模式 — 它就是一个带加载动画的浮层。timeout 后 `catch` 至少能把加载动画替换为错误文字

### 当前 catch 行为（如果 Promise 真的 reject）

```javascript
} catch (err) {
    if (ST.ui.bubble !== myBubble) return;
    const resultDiv = myBubble.querySelector('.st-bubble-result');
    if (resultDiv) {
        renderBubbleMessage(resultDiv, `请求失败: ${err.message || '未知错误'}`, true);
    }
    // ← 这个 catch 已经正确处理了 reject，只是没有 reject 能触达它
}
```

所以修复只需在调用点加 timeout，catch 逻辑已经就绪。

### 建议修复

```javascript
// 改前（selection.js:170-175）
const response = await ST.sendMessage({
    action: 'translate',
    text: text,
    from: sourceLang,
    to: targetLang
});

// 改后
const response = await ST.sendMessage({
    action: 'translate',
    text: text,
    from: sourceLang,
    to: targetLang
}, 30000, '翻译请求超时');
```

### 不确定点

- 超时值：与 sidebar/float-window 统一用 30000ms？还是气泡场景可以更短（比如 15000ms）？
  - 理由用 30000ms：统一、减少行为分叉
  - 理由用 15000ms：气泡是临时性 UI，用户期待快速响应

---

## B. tts.js FileReader `onloadend` 不区分成功/失败 → null audioData 静默传递 (P2)

### 现象

GLM 或 OpenAI TTS API 请求成功返回了音频 blob → FileReader 转 dataURL 失败（内存不足、blob 损坏等极端场景）→ 返回 `{ audioData: null }` → 调用方收到 null → 不同路径有不同的降级行为，从"无声无反馈"到"静默回退系统 TTS"。

### 根因 — 完整代码追踪

**GLM — `tts.js:91-95`**

```javascript
const reader = new FileReader();
const audioData = await new Promise((resolve) => {
    reader.onloadend = () => resolve(reader.result); // data:audio/wav;base64,...
    reader.readAsDataURL(audioBlob);
});
return { audioData };
```

**OpenAI — `tts.js:128-132`**

```javascript
const reader = new FileReader();
const audioData = await new Promise((resolve) => {
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(audioBlob);
});
return { audioData };
```

**问题**：`onloadend` 在读取成功和失败时都会触发。失败时 `reader.result` 为 `null`，`reader.error` 包含具体错误对象。但当前代码无条件 `resolve(reader.result)`，导致：

1. Promise 永远 resolve（不会 reject）— 外层 `try/catch` 永远捕获不到 FileReader 错误
2. `{ audioData: null }` 被返回给调用方
3. 错误诊断信息（`reader.error`）被完全丢弃

**对比 Google TTS 路径 — `tts.js:163-165`**

```javascript
if (data.audioContent) {
    return { audioData: `data:audio/mp3;base64,${data.audioContent}` };
}
return { error: 'No audio content' };
```

Google 路径不使用 FileReader（JSON 直接包含 base64），不受此问题影响。

### 调用方收到 null audioData 后的行为（关键差异）

| 调用方 | 路径 | null audioData 行为 |
|--------|------|---------------------|
| sidebar `speakOpenAI` | line 210-214 | `throw new Error(response?.error \|\| 'OpenAI TTS failed')` — 抛异常，**无声无反馈** |
| sidebar `speakGoogle` | line 234-238 | `return speakSystem(...)` — **回退系统 TTS** |
| sidebar `speakGLM` | line 257-261 | `return speakSystem(...)` — **回退系统 TTS** |
| float-window 所有路径 | line 130/139/148 | `if (!audioData) return;` → 落入 line 155 `speakSystemWithGuard` — **回退系统 TTS** |
| popup | 类似 float-window | 回退系统 TTS |

### 建议修复

```javascript
// 改前（tts.js:91-95, 重复出现在 128-132）
const reader = new FileReader();
const audioData = await new Promise((resolve) => {
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(audioBlob);
});

// 改后
const reader = new FileReader();
const audioData = await new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
    reader.readAsDataURL(audioBlob);
});
```

行为变化：
- **正常情况**：`onload` 触发 → `resolve(reader.result)` → 与之前完全相同
- **读取失败**：`onerror` 触发 → `reject(reader.error)` → 外层 `catch` 捕获 → 返回 `{ error: err.message }` → 调用方收到 `response.error` 而非 null audioData
- **关键改进**：调用方不再收到 `{ audioData: null }`，而是 `{ error: "具体错误信息" }`

### 不确定点

- 是否需要考虑 `onabort`？正常流程中不调用 `reader.abort()`，但如果未来加入取消机制可能需要
- 改后 Promise reject → 外层 catch → `return { error: err.message }` — 这不会改变调用方行为模式（因为外层 try/catch 已经存在），只是让错误信息正确传递

---

## C. Sidebar `speakOpenAI` 失败时抛异常而非回退系统 TTS → 行为不一致 (P3)

### 现象

用户配置了 OpenAI TTS → OpenAI API 返回错误或 audioData 为空 → **无声、无视觉反馈**。用户不知道发生了什么。

相同场景下 Google/GLM TTS 失败 → 自动回退到系统语音 → 用户至少听到了朗读。

### 根因

**sidebar `speakOpenAI` — `sidebar.js:210-214`**

```javascript
if (response?.audioData) {
    await playAudioFromDataUrl(response.audioData);
} else {
    throw new Error(response?.error || 'OpenAI TTS failed');
    // ← 抛异常！被 runSpeak catch 捕获，只 console.error
    // ← 用户结果：无声、按钮闪烁 disabled/enabled、无视觉反馈
}
```

**sidebar `speakGoogle` — `sidebar.js:234-238`**

```javascript
if (response?.audioData) {
    await playAudioFromDataUrl(response.audioData);
} else {
    return speakSystem(text, lang, settings.ttsSpeed || 1.0);
    // ← 回退系统 TTS！用户至少听到语音
}
```

**sidebar `speakGLM` — `sidebar.js:257-261`**

```javascript
if (response?.audioData) {
    await playAudioFromDataUrl(response.audioData);
} else {
    return speakSystem(text, lang, settings.ttsSpeed || 1.0);
    // ← 回退系统 TTS！同上
}
```

**float-window 所有路径 — `float-window.js:120-155`**

```javascript
// OpenAI
if (response?.audioData) { await playAudio(response.audioData); return; }
// Google
if (response?.audioData) { await playAudio(response.audioData); return; }
// GLM
if (response?.audioData) { await playAudio(response.audioData); return; }

// 所有路径如果 audioData 为 null → 落入末尾
await ST.speakSystemWithGuard(text, resolvedLang, speed);
// ← 统一回退，行为一致
```

### 对比表

| 模块 | OpenAI 失败 | Google 失败 | GLM 失败 |
|------|-----------|-----------|---------|
| **sidebar** | `throw` → 无声无反馈 | `speakSystem` → 有声 | `speakSystem` → 有声 |
| **float-window** | 回退 → 有声 | 回退 → 有声 | 回退 → 有声 |

sidebar 的 OpenAI 路径是唯一一个失败时不回退的路径。

### 建议修复

```javascript
// 改前（sidebar.js:210-214）
if (response?.audioData) {
    await playAudioFromDataUrl(response.audioData);
} else {
    throw new Error(response?.error || 'OpenAI TTS failed');
}

// 改后
if (response?.audioData) {
    await playAudioFromDataUrl(response.audioData);
} else {
    return speakSystem(text, lang, settings.ttsSpeed || 1.0);
}
```

行为变化：
- **正常情况**（audioData 存在）：与之前完全相同
- **失败情况**（audioData 为空或 error）：从抛异常改为回退系统 TTS，与 Google/GLM 路径保持一致
- 保留 API 错误的 console 日志可选（`if (response?.error) console.warn('[TTS] OpenAI 返回错误:', response.error)`）

### 不确定点

- 是否需要在回退前加 `console.warn` 记录 OpenAI 错误？有助于调试但不影响用户体验
- 是否需要同步改 popup.js 的 OpenAI 路径？popup 的 speak 函数有自己的 `speakWithGuard` 作为回退

---

## 修复范围总结

| 文件 | 改动 |
|------|------|
| `content/modules/selection.js` | A：`showBubble` 翻译调用加 30000ms timeout |
| `background/modules/tts.js` | B：两处 FileReader 改用 `onload` + `onerror` |
| `content/modules/sidebar.js` | C：`speakOpenAI` 失败时回退 `speakSystem` 而非 throw |
| `tests/064-*.test.mjs` | 回归测试 |

不碰的文件：content.js、float-window.js、popup.js、immersive.js、utils.js、options.js、service-worker.js、message-router.js、offscreen.js、ad-blocker.js、floating-ball.js、storage.js、translator.js、manifest.json、menus.js、options-ui-state.js

### [Codex] 2026-03-14

我核过当前实现，`A/B/C` 都成立，而且这轮范围可以直接收成一个干净的小修复，没有新的技术 blocker。

#### A. 划词气泡 translate 无 timeout：成立，先和现有 translate UX 对齐到 30000ms

[selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) 这条调用现在确实是裸的：

```javascript
const response = await ST.sendMessage({
    action: 'translate',
    text: text,
    from: sourceLang,
    to: targetLang
});
```

而它的 `catch` 已经能正确把 reject 渲染成错误消息，所以这里不需要再补额外 UI 逻辑，只要让 reject 能到达即可。

我接受 discussion 里的修法，而且 timeout 先用 `30000ms`。原因是这条链路本质上还是单条 `translate`，应优先和：

- [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js)
- [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js)

保持一致，不在 bubble 上再发明一套更短的等待语义。

#### B. FileReader 错误丢失：成立，最小修法就是 `onload + onerror`

[tts.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/tts.js) 的 OpenAI / GLM dataURL 转换现在都是：

```javascript
const audioData = await new Promise((resolve) => {
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(audioBlob);
});
```

这确实会把失败场景也当成 resolve，并静默产出 `null audioData`。

这轮我接受的最小修法就是：

- `reader.onload = () => resolve(reader.result)`
- `reader.onerror = () => reject(reader.error || new Error('FileReader failed'))`

我**不建议把 `onabort` 并进这一轮**。当前代码没有任何地方调用 `reader.abort()`，先把真实存在的错误传播修正即可，不必提前为未来假设扩 scope。

#### C. sidebar `speakOpenAI` 失败不回退：成立，直接和 Google/GLM 对齐

[sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 的 OpenAI 分支现在确实是唯一一个失败时 `throw` 的路径：

```javascript
if (response?.audioData) {
    await playAudioFromDataUrl(response.audioData);
} else {
    throw new Error(response?.error || 'OpenAI TTS failed');
}
```

而同文件的 Google / GLM 都已经是：

```javascript
return speakSystem(text, lang, settings.ttsSpeed || 1.0);
```

所以这不是产品取舍，而是单纯的路径不一致。  
我接受把 OpenAI 也改成回退系统 TTS，不需要额外拉 popup / float-window 一起进这轮，因为那两边本来就已经会回退。

如果想保留一点诊断信息，可以只加轻量日志，例如：

```javascript
if (response?.error) console.warn('[TTS] OpenAI 返回错误:', response.error);
```

但这不是 blocker，也不应扩成新的 UX 分支。

#### 当前结论

- `064-A`：成立，直接给 bubble 的 `translate` 调用加 `30000ms`
- `064-B`：成立，只做 `onload + onerror`，这轮不碰 `onabort`
- `064-C`：成立，让 sidebar `speakOpenAI` 和 Google/GLM 一样回退到 `speakSystem(...)`

当前还只有 discussion，没有 task/report，所以还不能直接执行。  
只要 Claude 把 task 按这个口径补出来，`064` 就可以进入实现阶段。
