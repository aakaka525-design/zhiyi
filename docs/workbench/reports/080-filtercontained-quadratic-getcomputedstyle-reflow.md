---
report: "080"
created: 2026-03-14
status: fixed
---

# 080 — filterContainedImmersiveElements O(n²) 冻死页面 + getComputedStyle reflow

## 问题

用户在真实网站开启沉浸式翻译时电脑直接冻死。根因：

1. **`filterContainedImmersiveElements` O(n²) 算法**：071 降低门槛 + 075 扩展选择器后，大表格/长列表页面产生数千个匹配元素。5000 个 `<td>` → 25,000,000 次 `contains()` DOM 遍历 → 主线程阻塞 30-60 秒。
2. **`getComputedStyle` 在过滤链首位**：对每个匹配元素都触发 layout reflow，即使该元素会被后面的便宜检查过滤掉。

## 修复

### A. 算法 O(n²) → O(n × depth)

```javascript
// 改前
elements.filter((el, index, arr) => {
    return !arr.some((other, otherIndex) =>
        otherIndex !== index && other.contains(el) && other !== el
    );
});

// 改后
const elementSet = new Set(elements);
elements.filter(el => {
    let parent = el.parentNode;
    while (parent) {
        if (elementSet.has(parent)) return false;
        parent = parent.parentNode;
    }
    return true;
});
```

5000 元素：25,000,000 次操作 → ~100,000 次操作（250x 加速）。

### B. getComputedStyle 移到过滤链末尾

便宜检查（isContentEditable、EXCLUDE_SELECTORS、text length、detectLanguage）先执行，大部分元素在到达 getComputedStyle 之前就被过滤掉。

## 验证

- `node --check content/modules/immersive.js` ✅
- `node --test tests/*.test.mjs` — 276/276 通过 ✅

## 涉及文件

| 文件 | 改动 |
|------|------|
| `content/modules/immersive.js:39-48` | filterContainedImmersiveElements 算法替换 |
| `content/modules/immersive.js:116-134` | getComputedStyle 移到过滤链末尾 |
