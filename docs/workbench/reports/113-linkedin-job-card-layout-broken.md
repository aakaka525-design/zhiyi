---
report: "113"
status: done
created: 2026-03-16
---

# 113 — LinkedIn 职位卡排除

## 变更摘要

检测 LinkedIn 精确域名，新增 `isLinkedInMetadataContext` helper（`[data-job-id]`），排除职位卡内的 `<li>` 元数据。三路径接线。

## 改动文件

| 文件 | 改动 |
|------|------|
| `content/modules/immersive.js` | LinkedIn 检测 + helper + 接线 |
| `tests/113-linkedin-selectors.test.mjs` | 静态断言 |

## 验证

- `node --test tests/113-linkedin-selectors.test.mjs`
- `node --test tests/*.test.mjs`：`374/374`
- `node --check content/modules/immersive.js`
- `git diff --check`
