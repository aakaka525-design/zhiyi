---
status: done
priority: P2
created: 2026-03-13
discussion: 036-sw-init-race-and-batch-fallback
prior-art: 010-llm-provider-fixes
---

# 037 — `Translator.translateBatch()` Google/offline 回退链补齐

## 背景

010 讨论首次识别 `translateBatch` fallback 缺口并挂为后续 backlog。014、015、016 均标注"不做 — 架构任务"。036 讨论补足了完整代码证据和两类失败场景分析，Codex 复核确认。

**当前状态**：
- `translate()` 有 provider → Google → offline 三级回退
- `translateBatch()` 的 batch 路径在 `Translator` 层直接调用 `provider.translateBatch()`，无 try/catch
- provider 自身有 catch（openai.js:164, gemini.js:197），catch 后逐条调用 `this.translate()` 重试，失败返回 `''`
- 但 provider 层的逐条 retry 不会上升到 `Translator.translate()` 的 Google/offline 回退链

**两类失败**：
1. **缺 key**：`!this.apiKey` 在 try 前 throw → 直接冒到 immersive.js，整批失败
2. **HTTP/网络错误**：provider catch → provider 逐条 retry → 失败返回 `''` → 不走 Google/offline

---

## 任务 A：`Translator.translateBatch()` batch 路径加 try/catch 回退

**文件**：`src/core/translator.js:140-158`

**当前**：

```javascript
async translateBatch(texts, from = 'auto', to = 'zh') {
    const provider = this.settings?.provider || 'google';

    if (provider === 'openai' || provider === 'gemini') {
        const translator = this.providers[provider];
        if (translator.translateBatch) {
            return translator.translateBatch(texts, from, to);  // 无 catch，直接返回
        }
    }

    // 逐条翻译（有 translate() 内置 fallback）
    const results = [];
    for (const text of texts) {
        const result = await this.translate(text, from, to);
        results.push(result.text);
    }
    return results;
}
```

**修复**：

```javascript
async translateBatch(texts, from = 'auto', to = 'zh') {
    const provider = this.settings?.provider || 'google';

    if (provider === 'openai' || provider === 'gemini') {
        const translator = this.providers[provider];
        if (translator.translateBatch) {
            try {
                return await translator.translateBatch(texts, from, to);
            } catch (error) {
                console.warn(`${provider} batch 翻译失败，回退到逐条翻译:`, error);
                // 落入下面的逐条翻译路径
            }
        }
    }

    // 逐条翻译（每条走 translate() 的 Google/offline fallback）
    const results = [];
    for (const text of texts) {
        try {
            const result = await this.translate(text, from, to);
            results.push(result.text);
        } catch (e) {
            results.push('');
        }
    }
    return results;
}
```

注意：
- 逐条路径也加了 per-item try/catch，避免一条失败中断整批
- `translate()` 内部已有 provider → Google → offline 回退链，逐条路径受益
- Provider 自身的 catch + retry 逻辑不需要修改（它们仍然是 provider 层面的优化）
- 缺 key 的 throw 也会被外层 catch 捕获，回退到逐条翻译

---

## 任务 B：补测试

**文件**：`tests/translator.test.mjs`（新建或追加）

### B1. batch 路径在 provider 失败时回退到逐条翻译

```javascript
// mock openai.translateBatch 抛错
// mock openai.translate 也抛错（模拟 provider 完全不可用）
// mock google.translate 成功
// 调用 translator.translateBatch(['hello', 'world'], 'en', 'zh')
// 断言结果来自 google（通过 translate() 的 fallback 链）
```

### B2. 缺 key 时不会整批直接失败

```javascript
// 设置 provider = 'openai', openaiApiKey = ''
// 调用 translator.translateBatch(['hello'], 'en', 'zh')
// 断言不抛错，结果来自 fallback 路径（Google 或 offline）
```

### B3. 逐条路径单条失败不中断其余

```javascript
// mock translate() 第 1 条成功、第 2 条抛错、第 3 条成功
// 调用 translator.translateBatch(['a', 'b', 'c'], 'en', 'zh')
// 断言结果 = ['翻译A', '', '翻译C']
```

---

## 不做的事

- 不改 `openai.translateBatch()` / `gemini.translateBatch()` 内部逻辑（provider 层 retry 保持不变）
- 不改 `translate()` 的 fallback 链
- 不碰 service-worker `ensureReady()`（独立 task 036）
- 不碰 immersive.js 的 batch 处理逻辑（034 已修复 errorCount）
- 不碰 content script / popup / options / CSS / TTS

---

## 验收标准

- [x] `translateBatch()` 的 batch 路径有 try/catch，失败时回退到逐条翻译
- [x] 逐条翻译路径有 per-item try/catch，单条失败返回 `''` 不中断其余
- [x] 测试覆盖 provider 失败回退到 Google
- [x] 测试覆盖缺 key 不整批失败
- [x] 测试覆盖逐条路径单条失败
- [x] 现有测试不受影响
