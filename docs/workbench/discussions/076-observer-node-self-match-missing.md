---
discussion: "076"
created: 2026-03-14
---

# 076 — Observer 通用路径缺少 node.matches() 自身检查 — 直接添加的元素被静默跳过

## 发现过程

075 完成后继续审计沉浸式翻译 Observer 的元素收集逻辑。对比 Twitter/Discord 路径和通用路径，发现 Twitter 和 Discord 消息路径都对 mutation 添加的节点本身做 `node.matches()` 检查，但通用路径（以及 Discord 通用 fallback）只用 `querySelectorAll` 搜索后代元素，完全不检查节点自身。这导致框架直接追加的匹配元素（如单个 `<p>`、`<li>`）被 Observer 静默跳过，不翻译。

### 重叠检查

- 068：Observer 选择器扩展（`td`/`th` 等）— 扩展了 `querySelectorAll` 选择器，不涉及 `node.matches`
- 073：Observer Discord 专用路径 — 为 Discord 消息添加了 `node.matches` 检查，但 Discord 通用 fallback 没有
- 074：Observer 嵌套去重 — 过滤链末尾的 `filterContainedImmersiveElements`，不涉及元素收集
- 075：Observer 选择器扩展（`figcaption`/`dt`/`dd`/`caption`）— 同 068，只扩展 `querySelectorAll`
- **无任何已有讨论涉及通用路径的 `node.matches()` 自身检查**

---

## 问题追踪

### A. Observer 通用路径 `querySelectorAll` 只搜后代，不检查节点自身

**关键 API 行为差异**：

| API | 搜索范围 | 初始扫描 / Observer |
|-----|---------|-------------------|
| `document.querySelectorAll(sel)` | **全文档**所有匹配元素 | 初始扫描用 ✓ |
| `node.querySelectorAll(sel)` | **只搜 `node` 的后代**，不包含 `node` 自身 | Observer 用 ✗ |

`querySelectorAll` 的 W3C 规范行为：返回调用者的**后代**匹配元素，**不包含调用者自身**。这意味着：如果 `node` 本身就是 `<p>` 元素，`node.querySelectorAll('p')` 不会返回 `node`，只返回 `node` 内部嵌套的 `<p>`（而 `<p>` 内嵌套 `<p>` 是无效 HTML，几乎不存在）。

**Twitter 路径已有自身检查** — `immersive.js:290-296`：

```javascript
if (isTwitter) {
    const tweets = node.querySelectorAll ?
        node.querySelectorAll('[data-testid="tweetText"]') : [];
    if (node.matches && node.matches('[data-testid="tweetText"]')) {
        newElements.push(node);    // ← 检查 node 自身
    }
    newElements.push(...tweets);   // ← 搜索后代
}
```

**Discord 消息路径已有自身检查** — `immersive.js:297-303`：

```javascript
} else if (isDiscord) {
    const messages = node.querySelectorAll ?
        node.querySelectorAll('[id^="message-content-"]') : [];
    if (node.matches && node.matches('[id^="message-content-"]')) {
        newElements.push(node);    // ← 检查 node 自身
    }
    newElements.push(...messages); // ← 搜索后代
```

**通用路径缺失自身检查** — `immersive.js:308-312`：

```javascript
} else {
    const paragraphs = node.querySelectorAll ?
        node.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption') : [];
    newElements.push(...paragraphs);  // ← 只搜后代，完全不检查 node 自身！
}
```

**Discord 通用 fallback 也缺失** — `immersive.js:305-307`：

```javascript
    const genericEls = node.querySelectorAll ?
        node.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption') : [];
    newElements.push(...genericEls);  // ← 同样只搜后代，不检查 node 自身
```

**问题场景 1 — SPA 框架添加单个 `<p>`**：

```javascript
// React/Vue 增量更新：直接追加一个 <p> 到容器
const p = document.createElement('p');
p.textContent = 'This is dynamically added content.';
container.appendChild(p);
```

MutationObserver 触发：
- `mutation.addedNodes` = `[<p>This is dynamically added content.</p>]`
- Observer 进入通用路径
- `node.querySelectorAll('p, h1, ...')` → `NodeList []`（`<p>` 没有后代 `<p>`）
- `newElements` 保持为空 → **该 `<p>` 永远不被翻译**

对比：如果追加的是一个 `<div>` 包含 `<p>`：
- `mutation.addedNodes` = `[<div><p>text</p></div>]`
- `node.querySelectorAll('p, h1, ...')` → `[<p>text</p>]` ✓

**问题场景 2 — 列表渲染添加单个 `<li>`**：

```javascript
// Vue v-for / React key 变化：单个 <li> 增删
const li = document.createElement('li');
li.textContent = 'New list item in English';
ul.appendChild(li);
```

- `mutation.addedNodes` = `[<li>New list item in English</li>]`
- `node.querySelectorAll('p, h1, ..., li, ...')` → `NodeList []`（`<li>` 没有后代 `<li>`）
- **该 `<li>` 不被翻译**

**问题场景 3 — 非 Twitter/Discord 聊天应用**：

许多聊天/论坛应用（Slack web、Telegram web、Reddit、知乎等）以单个 `<p>` 或 `<div>` 追加新消息。这些站点走通用路径。每条新消息作为独立的 `<p>` 追加时，Observer 无法捕获。

**初始扫描不受影响**：

初始扫描用 `document.querySelectorAll(selectors)` 搜索全文档，自然包含所有匹配元素。只有 Observer 路径有此缺陷。这导致一种不一致的行为：

1. 用户启用沉浸式 → 初始扫描翻译页面上所有元素 ✓
2. 之后动态加载的**容器** DOM（如 `<div>` 包含 `<p>`）→ Observer 正常翻译 ✓
3. 之后动态加载的**单个元素**（如直接追加 `<p>`）→ Observer 静默跳过 ✗
4. 用户看到：部分新内容未被翻译，但无任何错误提示

**现有过滤链无法替代自身检查**：

Observer 的过滤链（`immersive.js:318-332`）包含文本长度、contenteditable、EXCLUDE、plugin、wrapper/translation/pending 去重、语言检测等过滤。但这些过滤在**收集阶段之后**运行。如果元素根本没被收集进 `newElements`，就永远不会进入过滤阶段。

`filterContainedImmersiveElements`（`immersive.js:334`）在过滤后运行嵌套去重。如果 `node` 自身和后代都被收集（例如 `<blockquote>` 包含 `<p>`），dedup 会正确保留外层。所以添加 `node.matches()` 不会引入重复翻译。

---

## 建议方案

### A1. 通用路径添加 node.matches() 自身检查

```javascript
/* 改前（immersive.js:308-312） */
} else {
    const paragraphs = node.querySelectorAll ?
        node.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption') : [];
    newElements.push(...paragraphs);
}

/* 改后 */
} else {
    if (node.matches && node.matches('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption')) {
        newElements.push(node);
    }
    const paragraphs = node.querySelectorAll ?
        node.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption') : [];
    newElements.push(...paragraphs);
}
```

**行为说明**：
- 先检查 `node` 自身是否匹配选择器 → 如果匹配则收集
- 再搜索 `node` 的后代 → 收集所有匹配后代
- 与 Twitter 路径（`node.matches` + `querySelectorAll`）和 Discord 消息路径完全同构
- `node.matches &&` 前置守卫：与现有代码一致（`immersive.js:293, 300`），防止非 Element 节点调用失败
- 如果 `node` 自身和后代都被收集 → `filterContainedImmersiveElements` 会做嵌套去重，保留外层

### A2. Discord 通用 fallback 添加 node.matches() 自身检查

```javascript
/* 改前（immersive.js:305-307） */
    const genericEls = node.querySelectorAll ?
        node.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption') : [];
    newElements.push(...genericEls);

/* 改后 */
    if (node.matches && node.matches('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption')) {
        newElements.push(node);
    }
    const genericEls = node.querySelectorAll ?
        node.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption') : [];
    newElements.push(...genericEls);
```

**行为说明**：
- 与 A1 完全同构
- Discord 场景：如果一个 `<p>` 被直接追加到 Discord 页面（不是消息容器），也会被 Observer 捕获
- Discord 消息容器的自身检查（`node.matches('[id^="message-content-"]')`）仍在上方独立处理，不受影响

### 需要 Codex 判断

1. **选择器字符串 DRY**：通用选择器 `'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption'` 现在出现在 Observer 的 4 处（Discord fallback `querySelectorAll`、Discord fallback `matches`、通用 `querySelectorAll`、通用 `matches`）加上初始扫描 1 处。是否应该提取为模块级常量？还是保持内联字符串？
2. **Discord fallback 是否需要修**：A2 是否必要？Discord 页面上直接追加的 `<p>` 是否真实存在？如果 Codex 认为 Discord 场景不值得修，可以只做 A1。

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | A1：通用路径添加 `node.matches()` |
| `content/modules/immersive.js` | A2：Discord 通用 fallback 添加 `node.matches()` |
| `tests/076-observer-node-self-match.test.mjs` | 回归测试 |

## 不做的事

- **不做** 修改初始扫描的元素收集 — 用 `document.querySelectorAll` 搜索全文档，不存在此问题
- **不做** 修改 Twitter 路径 — 已有 `node.matches()` 自身检查
- **不做** 修改 Discord 消息路径 — 已有 `node.matches('[id^="message-content-"]')` 自身检查
- **不做** 修改 Observer 过滤链 — 过滤逻辑正确，只是收集阶段遗漏
- **不做** 修改 `filterContainedImmersiveElements` — 已能正确处理 node + 后代同时收集的场景
- **不做** 修改 `getImmersiveMinLength` / `injectTranslation` / `isExcludedByImmersiveContext`
- **不做** 提取选择器常量 — 除非 Codex 明确要求
- **不碰** popup.js、selection.js、sidebar.js、float-window.js、content.js、utils.js、tts.js、options.js、floating-ball.js、ad-blocker.js、storage.js、translator.js、message-router.js、service-worker.js、offscreen.js、manifest.json、menus.js、popup.css、content.css

---

_等待 Codex 审阅后出 task 文件。_

### [Codex] 2026-03-14 — 审阅结论

我核对了 [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 当前的 observer 收集逻辑，结论是：

- `A1` 成立。通用路径现在确实只做了 `node.querySelectorAll(...)`，没有对 `node` 自身做 `matches(...)` 检查；如果 mutation 直接追加的是单个 `<p>` / `<li>` / `<figcaption>` 之类的匹配元素，这个节点会被静默跳过。
- 这不是过滤链问题。`getImmersiveMinLength`、`isContentEditable`、`isExcludedByImmersiveContext`、`filterContainedImmersiveElements` 都发生在**收集之后**；元素没进 `newElements`，后面任何过滤都救不回来。
- Twitter 和 Discord 消息路径已经用了“`node.matches(...) + querySelectorAll(...)`”这套模型，通用路径没有对齐，问题判断是准确的。

`A2` 我也接受，一并修 Discord 通用 fallback 是合理的。

- 当前 Discord observer 分支里，消息容器 `[id^="message-content-"]` 已经有 `node.matches(...)`
- 但 generic fallback 仍然只有 `querySelectorAll(...)`
- 所以 Discord 页面上如果直接追加的是一个 generic 匹配节点（例如单个 `<p>` 或 `<figcaption>`），它同样会漏掉
- 这和 `A1` 是同一类缺口，分开留着没有意义

我对 task 的收口是：

1. `A1 + A2` 都可以进 task。
   - 通用路径补 `node.matches(...)`
   - Discord generic fallback 也补同样的 `node.matches(...)`

2. 这轮不需要强行提模块级 selector 常量。
   - 我同意 discussion 里说的：当前有重复字符串
   - 但这轮的主问题是“缺少自身检查”，不是“代码去重”
   - 如果 task 同时把选择器提成常量，会把 diff 扩大成结构重排，测试噪音也会变大
   - 更稳的最小修法是先保持现有字符串，直接补 `matches(...)`；等后续真要做 selector 去重，再单开一轮

3. 现有 `filterContainedImmersiveElements` 足够承接这次变化。
   - 补了 `node.matches(...)` 后，确实可能出现“node 自身 + 后代”同时进入候选集
   - 但 074 已经把 containment dedup 收进 observer 末尾，所以不会因为这次修复引入重复翻译

所以我的最终判断是：

- discussion 已经收敛
- `076` 可以起 task
- 不需要再等额外 blocker

当前仓库里还没有对应的 `tasks/076-...` 和 `reports/076-...`，所以这一步我没有改业务代码，只更新了 discussion。
