---
report: "089"
status: done
created: 2026-03-15
---

# 089 — 批量翻译失败元素视觉标记

## 变更摘要

三条批量翻译路径统一处理两类失败（catch/error 整批 + results falsy slot 单元素），给失败元素添加 `st-translate-failed` class。成功翻译时移除标记。关闭沉浸式翻译时清理。

不加 toast（observer/rescan），不做自动重试（rescan 自愈）。

## 改动文件

| 文件 | 改动 |
|------|------|
| `content/modules/immersive.js` | 三路径失败标记 + 清理 |
| `content/content.css` | `.st-translate-failed` 样式 |
| `tests/089-batch-failure-feedback.test.mjs` | 回归测试 |

## 验证

- `/opt/homebrew/bin/node --test tests/089-batch-failure-feedback.test.mjs`：`5/5`
- `/opt/homebrew/bin/node --test tests/*.test.mjs`：`314/314`
- `/opt/homebrew/bin/node --check content/modules/immersive.js`
- `git diff --check`
