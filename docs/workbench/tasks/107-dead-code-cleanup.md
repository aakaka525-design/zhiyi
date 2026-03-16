---
task: "107"
status: done
priority: P3
created: 2026-03-16
scope: "A-only: 删除 fontSize 死设置"
---

# 107 — 死代码清理：删除 `fontSize` 死设置

## 范围

只做 A（`fontSize`）。B/C/D 不在本轮。

---

## 改动

### 删除 `fontSize` 设置项

**`src/core/storage.js`** — `DEFAULT_SETTINGS` 中删除：

```javascript
// 删除
fontSize: 14,
```

**`content/content.js`** — `mergeDefaults` 的 defaults 对象中删除：

```javascript
// 删除
fontSize: 14,
```

---

## 约束

1. **只删 `fontSize`**
2. **不删** `debugMode`（需产品决策）
3. **不删** `updateSettings` 路由（兼容契约）
4. **不删** `pdf.js`（已有保留决策）
5. **不碰** options.*、immersive.js、popup.js

---

## 测试

全量 `node --test tests/*.test.mjs` 必须通过。如有断言引用 `fontSize`，需同步更新。

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `src/core/storage.js` | 删除 `fontSize: 14` |
| `content/content.js` | 删除 `fontSize: 14` |

## 验证

- [x] `node --test tests/107-dead-code-cleanup.test.mjs`
- [x] `node --test tests/*.test.mjs`
- [x] `node --check src/core/storage.js content/content.js`
- [x] `git diff --check`
