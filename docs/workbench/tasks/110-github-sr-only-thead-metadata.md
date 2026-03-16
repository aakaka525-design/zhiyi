---
task: "110"
status: done
priority: P2
created: 2026-03-16
scope: "通用 .sr-only 排除 + GitHub 文件表格 aria-labelledby 排除"
---

# 110 — GitHub sr-only 标题和表格头排除

## 范围

通用 `EXCLUDE_SELECTORS` 加 `.sr-only`。GitHub `GITHUB_METADATA_ANCESTORS` 加 `[aria-labelledby="folders-and-files"]`。

---

## 改动

**文件：`content/modules/immersive.js`**

### 1. EXCLUDE_SELECTORS 加 `.sr-only`

```javascript
const EXCLUDE_SELECTORS = [
    // ... 现有选择器 ...
    '.sr-only',
];
```

### 2. GITHUB_METADATA_ANCESTORS 加文件表格

```javascript
const GITHUB_METADATA_ANCESTORS = [
    '.react-directory-row',
    '.js-navigation-item',
    '[data-testid="repos-file-tree"]',
    '.file-info',
    '.Breadcrumb',
    '[aria-labelledby="folders-and-files"]',  // ← 新增
];
```

---

## 约束

1. **只加 `.sr-only`**，不加 `.visually-hidden`、`[aria-hidden="true"]` 等
2. **不加** `[data-testid="screen-reader-heading"]`（`.sr-only` 已覆盖）
3. **不改** 109 的现有 5 个选择器
4. **不改** `GENERIC_SELECTORS`
5. **不碰** content.css、options.*、popup.js

---

## 测试

**文件：`tests/110-github-sr-only-thead.test.mjs`**

### 静态断言

1. `EXCLUDE_SELECTORS` 包含 `.sr-only`
2. `GITHUB_METADATA_ANCESTORS` 包含 `folders-and-files`
3. `EXCLUDE_SELECTORS` **不包含** `screen-reader-heading`

全量 `node --test tests/*.test.mjs` 必须通过。

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `content/modules/immersive.js` | 两处选择器数组新增 |
| `tests/110-github-sr-only-thead.test.mjs` | 静态断言 |
