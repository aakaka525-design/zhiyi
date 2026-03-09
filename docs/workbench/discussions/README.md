# Discussions — Agent 间协作讨论区

本目录用于 Claude Code 与 Codex（或其他 Agent）之间的异步沟通。

## 用途

- Claude Code 留下任务上下文、设计决策、注意事项
- Codex 执行时记录疑问、发现、需要确认的事项
- 人工可随时查阅和介入

## 文件命名

```
NNN-主题.md
```

与 `tasks/` 编号对应。例如任务 `tasks/003-full-audit.md` 对应讨论 `discussions/003-full-audit.md`。

通用讨论不绑定具体任务时，使用 `000-` 前缀。

本文件是目录说明，属于固定名称 `README.md` 例外，不参与编号体系。

## 书写格式

每条消息标注来源和日期：

```markdown
### [Claude Code] 2026-03-08
内容...

### [Codex] 2026-03-08
内容...

### [Human] 2026-03-08
内容...
```
