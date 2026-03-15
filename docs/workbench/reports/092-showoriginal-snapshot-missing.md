---
report: "092"
status: done
created: 2026-03-15
---

# 092 — showOriginal 设置无法保存

## 变更摘要

`options-ui-state.js` 的 `buildSettingsSnapshot` 补 `showOriginal: settings.showOriginal !== false`。修复 087 的 dirty tracking 和设置持久化 bug。

## 改动文件

| 文件 | 改动 |
|------|------|
| `options/options-ui-state.js` | 一行修复 |
| `tests/options-ui-state.test.mjs` | 回归测试 |

## 验证

- `/opt/homebrew/bin/node --test tests/options-ui-state.test.mjs`：`8/8`
- `/opt/homebrew/bin/node --test tests/*.test.mjs`：`319/319`
- `/opt/homebrew/bin/node --check options/options-ui-state.js`
- `git diff --check`
