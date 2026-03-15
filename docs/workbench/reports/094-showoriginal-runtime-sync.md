---
report: "094"
status: done
created: 2026-03-15
---

# 094 — showOriginal 运行中设置变更实时同步

## 变更摘要

`content.js` 的 `storage.onChanged` 监听器添加 `syncShowOriginalMode()` 调用，在沉浸式翻译运行中实时 toggle `body.st-replace-mode` class。

## 改动文件

| 文件 | 改动 |
|------|------|
| `content/content.js` | helper + onChanged 调用 |
| `tests/094-showoriginal-runtime-sync.test.mjs` | 新增测试 |
| `tests/content-darkmode-floatball-drag.test.mjs` | 旧测试基线同步 |
| `tests/058-translate-timeout-reactive-select.test.mjs` | 旧测试基线同步 |

## 验证

- `/opt/homebrew/bin/node --test tests/094-showoriginal-runtime-sync.test.mjs`
- `/opt/homebrew/bin/node --test tests/*.test.mjs`
- `/opt/homebrew/bin/node --check content/content.js`
- `git diff --check`
