---
report: "108"
status: done
created: 2026-03-16
---

# 108 — 翻译块继承原文链接

## 变更摘要

新增 `wrapTranslationWithLink` helper。单链接容器（恰好 1 个 `a[href]`，非链接文本只剩分隔符）的翻译块被包裹在同 `href/target/rel/download` 的 `<a>` 中。**仅 block-wrapper 路径**使用。cell-internal / inline 标注 residual risk（cell-internal 会破坏 own-artifact helper 语义）。

## 改动文件

| 文件 | 改动 |
|------|------|
| `content/modules/immersive.js` | helper + 两路径接入 |
| `content/content.css` | 链接样式 |
| `tests/108-translation-link.test.mjs` | 回归测试 |

## Residual risk

- cell-internal 路径未处理（会破坏 own-artifact helper 语义）
- inline 路径未处理（flex/grid 布局风险）

## 验证

- `node --test tests/108-translation-link.test.mjs`：`3/3`
- `node --test tests/*.test.mjs`：通过
- `node --check content/modules/immersive.js tests/108-translation-link.test.mjs`：通过
- `git diff --check`：无输出
