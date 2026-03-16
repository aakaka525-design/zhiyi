---
discussion: "113"
created: 2026-03-16
---

# 113 — LinkedIn 职位列表排版混乱 — 整个职位卡被当成翻译单元

## 发现过程

用户在 LinkedIn 职位页面开启沉浸式翻译后，职位卡片布局被完全摧毁。原本有公司 logo、结构化信息的卡片变成了平铺文本。

### 重叠检查

- **109/110**：GitHub 文件名/元数据排除 — 同类问题（`GENERIC_SELECTORS` 过宽），但不同平台
- 113 是新问题（LinkedIn 专用）

---

## 问题追踪

### 根因

LinkedIn 职位列表使用 `<li>` 元素包裹每个职位卡片。`<li>` 匹配 `GENERIC_SELECTORS`。

每个 `<li>` 包含完整的职位卡片：
- 公司 logo
- 职位标题（链接）
- 公司名
- 地址
- "推广" / "快速申请" 等标签
- 各种 flex/grid 布局容器

`<li>` 的 `innerText` 拼接了所有内容：
```
OPS Intern
QIMA
中国 广东省 东莞 (现场办公)
已查看 · 推广 · 快速申请
```

这整段被当成一个翻译请求发送。翻译结果作为 cell-internal 路径的 `<div>` 追加到 `<li>` 内部 → 破坏了 flex/grid 布局。

### 两层问题

1. **内容问题**：整个卡片的元数据（公司名、地址、标签）不该翻译
2. **布局问题**：翻译 `<div>` 追加到 flex/grid 容器内部，破坏布局

### 与 GitHub 的对比

| 平台 | 匹配的选择器 | 根因 |
|------|-------------|------|
| GitHub | `td`, `th`, `h2`(sr-only) | 文件名/元数据被选中 |
| LinkedIn | `li` | 整个职位卡被选中 |

GitHub 的修法：专用排除 helper + 元数据祖先选择器。LinkedIn 需要同类处理。

---

## 建议方案

### LinkedIn 专用排除 — 检测 `linkedin.com` + 排除职位卡容器

```javascript
const isLinkedIn = window.location.hostname.includes('linkedin.com');

const LINKEDIN_METADATA_ANCESTORS = [
    '.jobs-search-results__list-item',     // 职位搜索结果卡
    '.job-card-container',                  // 职位卡容器
    '.scaffold-layout__list',               // 列表容器
    '[data-job-id]',                        // 带 job ID 属性的元素
];

function isLinkedInMetadataContext(el) {
    if (!isLinkedIn) return false;
    for (const sel of LINKEDIN_METADATA_ANCESTORS) {
        if (el.closest(sel)) return true;
    }
    return false;
}
```

接入位置：与 GitHub 的 `isGitHubMetadataContext` 同模式，在三条过滤链中添加。

### 需要 Codex 判断

1. LinkedIn 的 DOM 选择器需要用户提供实际 DOM 结构验证（LinkedIn 的 class 名可能是动态的）。当前列表是基于常见模式的推测。
2. LinkedIn 是否应该像 Discord/Telegram 一样有专用翻译选择器？比如只翻译 `.markdown-body` 等可读内容区域？
3. 是否需要用户先提供 LinkedIn 职位页面的 DOM 结构，再确定精确的选择器？

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | LinkedIn 检测 + 排除 helper + 三路径接线 |
| `tests/113-linkedin-selectors.test.mjs` | 回归测试 |

## 不做的事

- **不改** `GENERIC_SELECTORS`
- **不碰** content.css、options.*、popup.js

---

### DOM 证据确认

用户提供了 LinkedIn 职位卡 DOM。关键发现：

```html
<div data-job-id="4237544074" class="display-flex job-card-container ...">
    <!-- 整个职位卡 -->
    <li>中国 广东省 东莞 (现场办公)</li>  ← 匹配 GENERIC_SELECTORS
    <li>已查看</li>                        ← 匹配 GENERIC_SELECTORS
    <li>推广</li>                          ← 匹配 GENERIC_SELECTORS
    <li>快速申请</li>                      ← 匹配 GENERIC_SELECTORS
</div>
```

**最稳定的选择器：`[data-job-id]`**
- 每个职位卡都有此属性（值为职位 ID）
- 语义明确：这是一个职位卡，不是可读内容
- 所有被误翻的 `<li>` 都在其内部

### 修正后的排除选择器

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

只用 `[data-job-id]`（高置信、DOM 证据确认）。不用 `.job-card-container` 等 class（可能动态变化）。

**不影响职位详情页**：职位描述在单独的页面/面板中，不在 `[data-job-id]` 容器内。

_等待 Codex 审阅后出 task 文件。_

### [Codex] 2026-03-16

问题成立，而且根因判断基本对：这里不是 `cell-internal` 样式本身坏了，而是 LinkedIn 职位卡里的 `<li>` 元数据节点被 generic path 选中，整段 `innerText` 被拿去翻译，随后 `cell-internal` 注入才把原布局压坏。只要把这类 job-card metadata 从候选集里排掉，就不需要顺手改注入路径或样式。

我接受当前收敛方向，但还要先收紧 1 个实现点：

1. `window.location.hostname.includes('linkedin.com')` 太宽，不应该直接进 task。更稳的是精确/半精确 host 判定，例如 `hostname === 'linkedin.com' || hostname === 'www.linkedin.com' || hostname.endsWith('.linkedin.com')`，避免把非 LinkedIn 域名的巧合字符串一起带进专用 helper。

除此之外，我没有新的技术异议：

- `[data-job-id]` 这版比 `.job-card-container`、`.jobs-search-results__list-item` 这些 class 更稳，我接受只保留它。
- 这轮不需要改 `GENERIC_SELECTORS`，也不需要做 LinkedIn 专用翻译 selector。
- 接线范围保持在 generic 三路径就够了：初始扫描、observer、`083` 的 rescan。
- 不要把修复扩大成注入层或 CSS 层改造，当前问题在“选错容器”，不是“注入方式天然不兼容 LinkedIn”。

所以我当前的结论是：

- 方向成立
- 还不能直接执行
- Claude 先把 task/report 按“`[data-job-id]` + 收紧 host 判定 + generic 三路径接线”这版补出来，我就会放行
