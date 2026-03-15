---
report: "088"
status: done
created: 2026-03-15
---

# 088 — `detectLanguage` 语言检测算法修复

## 变更摘要

- `charCodeAt(0)` → `codePointAt(0)`（正确处理 BMP 外字符）
- CJK 范围扩展：Extension A + Compatibility Ideographs + Extension B
- 日语检测从 `> 0`（单字触发）改为 `> 0.2`（严格大于 20% 比例门槛）

## 改动文件

| 文件 | 改动 |
|------|------|
| `content/modules/utils.js` | `detectLanguage` 三修 |
| `tests/088-detectlanguage.test.mjs` | 回归测试 |

## 验证

- `/opt/homebrew/bin/node --test tests/088-detectlanguage.test.mjs`：`4/4`
- `/opt/homebrew/bin/node --test tests/*.test.mjs`：`314/314`
- `/opt/homebrew/bin/node --check content/modules/utils.js`
- `git diff --check`
