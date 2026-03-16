---
report: "109"
status: done
created: 2026-03-16
---

# 109 — GitHub 文件名/元数据排除

## 变更摘要

新增 `isGitHubMetadataContext` helper（5 个高置信选择器），在 GitHub 上排除文件树行、文件头、面包屑导航等元数据区域。三路径接线。不改 GENERIC_SELECTORS。

## 改动文件

| 文件 | 改动 |
|------|------|
| `content/modules/immersive.js` | helper + 接线 |
| `tests/109-github-selectors.test.mjs` | 静态断言 |
| `tests/068-immersive-td-th-injection.test.mjs` | block-wrapper harness 补最小 DOM 能力 |
| `tests/070-immersive-li-injection.test.mjs` | block-wrapper harness 补最小 DOM 能力 |
| `tests/075-cell-css-selector-coverage.test.mjs` | block-wrapper harness 补最小 DOM 能力 |
| `tests/103-smart-skip-code.test.mjs` | 放宽静态断言以接受 GitHub helper |
| `tests/addhistory-error-observer-exclude.test.mjs` | 放宽静态断言以接受 GitHub helper |

## 验证

- `node --test tests/109-github-selectors.test.mjs`
- `node --test tests/*.test.mjs` → `367/367`
- `node --check content/modules/immersive.js`
- `git diff --check`

## 未做

- `.Box-row`、`.commit-tease`、`.pagehead-actions`、`.branch-name`、`.tag-name`（待 DOM 证据）
