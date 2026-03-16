---
task: "109"
status: done
priority: P2
created: 2026-03-16
scope: "GitHub 专用排除 helper（高置信选择器 only）"
---

# 109 — GitHub 文件名/元数据排除

## 范围

新增 `isGitHubMetadataContext` 排除 helper，只含高置信选择器。三路径接线。

---

## 改动

**文件：`content/modules/immersive.js`**

### 1. GitHub 检测

在已有的 `isTwitter` / `isDiscord` / `isTelegram` 检测附近：

```javascript
const isGitHub = window.location.hostname === 'github.com';
```

### 2. 排除 helper — 高置信选择器 only

```javascript
const GITHUB_METADATA_ANCESTORS = [
    '.react-directory-row',
    '.js-navigation-item',
    '[data-testid="repos-file-tree"]',
    '.file-info',
    '.Breadcrumb',
];

function isGitHubMetadataContext(el) {
    if (!isGitHub) return false;
    for (const sel of GITHUB_METADATA_ANCESTORS) {
        if (el.closest(sel)) return true;
    }
    return false;
}
```

**只含 Codex 审阅确认的 5 个高置信项**。不含 `.Box-row`、`.commit-tease`、`.pagehead-actions`、`.branch-name`、`.tag-name`（待后续 DOM 证据补充）。

### 3. 三路径接线

在 `isExcludedByImmersiveContext(el)` 之后、`containsHardProtectedContent(el)` 之后添加：

```javascript
if (isGitHubMetadataContext(el)) return false;
```

**初始扫描**（通用过滤）、**observer**（通用过滤）、**rescan**（过滤链）三处。

Twitter / Discord / Telegram 专用路径不加（它们有自己的选择器）。

---

## 约束

1. **只含 5 个高置信选择器**：`.react-directory-row`、`.js-navigation-item`、`[data-testid="repos-file-tree"]`、`.file-info`、`.Breadcrumb`
2. **不含** `.Box-row`、`.commit-tease`、`.pagehead-actions`、`.branch-name`、`.tag-name`
3. **ASCII 引号**：选择器中的属性值用 ASCII `"` 不用智能引号
4. **不改** `GENERIC_SELECTORS` / `EXCLUDE_SELECTORS`
5. **不碰** content.css、options.*、popup.js、storage.js

---

## 测试

**文件：`tests/109-github-selectors.test.mjs`**

### 静态断言

1. JS 包含 `GITHUB_METADATA_ANCESTORS` 常量
2. JS 包含 `isGitHubMetadataContext` 函数
3. `GITHUB_METADATA_ANCESTORS` 包含 `.react-directory-row`
4. `GITHUB_METADATA_ANCESTORS` 包含 `.Breadcrumb`
5. `GITHUB_METADATA_ANCESTORS` **不包含** `.Box-row`
6. 三条过滤路径包含 `isGitHubMetadataContext` 调用

全量 `node --test tests/*.test.mjs` 必须通过。

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `content/modules/immersive.js` | GitHub 检测 + 排除 helper + 三路径接线 |
| `tests/109-github-selectors.test.mjs` | 静态断言 |
