---
status: done
priority: P2
created: 2026-03-13
discussion: 030-doc-completeness-audit
---

# 030 — reference 文档结构漂移修复 + 001 报告补写

## 背景

030 讨论经过 Codex 复核和 Claude 二次验证后收敛为 2 项成立的缺陷。本 task 要求修复这两项。

---

## 任务 A：修复 `docs/reference/project-structure.md` 结构漂移

当前文档与仓库实际状态存在以下偏差：

### A1. `background/modules/` 缺少 `message-router.js`

**当前文档（21-26 行）**：
```
├── background/
│   ├── service-worker.js
│   └── modules/
│       ├── tts.js
│       ├── menus.js
│       └── utils.js
```

**实际**：`background/modules/` 有 4 个文件：`tts.js`、`menus.js`、`utils.js`、`message-router.js`。

**修复**：在 `utils.js` 之前或之后加入 `message-router.js`，注释写 `# 消息路由分发`。

### A2. 模块计数错误（80-88 行）

**当前**：后台模块 3，合计 21。

**修复**：后台模块改为 4，合计改为 22。

### A3. 根目录 `config.txt` 应为 `config.example.txt`

**当前（6 行）**：
```
├── config.txt                   # 本地私有配置（不入库）
```

**实际**：仓库中入库的文件是 `config.example.txt`，`config.txt` 在 `.gitignore` 中。

**修复**：改为 `config.example.txt`，注释改为 `# 配置模板`。保留 `config.txt` 为注释说明或删除均可，因为它不入库。

### A4. 根目录缺少 `tests/`

**修复**：在目录树合适位置加入：
```
├── tests/                       # 测试
```

---

## 任务 B：修复 `docs/reference/architecture.md` 消息路由表

### B1. 消息 Action 清单缺少 `updateSettings`

**当前（52-63 行）**：表中列出 8 个 action，缺少 `updateSettings`。

**实际**（`background/modules/message-router.js:31-33`）：
```javascript
case 'updateSettings':
    await translator.refreshSettings();
    return { success: true };
```

**修复**：在 Action 清单表末尾加入：

| Action | 来源 | 目标模块 | 说明 |
|--------|------|----------|------|
| `updateSettings` | Options | `src/core/translator.js` | 刷新翻译引擎设置 |

### B2. 目标模块列补充 `message-router.js` 的角色（可选）

当前表中所有 action 的"目标模块"直接写 `tts.js` / `translator.js` / `storage.js`，没有体现 `message-router.js` 作为中间路由层的存在。

这不是错误——表的语义是"最终处理模块"。但如果认为有必要，可以在"通信机制"或"消息流"段落中补一句说明消息先经过 `message-router.js` 分发。

**由 Codex 判断是否需要补充**，不强制。

---

## 任务 C：补写 `reports/001-docs-cleanup.md`

`tasks/001-docs-cleanup.md` 已标 `status: done`，但没有对应的 report。

**要求**：

1. 阅读 `tasks/001-docs-cleanup.md` 了解任务内容
2. 通过 `git log` 查找 001 相关的提交记录
3. 基于实际完成的工作写一份简要 report，格式参照已有的 `reports/002-remove-ocr.md`
4. 如果无法从 git 历史中还原足够的执行细节，report 中标明"基于事后回溯"

---

## 不做的事

- 不动 `docs/guide/`、`docs/contributing/` 中的任何文件
- 不重编号 `006-performance-compat`（讨论已决定保留为历史 stub）
- 不扩展 `features.md` 的 PDF 部分或 `api-configuration.md` 的运维信息（后续增强项）
- 不碰代码文件

## 验收标准

- [x] `project-structure.md` 目录树包含 `message-router.js`、`config.example.txt`、`tests/`
- [x] `project-structure.md` 模块计数：后台 4，合计 22
- [x] `architecture.md` Action 清单包含 `updateSettings`
- [x] `reports/001-docs-cleanup.md` 存在且内容与 task 001 对应
