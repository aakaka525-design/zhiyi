---
report: "111"
status: done
created: 2026-03-16
---

# 111 — 划词翻译 mouseup 改为捕获阶段

## 变更摘要

`mouseup` 事件监听从冒泡阶段改为捕获阶段（`addEventListener` 第三个参数加 `true`）。修复页面脚本阻断冒泡导致划词翻译不触发的问题。`mousedown` / `dblclick` 不变。

## 改动文件

| 文件 | 改动 |
|------|------|
| `content/content.js` | 一行修改 |
| `tests/111-selection-capture.test.mjs` | 静态断言 |

## 验证

- `node --test tests/111-selection-capture.test.mjs`
- `node --test tests/*.test.mjs` → `369/369`
- `node --check content/content.js`
- `git diff --check`
