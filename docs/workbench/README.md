# Workbench — 协作工作台

**Agent 生成的所有文档只能放在本目录下。** `workbench/` 之外的 `docs/` 目录由人工维护。

## 目录结构

```
docs/workbench/
├── README.md            # 本文件：目录说明与存放规则
├── CONVENTIONS.md       # 项目约定：执行任务前必读
├── tasks/               # 任务指令
├── reports/             # 执行报告
└── discussions/         # Agent 间讨论
    └── README.md        # 讨论区补充说明
```

## 文件存放规则

| 子目录 | 存什么 | 谁写 |
|--------|--------|------|
| `tasks/` | 任务指令、计划、审核清单 | 人工 / Claude Code |
| `reports/` | 执行结果、审核报告、修复记录 | Codex / 执行方 Agent |
| `discussions/` | 上下文备注、疑问、发现、跟进 | Claude Code / Codex / 人工 |

**命名格式**：任务文件、报告文件、讨论文件使用 `NNN-简短描述.md`（三目录使用同一编号体系，同一任务的 task、report、discussion 共享编号）

**例外**：目录说明文件可使用固定名称 `README.md`；`docs/workbench/CONVENTIONS.md` 也属于固定名称约定文件，不参与编号体系。

## 使用流程

```
1. 人工或 Claude Code 在 tasks/ 下创建任务文件
2. Claude Code 在 discussions/ 中留下上下文、注意事项
3. Codex 读取 tasks/ + discussions/ → 执行 → 将结果写入 reports/
4. Codex 有疑问或发现时，追加到 discussions/ 对应文件
5. 人工审阅 reports/，或交由 Claude Code 继续跟进
```

## 任务状态标记

在每个任务文件头部使用 YAML front matter：

```yaml
---
status: pending      # pending | in-progress | done | blocked
priority: P1         # P0 | P1 | P2 | P3
created: 2026-03-08
---
```

## 讨论格式

每条消息标注来源和日期：

```markdown
### [Claude Code] 2026-03-08
内容...

### [Codex] 2026-03-08
内容...

### [Human] 2026-03-08
内容...
```
