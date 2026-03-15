---
report: "095"
status: done
created: 2026-03-15
---

# 095 — 设置页全量自动保存

## 变更摘要

所有设置改为自动保存。Toggle/Select 走 `saveImmediateToggle`（立即 partial save），Text 走 `queueTextAutosave`（800ms debounce partial save）。两条路径完全独立，互不干扰。保存按钮改为 `flushTextAutosave` 入口。

## 改动文件

| 文件 | 改动 |
|------|------|
| `options/options.js` | autosave 管理 + bindDirtyTracking 改造 |
| `tests/095-options-autosave.test.mjs` | 新增测试 |

## 验证

- `node --test tests/095-options-autosave.test.mjs`
- `node --test tests/*.test.mjs`
- `node --check options/options.js`
- `git diff --check`

## 未做

- `saveSettings()` 保留不删（兜底）
- `beforeunload` 保留（best-effort flush）
