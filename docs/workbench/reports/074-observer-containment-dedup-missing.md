# 074 — Observer 嵌套去重缺失报告

- 状态: done
- 对应任务: [tasks/074-observer-containment-dedup-missing.md](../tasks/074-observer-containment-dedup-missing.md)
- 来源讨论: [discussions/074-observer-containment-dedup-missing.md](../discussions/074-observer-containment-dedup-missing.md)
- 执行日期: 2026-03-14

## 结果概览

本轮按收窄后的边界完成了 `A1 + A2 + A3 + A4`：

- [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 新增了共享的 `filterContainedImmersiveElements(elements)` helper。
- 初始扫描通用路径不再内联写 containment dedup，而是复用同一 helper。
- observer 过滤链现在会在现有条件过滤之后、`pendingTranslations.add(...)` 之前做父子包含关系去重。
- 新增了 [074-observer-containment-dedup.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/074-observer-containment-dedup.test.mjs)，覆盖 helper、初始扫描、observer 通用路径和 Discord 路径。

## 已完成改动

### 74.1 新增共享 containment-dedup helper

[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 现在新增了：

```javascript
function filterContainedImmersiveElements(elements) {
    return elements.filter((el, index, arr) => {
        return !arr.some((other, otherIndex) =>
            otherIndex !== index && other.contains(el) && other !== el
        );
    });
}
```

这个 helper 的职责很窄：

- 输入候选元素数组
- 只保留最外层元素
- 移除被数组中其他元素包含的内层元素

例如：

- `[blockquote, p]` 且 `blockquote.contains(p)` → 只保留 `blockquote`
- `[message-content div, p, li]` 且消息 div 包含 `p/li` → 只保留消息 div
- 平级元素互不包含时不做误删

### 74.2 初始扫描和 observer 现在复用同一套去重语义

这轮没有把初始扫描的 containment dedup 继续保留为内联匿名 `.filter()`，而是改成了 helper 调用。

这样现在两条路径统一成：

- 初始扫描通用路径 → `filterContainedImmersiveElements(paragraphs)`
- observer 路径 → `filterContainedImmersiveElements(newElements)`

这就是 discussion 里要求的收口：不再出现“初始扫描修了，但 observer 忘了同步”的双轨风险。

### 74.3 Observer 的 containment dedup 放在正确位置

observer 当前顺序是：

1. 文本长度门槛
2. `contenteditable`
3. `isExcludedByImmersiveContext`
4. `ST.isPluginElement`
5. wrapper / translation / pending 去重
6. 目标语言跳过
7. **containment dedup**
8. `pendingTranslations.add(...)`
9. `translateBatch`

这符合 task 和 discussion 的要求：先让候选元素经过现有过滤，再做父子包含关系去重，最后才进入 pending 和 API 调用。

### 74.4 Discord 路径也被一起覆盖

073 之后的 Discord observer 分支会同时收集：

- `[id^="message-content-"]`
- 通用 fallback 元素（`p/h1.../blockquote`）

本轮 containment dedup 没有再为 Discord 额外写一套逻辑，而是直接通过共享 helper 覆盖这条路径。

结果是：

- Discord 消息容器和其内部的 `<p>` / `<li>` 不会再同批次一起翻译
- generic fallback 仍保留，只是不会和父消息容器重复入队

### 74.5 TDD 从红到绿

本轮先新增了 [074-observer-containment-dedup.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/074-observer-containment-dedup.test.mjs)。

第一次运行时失败点是对的：

- `filterContainedImmersiveElements` 尚不存在
- observer 通用路径会把父 `<blockquote>` 和子 `<p>` 一起送进 `translateBatch`
- observer Discord 路径会把消息容器和内部 generic 子元素一起送进 `translateBatch`

测试里还发现了一个 harness 问题：最初漏了 `nodeType = 1`，导致 observer 根本不处理 added node。这不是生产代码缺陷，所以在实现前先把测试修正到“只因为 074 缺失而失败”的状态，再继续绿灯实现。

## 验证

本轮实际 fresh 跑过：

```bash
node --test tests/074-observer-containment-dedup.test.mjs
node --test tests/*.test.mjs
node --check content/modules/immersive.js
git diff --check
```

验证结果：

- [074-observer-containment-dedup.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/074-observer-containment-dedup.test.mjs)：6/6 通过
- `node --test tests/*.test.mjs`：250/250 通过
- `node --check content/modules/immersive.js`：通过
- `git diff --check`：无输出

## Residual Risk

这轮刻意没有做以下事情：

- 没有改 observer 的元素收集策略
- 没有改注入逻辑
- 没有做 O(n²) → O(n) 的性能优化
- 没有对 Twitter 单独加特判

因此剩余风险主要是：

- containment dedup 只解决“同一批次父子元素同时进入候选集”的重复问题
- 不解决其他维度的内容切分问题，例如父元素文本天然包含多个语义块时的翻译粒度

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- SPA / 文档站动态插入 `<blockquote><p>...</p></blockquote>` 时只出现一条译文
- Discord 消息含 Markdown 列表或段落时，不会同时出现消息整体译文和子段落/子列表项译文
- 平级新增段落仍会全部翻译，不会被 containment dedup 误删
