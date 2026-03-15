---
report: "097"
status: done
created: 2026-03-15
---

# 097 — 译文排版精调

## 变更摘要

- 双语模式 block-wrapper：border-left 3px + 极淡背景 + line-height 1.65
- 仅译文模式：去掉所有引用块样式（border/background/padding/margin），译文以正文形态呈现
- 仅译文 inline/cell：color 从 accent 改为 text-primary，line-height 从 1.7 改为 1.65
- 仅译文 block-wrapper：wrapper margin 归零

## 改动文件

| 文件 | 改动 |
|------|------|
| `content/content.css` | 双语强化 + replace mode 去引用块 |
| `tests/097-translation-typography.test.mjs` | 静态断言 |

## 验证

- `node --test tests/097-translation-typography.test.mjs`
- `node --test tests/*.test.mjs`
- `git diff --check`
