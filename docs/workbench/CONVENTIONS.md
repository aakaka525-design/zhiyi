# 项目约定（执行任务前必读）

执行任何任务前，先阅读本文件了解项目上下文。

## 项目概况

- **项目名**: 智译 - Smart Translator
- **类型**: Chrome 扩展 (Manifest V3)
- **功能**: 划词翻译、沉浸式翻译、TTS、广告拦截
- **前端**: JavaScript ES6 Modules（无构建工具，无 TypeScript）
- **后台**: Chrome Service Worker + Offscreen Document
- **存储**: Chrome Storage API

## 关键路径速查表

| 作用 | 路径 |
|------|------|
| 扩展清单 | `manifest.json` |
| 弹窗 | `popup/popup.js` |
| 设置页 | `options/options.js` |
| Service Worker | `background/service-worker.js` |
| 内容脚本入口 | `content/content.js` |
| 内容脚本模块 | `content/modules/*.js` |
| 翻译引擎 | `src/core/*.js` |
| 文档索引 | `docs/README.md` |
| 架构设计 | `docs/reference/architecture.md` |

## 代码风格

详见 [开发指南](../contributing/development.md#代码风格)。

## 文档存放规则（强制）

Agent 生成的任何文档 **只能** 放在 `docs/workbench/` 下对应的子目录中：

| 你要写的内容 | 放在哪里 | 命名格式 |
|-------------|---------|---------|
| 任务指令、计划 | `workbench/tasks/` | `NNN-描述.md` |
| 执行报告、审核结果 | `workbench/reports/` | `NNN-描述.md`（与 tasks 同编号） |
| 讨论、疑问、备注 | `workbench/discussions/` | `NNN-描述.md`（与 tasks 同编号） |

**禁止 Agent 在以下位置创建或修改文档**（除非任务明确要求）：

- `docs/guide/` — 用户指南，人工维护
- `docs/reference/` — 技术参考，人工维护
- `docs/contributing/` — 开发指南，人工维护
- `docs/README.md` — 文档索引，人工维护
- 项目根目录 `README.md` — 项目首页，人工维护

> 简单记：**workbench 是 Agent 的地盘，workbench 之外是人的地盘。**

## 执行原则

1. **只改需要改的** — 不做超出任务范围的重构
2. **保留原有风格** — 不引入新的格式化、命名或架构约定
3. **先读后改** — 修改任何文件前先完整阅读
4. **安全优先** — 涉及 API 密钥、用户数据的修改需特别谨慎
5. **写明位置** — 报告中引用代码时标注 `文件路径:行号`
6. **文档归位** — 生成的文档只放 `workbench/` 内，不在其他 docs 目录下创建文件

## 不要做的事

- 不要在 `docs/workbench/` 之外创建 `.md` 文件
- 不要修改 `.gitignore`、`manifest.json` 除非任务明确要求
- 不要引入新依赖（npm/pip）除非任务明确要求
- 不要删除功能代码，除非任务是清理/移除
- 不要改动 `config.txt`（含真实密钥）
