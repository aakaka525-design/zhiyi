---
report: "093"
status: done
created: 2026-03-15
---

# 093 — 设置页 immediate toggle 保存无反馈

## 变更摘要

`saveImmediateToggle` 添加 toast：成功 `已自动保存`，失败 `自动保存失败: ${err.message}`。所有 immediate toggle 统一获得反馈。

## 改动文件

| 文件 | 改动 |
|------|------|
| `options/options.js` | `saveImmediateToggle` 添加 toast |
| `tests/093-toggle-save-feedback.test.mjs` | 新增测试 |
| `tests/immersive-selection-options-toggle.test.mjs` | 旧测试基线同步 |
| `tests/059-storage-race-popup-timeout.test.mjs` | 旧测试基线同步 |

## 验证

- `/opt/homebrew/bin/node --test tests/093-toggle-save-feedback.test.mjs`：`2/2`
- `/opt/homebrew/bin/node --test tests/immersive-selection-options-toggle.test.mjs tests/059-storage-race-popup-timeout.test.mjs`：`4/4`
- `/opt/homebrew/bin/node --test tests/*.test.mjs`：`323/323`
- `/opt/homebrew/bin/node --check options/options.js`：通过
- `git diff --check`：通过
