---
report: "103"
status: done
created: 2026-03-16
---

# 103 — 智能跳过：代码块 / translate="no"

## 变更摘要

`EXCLUDE_SELECTORS` 扩展 `pre, code, kbd, samp, var, [translate="no"], [role="code"], .highlight`。新增 `containsHardProtectedContent` helper 跳过包含 `pre / [translate="no"] / [role="code"] / .highlight` 子内容的容器。三条过滤链同步接线。

不做行内 code 保护（后续 placeholder 设计）。

## 改动文件

| 文件 | 改动 |
|------|------|
| `content/modules/immersive.js` | EXCLUDE_SELECTORS + helper + 接线 |
| `tests/103-smart-skip-code.test.mjs` | 回归测试 |

## 验证

- `node --test tests/103-smart-skip-code.test.mjs`
- `node --test tests/addhistory-error-observer-exclude.test.mjs tests/103-smart-skip-code.test.mjs`
- `node --test tests/*.test.mjs`
- `node --check content/modules/immersive.js`
- `git diff --check`
