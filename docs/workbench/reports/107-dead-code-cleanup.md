---
report: "107"
status: done
created: 2026-03-16
---

# 107 — 死代码清理：删除 `fontSize` 死设置

## 变更摘要

从 `DEFAULT_SETTINGS`（storage.js）和 `mergeDefaults`（content.js）中删除从未被使用的 `fontSize: 14`。

## 改动文件

| 文件 | 改动 |
|------|------|
| `src/core/storage.js` | 删除 `fontSize` |
| `content/content.js` | 删除 `fontSize` |

## 未做

- `debugMode` — 需产品决策
- `updateSettings` 路由 — 兼容契约
- `pdf.js` — 已有保留决策

## 验证

- `node --test tests/107-dead-code-cleanup.test.mjs`：通过
- `node --test tests/*.test.mjs`：`363/363` 通过
- `node --check src/core/storage.js content/content.js`：通过
- `git diff --check`：无输出
