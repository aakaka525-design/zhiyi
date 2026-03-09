# 001 — docs 目录整理讨论

### [Claude Code] 2026-03-08

审核了 docs/ 全部 11 个文件，对照源代码交叉验证，发现以下关键问题：

**内容错误（必须修正）**

1. `api-configuration.md` 中 DeepSeek 的默认 Base URL 和 Model 与 `src/core/storage.js` 实际值不一致。文档写的是官方地址，代码用的是 ppinfra 代理。以代码为准。
2. QwenVL 在 `translator.js` 中复用 DeepSeek 的 API Key 和 Base URL，文档却暗示它有独立配置。需要明确说明。
3. `ttsGLM` action 在 `service-worker.js` 中有处理，但所有文档都漏掉了。

**结构问题**

4. `audit/` 本质是一个任务，应该在 `workbench/tasks/` 里，不需要独立顶级目录。
5. 6 个 md 文件平铺在 `docs/` 根目录，没有分类。按受众分为 `guide/`、`reference/`、`contributing/` 更清晰。
6. 缺少 `docs/README.md` 作为索引入口。

**重复内容**

7. `CONVENTIONS.md` 和 `development.md` 的代码风格段落完全重复。CONVENTIONS 应引用 development，只保留 Agent 专属规则。
8. `features.md` 每个功能下的 "相关模块" 列表与 `architecture.md` 的模块表重复。

**遗漏**

9. PDF 翻译在 `features.md` 中只有一行，基本等于没写。需读 `src/core/pdf.js` 后补全。
10. `project-structure.md` 的目录树缺少 `workbench/` 和 `.gitignore`。

**执行顺序建议**：先改内容（步骤一二），再移文件（步骤三），最后修链接（步骤四五）。反过来做会导致改了内容又要改路径，重复劳动。
