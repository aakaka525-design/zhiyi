---
status: done
priority: P0
created: 2026-03-14
---

# 080 — filterContainedImmersiveElements O(n²) 冻死页面 + getComputedStyle reflow

- 来源讨论: [discussions/080-filtercontained-quadratic-getcomputedstyle-reflow.md](../discussions/080-filtercontained-quadratic-getcomputedstyle-reflow.md)

## 背景

用户在真实网站开启沉浸式翻译时电脑冻死。根因：`filterContainedImmersiveElements` 使用 O(n²) 算法，071 降低门槛 + 075 扩展选择器后，大表格/长列表页面元素数量从数十膨胀到数千，25,000,000 次 DOM `contains()` 遍历阻塞主线程 30-60 秒。次要原因：`getComputedStyle` 在过滤链首位，对每个元素触发 layout reflow。

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js:39-48` | A：filterContainedImmersiveElements O(n²)→O(n×depth) |
| `content/modules/immersive.js:116-134` | B：getComputedStyle 移到过滤链末尾 |

## 任务清单

### 必做

#### A. filterContainedImmersiveElements 算法替换

- [x] 将 O(n²) `arr.some(other => other.contains(el))` 替换为 O(n × depth) 的 Set + parentNode 链遍历

#### B. getComputedStyle 移到过滤链末尾

- [x] 初始扫描过滤链中，将 `getComputedStyle` 从第 1 步移到最后一步

## 验证要求

- [x] `node --check content/modules/immersive.js` 通过
- [x] `node --test tests/*.test.mjs` — 276/276 全部通过
- [x] 算法行为等价性通过 074 containment dedup 测试验证
