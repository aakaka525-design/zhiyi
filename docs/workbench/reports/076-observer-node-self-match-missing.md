# 076 — Observer 通用路径缺少 node.matches() 自身检查报告

- 状态: done
- 对应任务: [tasks/076-observer-node-self-match-missing.md](../tasks/076-observer-node-self-match-missing.md)
- 来源讨论: [discussions/076-observer-node-self-match-missing.md](../discussions/076-observer-node-self-match-missing.md)
- 执行日期: 2026-03-14

## 结果概览

本轮按收窄后的边界完成了 `A1 + A2 + C`：

- [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的 observer 通用路径现在会先做 `node.matches(...)` 自身检查，再查找匹配后代。
- 同文件的 Discord generic fallback 也补上了相同的 `node.matches(...)` 自身检查。
- Twitter 路径和 Discord 消息容器路径保持不变。
- 新增了 [076-observer-node-self-match.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/076-observer-node-self-match.test.mjs)，覆盖 generic path、Discord fallback、Twitter 保持不回归、`summary` 继续排除，以及 074 的 containment dedup 仍然承接父子同时命中的场景。

## 已完成改动

### 76.1 通用 observer 路径补上了 direct-node self-match

[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的通用分支原来只做：

```javascript
const paragraphs = node.querySelectorAll ?
    node.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption') : [];
newElements.push(...paragraphs);
```

现在改成了：

```javascript
if (node.matches && node.matches('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption')) {
    newElements.push(node);
}
const paragraphs = node.querySelectorAll ?
    node.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption') : [];
newElements.push(...paragraphs);
```

这修掉了最直接的漏收集场景：

- SPA 直接 append 一个 `<p>`
- 直接 append 一个 `<li>`
- 直接 append 一个 `<blockquote>`
- 直接 append 一个 `figcaption`

以前这些节点因为 `querySelectorAll()` 不包含调用者自身，会被 observer 静默跳过；现在会直接进入候选集。

### 76.2 Discord generic fallback 同步补齐 self-match

Discord observer 路径本来已经覆盖了：

- `[id^="message-content-"]` 自身检查
- `[id^="message-content-"]` 后代查找

但 generic fallback 仍然只有 descendant query，没有 self-match。现在也补成和通用路径同构：

```javascript
if (node.matches && node.matches('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption')) {
    newElements.push(node);
}
const genericEls = node.querySelectorAll ?
    node.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption') : [];
newElements.push(...genericEls);
```

这样 Discord 页面上如果直接追加的是 generic 节点，而不是消息容器本身，也不会再漏掉。

### 76.3 074 的 containment dedup 继续承接 node + descendant 同时命中

本轮没有去碰 074 引入的：

- `filterContainedImmersiveElements(newElements)`

但测试已经明确覆盖了一个关键事实：

- 如果新增节点本身是 `<blockquote>`
- 且其内部又包含 `<p>`
- `node.matches(...)` 和 `querySelectorAll(...)` 会同时收集两者
- 074 的 containment dedup 仍会只保留外层 `<blockquote>`

也就是说，076 只补收集缺口，不引入重复翻译回归。

## TDD 记录

本轮先新增了 [076-observer-node-self-match.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/076-observer-node-self-match.test.mjs)。

第一次运行时，失败点是准确的：

- generic path 直接追加 `<p>` 时没有发出 `translateBatch`
- Discord fallback 直接追加 `<p>` 时没有发出 `translateBatch`
- generic path 直接追加 `<figcaption>` 时没有发出 `translateBatch`

而这些不该受影响的路径保持绿灯：

- `blockquote + p` 仍由 074 去重
- `summary` 继续不被收集
- Twitter 的 `[data-testid="tweetText"]` 自身检查仍正常工作
- 包含匹配后代的普通容器节点仍可通过 `querySelectorAll()` 收集

在确认红灯就是 task 指向的 self-match 缺口后，才补最小实现并转绿。

## 验证

本轮实际 fresh 跑过：

```bash
node --test tests/076-observer-node-self-match.test.mjs
node --test tests/*.test.mjs
git diff --check
```

验证结果：

- [076-observer-node-self-match.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/076-observer-node-self-match.test.mjs)：7/7 通过
- `node --test tests/*.test.mjs`：263/263 通过
- `git diff --check`：无输出

## Residual Risk

这轮刻意没有做：

- selector 常量抽取
- 初始扫描逻辑调整
- Twitter / Discord 消息路径重构
- observer 过滤链重排

因此 residual risk 主要还是已有结构本身的复杂度，而不是 076 新引入的问题。

## 手动验证

这轮仍未做真实 Chrome 手测。待人工确认的页面级行为包括：

- SPA 直接插入单个 `<p>` / `<li>` / `<figcaption>` 时，会被沉浸式 observer 正常翻译
- Discord 页面直接插入 generic 文本节点时，不会再静默漏翻
- `<summary>` 仍保持不进入沉浸式翻译
