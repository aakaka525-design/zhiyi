---
report: "112"
status: done
created: 2026-03-16
---

# 112 — 翻译结果缓存

## 变更摘要

新增 run-scoped `translationCache`（`targetLang → sourceText → translation`）。翻译成功时即存缓存（不依赖注入成功）。三条路径统一 cache hit/miss 分流：命中直接注入不发请求不显示 loading，未命中走正常翻译流程。关闭时清空。

## 改动文件

| 文件 | 改动 |
|------|------|
| `content/modules/immersive.js` | 缓存 + 分流 + 清理 |
| `tests/112-translation-cache.test.mjs` | 回归测试 |

## 验证

- `node --test tests/112-translation-cache.test.mjs`
- `node --test tests/*.test.mjs` → `373/373`
- `node --check content/modules/immersive.js`
- `git diff --check`
