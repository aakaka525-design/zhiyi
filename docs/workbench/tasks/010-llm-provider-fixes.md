---
status: done
priority: P1
created: 2026-03-12
---

# 010 — LLM Provider Bug 修复与 Gemini Prompt 对齐

- 来源讨论: [discussions/010-llm-provider-fixes.md](../discussions/010-llm-provider-fixes.md)

## 背景

对三个 LLM 翻译 provider（Gemini、OpenAI、DeepSeek）的代码审查发现了 3 个 bug 和 1 个质量问题。详见讨论文件。

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/010-llm-provider-fixes.md](../discussions/010-llm-provider-fixes.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|---------|
| `src/core/gemini.js` | A1 + B2 |
| `src/core/openai.js` | A2 |
| `src/core/deepseek.js` | A2 + A3 |

## 任务清单

### A1. Gemini `translateBatch` 补 `safetySettings`

- [x] 在 `gemini.js` 的 `translateBatch()` 请求 body 中加入与 `translate()` 相同的 `safetySettings` 数组
- [x] 验证：两个方法的 `safetySettings` 完全一致

参考 `translate()` 中的写法（`gemini.js:64-69`）：
```javascript
safetySettings: [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
],
```

### A2. 三个 provider 的 `updateConfig` 修复空值判断

- [x] `gemini.js` — `updateConfig(apiKey, model)` 改为：
  ```javascript
  this.apiKey = apiKey !== undefined ? apiKey : this.apiKey;
  this.model = model !== undefined ? model : this.model;
  ```
- [x] `openai.js` — `updateConfig(apiKey, baseUrl, model)` 同理，三个参数都改
- [x] `deepseek.js` — `updateConfig(apiKey, baseUrl, model)` 同理，三个参数都改

当前写法 `this.apiKey = apiKey || this.apiKey` 导致空字符串 `''` 无法清空旧值。

### A3. DeepSeek `baseUrl` 去尾部斜杠

- [x] `deepseek.js` — constructor 和 `updateConfig` 中对 `baseUrl` 做 `.replace(/\/$/, '')` 处理
- [x] 对齐 `openai.js` 的处理方式

### B2. Gemini prompt 对齐 OpenAI 质量标准

- [x] 在 `gemini.js` 的 `translate()` 中，将当前简单 prompt 替换为与 OpenAI 等效的详细翻译指令

当前 Gemini prompt（`gemini.js:44-46`）：
```
请将以下文本翻译成${targetLang}，只输出翻译结果，不要任何解释：\n\n${text}
```

OpenAI 的 system prompt 参考（`openai.js:45-50`）：
```
你是一个专业的翻译助手。请将用户输入的文本翻译成${targetLang}。
要求：
1. 只输出翻译结果，不要添加任何解释或额外内容
2. 保持原文的语气和风格
3. 对于专业术语，使用该领域的标准译法
4. 对于人名、地名等专有名词，保留原文并在括号内注明译名（如适用）
```

**注意**：不引入 `systemInstruction`，在现有单 prompt 结构内改进。`translate()` 和 `translateBatch()` 的 prompt 都需要对齐。

## 不做的事

- **不做 B1**（`systemInstruction`）— 在 `translateBatch` fallback 链修复前，硬切 `systemInstruction` 会在 batch 路径留下静默空结果风险
- **不做 B3**（`langNames` 提取）— 留给后续清理轮次
- **不做 C1**（fetch 超时）— 跨 provider 基础设施，留给后续
- **不做 C2**（DeepSeek 默认 model）— 产品决策，不在此轮处理
- **不碰** `translator.js` — 010 只改 provider 层代码
- **不碰** `docs/google-apis-catalog.md` — 与 010 无关，需单独处理

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过（确认无回归）
- [x] `node --check src/core/gemini.js` 通过
- [x] `node --check src/core/openai.js` 通过
- [x] `node --check src/core/deepseek.js` 通过
- [x] `git diff --check` 无输出

## 后续任务（010 结束后需创建）

- `translateBatch` fallback 链缺口修复（`translator.js` + 可能的 B1 `systemInstruction`）
- `docs/google-apis-catalog.md` 的脱敏/移出仓库处理（单独任务）
