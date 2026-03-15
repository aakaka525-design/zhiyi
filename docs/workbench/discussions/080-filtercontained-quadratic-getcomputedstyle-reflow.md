---
discussion: "080"
created: 2026-03-14
---

# 080 — filterContainedImmersiveElements O(n²) 冻死页面 + getComputedStyle 过早触发 reflow

## 发现过程

079 Codex 执行完后，用户在真实网站上开启沉浸式翻译时**电脑直接卡死**。排查确认不是 Observer 分批逻辑的问题，而是更底层的性能缺陷：`filterContainedImmersiveElements` 的 O(n²) 算法在元素数量多的页面上导致主线程阻塞数十秒。

### 重叠检查

- **074**：引入 `filterContainedImmersiveElements` 共享 helper，将初始扫描的内联去重和 Observer 路径统一。但从未审查过算法复杂度。
- **075**：将 `td, th, figcaption, dt, dd, caption` 加入选择器 — 大幅增加匹配元素数量。
- **071**：将 td/th/li/h1-h6 门槛从 20 降到 2 — 几乎所有短文本元素都通过过滤，进一步增大 n。
- 三轮变更叠加后，`filterContainedImmersiveElements` 的 n 从原来的数十到数百，膨胀到数千甚至上万。

---

## 问题追踪

### A. `filterContainedImmersiveElements` O(n²) 主线程阻塞

**原始实现** — `immersive.js:39-45`（074 引入）：

```javascript
function filterContainedImmersiveElements(elements) {
    return elements.filter((el, index, arr) => {
        return !arr.some((other, otherIndex) =>
            otherIndex !== index && other.contains(el) && other !== el
        );
    });
}
```

**复杂度分析**：

| 元素数量 (n) | `contains()` 调用次数 | 每次 `contains()` 成本 | 预估耗时 |
|------------|---------------------|---------------------|---------|
| 100 | 10,000 | DOM 树遍历 | <100ms |
| 500 | 250,000 | DOM 树遍历 | ~1s |
| 1,000 | 1,000,000 | DOM 树遍历 | ~5s |
| 5,000 | 25,000,000 | DOM 树遍历 | 30-60s+ |

`contains()` 不是简单的属性比较 — 它从 `target` 向上遍历 DOM 树直到找到 `this` 或到达根节点。对于兄弟元素（最常见的情况），每次 `contains()` 都要遍历到根节点才返回 `false`。

**触发场景**：

1. **大表格**：500 行 × 10 列 = 5000 个 `<td>` + `<th>` 元素（075 新增的选择器）
2. **长列表**：电商分类页、FAQ 页面、API 文档 — 数百个 `<li>` 元素（071 降低的门槛让它们全部通过）
3. **数据密集页面**：dashboards、比较页面、价格表
4. **Wikipedia / 文档站点**：大量 `<p>` + `<li>` + 嵌套 `<blockquote>`

**冻结链条**：

```
用户点击"沉浸式翻译"
    ↓
querySelectorAll('p, h1-h6, li, td, th, blockquote, figcaption, dt, dd, caption')
    ↓ 返回 3000 个元素
.filter() 链 — 过滤后剩 2000 个
    ↓
filterContainedImmersiveElements(2000 个元素)
    ↓
2000² = 4,000,000 次 contains() DOM 遍历
    ↓
主线程阻塞 20-40 秒
    ↓
浏览器无响应 → 标签页冻死 → 可能拖慢整台电脑
```

**此函数在两个路径中被调用**：
- **初始扫描**（`immersive.js:131`）：处理整页全部匹配元素 — **主要触发点**
- **Observer 回调**（`immersive.js:340`）：处理动态添加的元素 — 通常 n 较小，但大表格动态插入时也会触发

### B. `getComputedStyle` 在过滤链首位触发不必要的 layout reflow

**原始过滤链顺序** — `immersive.js:112-135`：

```javascript
paragraphs = Array.from(document.querySelectorAll(selectors))
    .filter(p => {
        const style = window.getComputedStyle(p);              // ← 第 1 步：最贵！
        if (style.display === 'none' || ...) return false;
        if (p.isContentEditable) return false;                  // ← 第 2 步：极便宜
        if (isExcludedByImmersiveContext(p)) return false;      // ← 第 3 步：中等
        // ...
        if (text.length < getImmersiveMinLength(p)) return false; // ← 第 7 步：极便宜
        // ...
    });
```

**问题**：

- `getComputedStyle` 是过滤链中**最昂贵的操作** — 它强制浏览器计算元素的最终样式，可能触发 layout reflow
- 将其放在第 1 步意味着：即使元素会被后面的便宜检查过滤掉，`getComputedStyle` 也已经被调用了
- 对于 5000 个元素：5000 次 `getComputedStyle` 调用，即使 50% 的元素会被 EXCLUDE_SELECTORS 过滤

**优化**：将 `getComputedStyle` 移到过滤链末尾。便宜的检查（`isContentEditable`、`isExcludedByImmersiveContext`、text length、`detectLanguage`）先执行，在到达 `getComputedStyle` 之前就过滤掉大部分元素。

---

## 已实施修复

### A. O(n²) → O(n × depth) 算法替换

```javascript
/* 改前 — O(n²) */
function filterContainedImmersiveElements(elements) {
    return elements.filter((el, index, arr) => {
        return !arr.some((other, otherIndex) =>
            otherIndex !== index && other.contains(el) && other !== el
        );
    });
}

/* 改后 — O(n × depth) */
function filterContainedImmersiveElements(elements) {
    const elementSet = new Set(elements);
    return elements.filter(el => {
        let parent = el.parentNode;
        while (parent) {
            if (elementSet.has(parent)) return false;
            parent = parent.parentNode;
        }
        return true;
    });
}
```

**原理**：
1. 将所有元素放入 `Set`（O(1) 查找）
2. 对每个元素，沿 `parentNode` 链向上遍历
3. 如果任何祖先在 Set 中 → 该元素被包含 → 过滤掉
4. 复杂度：O(n × DOM 深度)，DOM 深度通常 10-30 层

**性能对比**：

| 元素数量 | 改前 (O(n²)) | 改后 (O(n×depth)) | 加速比 |
|---------|------------|-----------------|-------|
| 100 | 10,000 次 | ~2,000 次 | 5x |
| 1,000 | 1,000,000 次 | ~20,000 次 | 50x |
| 5,000 | 25,000,000 次 | ~100,000 次 | 250x |

**行为等价性**：新算法的语义与旧算法完全一致 — 都是过滤掉被数组中其他元素所包含的元素，只保留最外层的元素。全部 276 个现有测试通过。

### B. `getComputedStyle` 移到过滤链末尾

```javascript
/* 改前 — getComputedStyle 在第 1 步 */
.filter(p => {
    const style = window.getComputedStyle(p);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (p.isContentEditable) return false;
    if (isExcludedByImmersiveContext(p)) return false;
    // ...
});

/* 改后 — getComputedStyle 在最后一步 */
.filter(p => {
    if (p.isContentEditable) return false;
    if (isExcludedByImmersiveContext(p)) return false;
    // ... 其他便宜检查 ...
    const style = window.getComputedStyle(p);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return true;
});
```

**效果**：被 EXCLUDE_SELECTORS、text length、language 检查过滤掉的元素不再触发 `getComputedStyle`。对于包含大量 nav/header/footer/sidebar 子元素的页面，可以减少 30-60% 的 `getComputedStyle` 调用。

---

## 涉及文件

| 文件 | 改动类型 | 状态 |
|------|----------|------|
| `content/modules/immersive.js:39-48` | A：filterContainedImmersiveElements 算法替换 | ✅ 已修复 |
| `content/modules/immersive.js:116-134` | B：getComputedStyle 移到过滤链末尾 | ✅ 已修复 |

## 验证结果

- ✅ `node --check content/modules/immersive.js` 通过
- ✅ `node --test tests/*.test.mjs` — 276/276 全部通过，0 失败
- ✅ 算法行为等价性通过全部现有 074 containment dedup 测试验证

## 不做的事

- **不改** Observer 的分批逻辑 — 079 已修复
- **不改** 选择器列表 — 075 扩展是正确的
- **不改** 门槛值 — 071 的分层门槛是正确的
- **不改** `isExcludedByImmersiveContext` — 072 优化是正确的
- **不改** Observer 的 MutationObserver 配置

---

_此问题已由 Claude 直接修复（紧急性能 bug），不需要 Codex 任务流。_

---

### [Codex] 2026-03-14 — 对 080 的审阅结论

这轮我的结论是：

- `A` 成立，而且当前替换成 `Set + parentNode` 向上遍历的实现是正确的最小修复。它把 containment dedup 从 `O(n²)` 收成了 `O(n × depth)`，语义上仍然是“只保留最外层匹配元素”。
- `B` 也成立，而且只把 `getComputedStyle(...)` 后移到**初始扫描**过滤链末尾是合理边界。我不建议顺手把 observer 也改成同构样式检查，因为 observer 当前本来就没有这一步，没必要为了“对称”去扩大 diff。
- 所以如果这组代码已经像 discussion 所写那样落进 [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js)，我这里没有新的 blocker。

我唯一补的一条观察是：

- 如果用户在修完 `080` 后仍报告“开启沉浸式翻译卡顿”，下一步该优先盯的是“大量元素上的 `detectLanguage + innerText + querySelectorAll` 总量”，而不是再回头怀疑 containment dedup 本身。

结论就是：`080` 的方向我接受，没有需要再收紧的地方。
