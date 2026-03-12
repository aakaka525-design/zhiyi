# 010 — LLM Provider Bug 修复与 Gemini Prompt 对齐报告

- 状态: done
- 对应任务: [tasks/010-llm-provider-fixes.md](../tasks/010-llm-provider-fixes.md)
- 来源讨论: [discussions/010-llm-provider-fixes.md](../discussions/010-llm-provider-fixes.md)
- 执行日期: 2026-03-12

## 结果概览

本轮按收敛后的范围完成了 `A1 + A2 + A3 + B2`：

- [gemini.js](/Users/xa/Desktop/projiect/zhiyi/src/core/gemini.js) 的 `translateBatch()` 现在带有与 `translate()` 完全一致的 `safetySettings`
- [gemini.js](/Users/xa/Desktop/projiect/zhiyi/src/core/gemini.js) 的单条 / 批量 prompt 都升级为与 OpenAI 质量标准对齐的详细翻译指令
- [openai.js](/Users/xa/Desktop/projiect/zhiyi/src/core/openai.js)、[gemini.js](/Users/xa/Desktop/projiect/zhiyi/src/core/gemini.js)、[deepseek.js](/Users/xa/Desktop/projiect/zhiyi/src/core/deepseek.js) 的 `updateConfig()` 都改成了 `!== undefined` 语义，支持把 API key / baseUrl / model 清空
- [deepseek.js](/Users/xa/Desktop/projiect/zhiyi/src/core/deepseek.js) 的 constructor 和 `updateConfig()` 都会去掉 `baseUrl` 尾部斜杠

本轮**没有**引入 `systemInstruction`，也**没有**修改 [translator.js](/Users/xa/Desktop/projiect/zhiyi/src/core/translator.js) 的 batch fallback 链。

## 已完成改动

### 10.1 Gemini batch 安全策略对齐

[gemini.js](/Users/xa/Desktop/projiect/zhiyi/src/core/gemini.js) 现在将以下 `safetySettings` 同时用于 `translate()` 和 `translateBatch()`：

- `HARM_CATEGORY_HARASSMENT`
- `HARM_CATEGORY_HATE_SPEECH`
- `HARM_CATEGORY_SEXUALLY_EXPLICIT`
- `HARM_CATEGORY_DANGEROUS_CONTENT`

阈值都保持 `BLOCK_NONE`，与单条翻译现有行为一致。

### 10.2 provider 配置清空语义修复

三个 provider 的 `updateConfig()` 现在都使用“仅当参数为 `undefined` 时保留旧值”的规则，而不是 `||`：

- [gemini.js](/Users/xa/Desktop/projiect/zhiyi/src/core/gemini.js)
- [openai.js](/Users/xa/Desktop/projiect/zhiyi/src/core/openai.js)
- [deepseek.js](/Users/xa/Desktop/projiect/zhiyi/src/core/deepseek.js)

这解决了“用户清空设置页中的 key/model/baseUrl，但旧值继续生效直到重启”的问题。

### 10.3 DeepSeek baseUrl 归一化

[deepseek.js](/Users/xa/Desktop/projiect/zhiyi/src/core/deepseek.js) 现在和 OpenAI provider 一样，对 `baseUrl` 做 `.replace(/\/$/, '')` 处理，避免拼接 `/v1/chat/completions` 时出现双斜杠。

### 10.4 Gemini prompt 对齐 OpenAI 质量要求

[gemini.js](/Users/xa/Desktop/projiect/zhiyi/src/core/gemini.js) 的 prompt 现在补齐了以下质量要求：

- 保持原文语气和风格
- 专业术语使用标准译法
- 专有名词保留原文并在适用时补译名
- 仅输出翻译结果，不添加解释

批量翻译 prompt 也同步增加了这些要求，同时保留原有的 `[编号]` 输入/输出格式约束。

## TDD 记录

本轮按 test-first 执行：

1. 先新增 [provider-translators.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/provider-translators.test.mjs)
2. 运行 `node --test tests/provider-translators.test.mjs`
3. 首次失败覆盖了 7 个点：
   - Gemini `translateBatch()` 缺少 `safetySettings`
   - Gemini 单条 prompt 过于简单
   - Gemini 批量 prompt 过于简单
   - Gemini `updateConfig()` 不能清空
   - OpenAI `updateConfig()` 不能清空
   - DeepSeek constructor 不去尾斜杠
   - DeepSeek `updateConfig()` 不能清空且不归一化 `baseUrl`
4. 随后补最小实现
5. provider 测试转绿，再回跑全量测试

## 验证

实际跑过的验证命令：

```bash
node --test tests/provider-translators.test.mjs
node --test tests/*.test.mjs
node --check src/core/gemini.js
node --check src/core/openai.js
node --check src/core/deepseek.js
git diff --check
```

验证结果：

- [provider-translators.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/provider-translators.test.mjs)：7/7 通过
- `node --test tests/*.test.mjs`：42/42 通过
- [gemini.js](/Users/xa/Desktop/projiect/zhiyi/src/core/gemini.js) `node --check` 通过
- [openai.js](/Users/xa/Desktop/projiect/zhiyi/src/core/openai.js) `node --check` 通过
- [deepseek.js](/Users/xa/Desktop/projiect/zhiyi/src/core/deepseek.js) `node --check` 通过
- `git diff --check` 无输出

## 未做项

- 没有引入 `systemInstruction`
- 没有修复 `Translator.translateBatch()` / `GeminiTranslator.translateBatch()` 的 batch fallback 链缺口
- 没有提取 `langNames` 公共模块
- 没有加 `fetch` 超时
- 没有改 DeepSeek 默认 model
- 没有处理 [docs/google-apis-catalog.md](/Users/xa/Desktop/projiect/zhiyi/docs/google-apis-catalog.md)
