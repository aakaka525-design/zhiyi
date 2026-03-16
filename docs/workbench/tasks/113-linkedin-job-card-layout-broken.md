---
task: "113"
status: done
priority: P2
created: 2026-03-16
scope: "LinkedIn 职位卡排除（[data-job-id] + 精确 host 判定）"
---

# 113 — LinkedIn 职位卡排除

## 范围

检测 LinkedIn 域名 + `[data-job-id]` 排除职位卡元素。三路径接线。

---

## 改动

**文件：`content/modules/immersive.js`**

### 1. LinkedIn 检测（精确 host）

```javascript
const isLinkedIn = window.location.hostname === 'linkedin.com' ||
    window.location.hostname === 'www.linkedin.com' ||
    window.location.hostname.endsWith('.linkedin.com');
```

### 2. 排除 helper

```javascript
const LINKEDIN_METADATA_ANCESTORS = [
    '[data-job-id]',
];

function isLinkedInMetadataContext(el) {
    if (!isLinkedIn) return false;
    for (const sel of LINKEDIN_METADATA_ANCESTORS) {
        if (el.closest(sel)) return true;
    }
    return false;
}
```

### 3. 三路径接线

在 `isGitHubMetadataContext(el)` 之后添加：

```javascript
if (isLinkedInMetadataContext(el)) return false;
```

初始扫描、observer、rescan 三处。

---

## 约束

1. **精确 host 判定**：`=== 'linkedin.com'` / `=== 'www.linkedin.com'` / `.endsWith('.linkedin.com')`
2. **只用 `[data-job-id]`**（DOM 证据确认，高置信）
3. **不改** `GENERIC_SELECTORS`
4. **不改** 注入路径或 CSS
5. **不碰** content.css、options.*、popup.js

---

## 测试

**文件：`tests/113-linkedin-selectors.test.mjs`**

### 静态断言

1. JS 包含 `isLinkedIn` 判定（含 `linkedin.com`）
2. JS 包含 `LINKEDIN_METADATA_ANCESTORS`
3. `LINKEDIN_METADATA_ANCESTORS` 包含 `data-job-id`
4. 三条过滤路径包含 `isLinkedInMetadataContext`

全量 `node --test tests/*.test.mjs` 必须通过。

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `content/modules/immersive.js` | LinkedIn 检测 + 排除 helper + 三路径接线 |
| `tests/113-linkedin-selectors.test.mjs` | 静态断言 |
