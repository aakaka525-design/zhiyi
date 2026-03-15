---
report: "090"
status: done
created: 2026-03-15
---

# 090 — 划词翻译同语言过滤

## 变更摘要

`showBubble()` 顶部添加 `sourceLang === targetLang` 守卫。同语言时直接 return，不创建气泡、不发请求、不写历史。

## 改动文件

| 文件 | 改动 |
|------|------|
| `content/modules/selection.js` | 同语言守卫 |
| `tests/090-selection-same-language.test.mjs` | 回归测试 |

## 验证

- `/opt/homebrew/bin/node --test tests/090-selection-same-language.test.mjs`：`3/3`
- `/opt/homebrew/bin/node --test tests/*.test.mjs`：`317/317`
- `/opt/homebrew/bin/node --check content/modules/selection.js`
- `git diff --check`

## 未做

- 请求取消 / AbortController（留后续）
