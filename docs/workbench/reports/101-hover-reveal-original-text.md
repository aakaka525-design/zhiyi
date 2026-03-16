---
report: "101"
status: done
created: 2026-03-15
---

# 101 — block-wrapper hover reveal 原型

## 变更摘要

替换模式 block-wrapper 隐藏方式从 `position: absolute + clip-path`（不可动画）改为 `opacity: 0 + max-height: 0`（可动画）。通过 `:has(+ .st-immersive-wrapper:hover)` 实现悬停时原文淡入。inline/cell 不动。

## 改动文件

| 文件 | 改动 |
|------|------|
| `content/content.css` | block-wrapper hover reveal |
| `tests/101-hover-reveal.test.mjs` | 静态断言 |
| `tests/087-replace-bilingual-mode.test.mjs` | 旧 replace-mode 基线同步到 101 合法结构 |

## 验证

- `node --test tests/101-hover-reveal.test.mjs`：`3/3`
- `node --test tests/*.test.mjs`：`349/349`
- `git diff --check`：无输出
