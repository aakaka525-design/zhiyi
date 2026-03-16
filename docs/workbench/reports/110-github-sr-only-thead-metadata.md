---
report: "110"
status: done
created: 2026-03-16
---

# 110 — GitHub sr-only 标题和表格头排除

## 变更摘要

通用 `EXCLUDE_SELECTORS` 加 `.sr-only`（所有网站的 sr-only 元素不再翻译）。GitHub `GITHUB_METADATA_ANCESTORS` 加 `[aria-labelledby="folders-and-files"]`（文件表格整体排除）。

## 改动文件

| 文件 | 改动 |
|------|------|
| `content/modules/immersive.js` | 两处选择器 |
| `tests/110-github-sr-only-thead.test.mjs` | 静态断言 |

## 验证

- `node --test tests/110-github-sr-only-thead.test.mjs tests/109-github-selectors.test.mjs`
- `node --test tests/*.test.mjs` → `368/368`
- `node --check content/modules/immersive.js`
- `git diff --check`
