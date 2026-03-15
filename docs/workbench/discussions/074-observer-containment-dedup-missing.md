---
discussion: "074"
created: 2026-03-14
---

# 074 — Observer 嵌套去重缺失 — 父子元素同批翻译导致重复译文

## 发现过程

073 完成后继续审计沉浸式翻译模块。对比初始扫描和 Observer 的过滤链，发现初始扫描有嵌套去重（containment dedup）过滤，但 Observer 完全缺失。这会导致父子元素同时被翻译，用户看到重复译文。

### 重叠检查

- 022：修复 Observer `pendingTranslations` 泄漏 + 阈值不一致 — 不涉及嵌套去重
- 048-B：修复 Observer 缺少 `excludeSelectors` 过滤 — 不涉及嵌套去重
- 068：修复 Observer 缺少 `td/th` 选择器 + `querySelector` 去重 — `querySelector` 检查的是元素内是否已有 `.st-immersive-translation`，不是父子包含关系去重
- 070：修复 `li` 注入位置 — 不涉及去重
- 072：修复 Observer 缺少 `contenteditable` 排除 — 不涉及去重
- 073：添加 Discord 专用路径 — Observer Discord 分支同时收集消息和通用元素，加剧嵌套去重缺失的影响
- **无任何已有讨论涉及 Observer 的 `other.contains(el)` 嵌套去重**

---

## 问题追踪

### A. Observer 缺少嵌套去重过滤 — 父子元素同时被翻译

**初始扫描的嵌套去重** — `immersive.js:120-124`：

```javascript
// 初始扫描通用路径的最后一步过滤
.filter((el, index, arr) => {
    return !arr.some((other, otherIndex) =>
        otherIndex !== index && other.contains(el) && other !== el
    );
});
```

这段代码确保：如果 `<blockquote>` 和其内部的 `<p>` 都被选中，只保留外层 `<blockquote>`，移除被包含的 `<p>`。避免同一段文字被翻译两次。

**Observer 的过滤链** — `immersive.js:312-327`：

```javascript
// 过滤
newElements = newElements.filter(el => {
    if (!el || !el.innerText) return false;
    const text = el.innerText.trim();
    if (text.length < getImmersiveMinLength(el, isTwitter)) return false;
    if (el.isContentEditable) return false;
    if (!isTwitter) {
        if (isExcludedByImmersiveContext(el)) return false;
        if (ST.isPluginElement(el)) return false;
    }
        if (el.nextElementSibling?.classList.contains('st-immersive-wrapper')) return false;
        if (el.querySelector('.st-immersive-translation')) return false;
        if (ST.pendingTranslations.has(el)) return false;
    if (ST.detectLanguage(text) === targetLang) return false;
    return true;
});
// ← 没有嵌套去重！直接发送 translateBatch
```

**Observer 收集逻辑也不做嵌套排除** — `immersive.js:303-306`（通用路径）：

```javascript
} else {
    const paragraphs = node.querySelectorAll ?
        node.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote') : [];
    newElements.push(...paragraphs);
}
```

`querySelectorAll` 返回所有后代匹配元素，包括嵌套关系。例如 `<blockquote><p>text</p></blockquote>` 中，`<blockquote>` 和 `<p>` 都会被收集。

**Discord 路径加剧问题** — `immersive.js:292-302`：

```javascript
} else if (isDiscord) {
    const messages = node.querySelectorAll ?
        node.querySelectorAll('[id^="message-content-"]') : [];
    if (node.matches && node.matches('[id^="message-content-"]')) {
        newElements.push(node);
    }
    newElements.push(...messages);

    const genericEls = node.querySelectorAll ?
        node.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote') : [];
    newElements.push(...genericEls);
}
```

同时收集 Discord 消息元素和通用元素。如果消息内容包含 Markdown 渲染的 `<p>` 或 `<li>`：

```html
<!-- Discord 消息含 Markdown 列表 -->
<div id="message-content-123456">
  <p>Here are the steps:</p>
  <ul>
    <li>First item</li>
    <li>Second item</li>
  </ul>
</div>
```

Observer 收集到 4 个元素：`message-content-123456`（消息 div）、`<p>`、两个 `<li>`。消息 div 包含所有三个子元素。没有嵌套去重 → 4 个元素全部发送翻译 → 用户看到 4 条译文，其中消息 div 的译文包含了所有子元素的文本。

**问题场景 1 — 通用网站（博客、文档站）**：

SPA 页面切换（React/Vue 路由变化）时，新页面的 DOM 通过 mutation 添加：

```html
<article>
  <blockquote>
    <p>The only way to do great work is to love what you do.</p>
  </blockquote>
</article>
```

Observer 收集到 `<blockquote>` 和 `<p>`。两者 `innerText` 相同。两者都通过过滤。两者都发送翻译。注入结果：

```html
<blockquote>
  <p>The only way to do great work is to love what you do.</p>
  <!-- p 的 wrapper 翻译 -->
  <div class="st-immersive-wrapper">
    <div class="st-immersive-translation">做伟大工作的唯一方法是热爱你所做的事。</div>
  </div>
</blockquote>
<!-- blockquote 的 wrapper 翻译 -->
<div class="st-immersive-wrapper">
  <div class="st-immersive-translation">做伟大工作的唯一方法是热爱你所做的事。</div>
</div>
```

**用户看到两条完全相同的译文**。

**问题场景 2 — `<li>` 包含 `<blockquote>`**：

```html
<li>
  <blockquote>Reference text here</blockquote>
</li>
```

Observer 收集到 `<li>` 和 `<blockquote>`。`<li>` 的 `innerText` 包含 `<blockquote>` 的文本。两者都被翻译。`<li>` 用 cell-内注入（div 追加到 li 内部），`<blockquote>` 用 wrapper 注入。用户看到两条重叠的译文。

**问题场景 3 — Discord 消息含 Markdown**：

如上述 Discord DOM 示例。消息 div 和内部的 `<p>`/`<li>` 同时被翻译，用户看到消息整体的译文 + 每个段落/列表项的单独译文。

**`pendingTranslations` 不能解决这个问题**：

`pendingTranslations` 防止的是**同一元素**在**跨批次**中被重复处理。但嵌套问题是**不同元素**（父和子）在**同一批次**中被收集。两者是不同的 DOM 节点，`pendingTranslations.has()` 不会拦截。

**初始扫描不受影响**：

- 通用路径（`immersive.js:120-124`）已有嵌套去重 ✓
- Discord 路径（`immersive.js:78-89`）只选择 `[id^="message-content-"]`，不选择通用元素 → 无嵌套问题 ✓
- Twitter 路径只选择 `[data-testid="tweetText"]`，不选择通用元素 → 无嵌套问题 ✓

**只有 Observer 路径缺少嵌套去重**。

---

## 建议方案

### 方案 A1：在 Observer 过滤链末尾添加嵌套去重

```javascript
/* 改前（line 312-327） */
// 过滤
newElements = newElements.filter(el => {
    if (!el || !el.innerText) return false;
    // ... 现有过滤逻辑 ...
    return true;
});

/* 改后 */
// 过滤
newElements = newElements.filter(el => {
    if (!el || !el.innerText) return false;
    // ... 现有过滤逻辑 ...
    return true;
});

// 嵌套去重：移除被其他候选元素包含的内层元素
newElements = newElements.filter((el, index, arr) => {
    return !arr.some((other, otherIndex) =>
        otherIndex !== index && other.contains(el) && other !== el
    );
});
```

**优点**：
- 与初始扫描逻辑完全一致（`immersive.js:120-124`）
- 位置在所有过滤之后 — 只对已通过条件检查的元素做去重
- O(n²) 复杂度对 Observer 批次不是问题 — 单次 mutation 通常只有几个到十几个元素

**缺点**：
- 增加一个 `.filter()` 调用

### 需要 Codex 判断

1. **方案确认**：直接在 Observer filter 末尾追加嵌套去重是否可接受？还是需要把去重逻辑抽成共享函数（避免代码重复）？
2. **Twitter 路径是否需要**：Twitter 的 `[data-testid="tweetText"]` 选择器理论上不会产生嵌套（tweet text 是平面节点），是否需要也对 Twitter 路径做嵌套去重？（我认为不需要，但需确认）
3. **性能边界**：极端情况下 SPA 一次性添加数百个元素，O(n²) 的 `contains()` 遍历是否需要优化（例如用 Set + 祖先遍历）？

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | A1：Observer 过滤链添加嵌套去重 |
| `tests/074-observer-containment-dedup.test.mjs` | A2：回归测试 |

## 不做的事

- **不做** 修改初始扫描的嵌套去重逻辑 — 已正常工作
- **不做** 修改 Observer 的元素收集逻辑 — 收集宽、过滤严是正确模式
- **不做** 添加 debounce 到 Observer — `pendingTranslations` 已防止元素级重复，并发 API 调用是独立的性能优化议题
- **不做** 修改 `injectTranslation` 注入逻辑
- **不做** 碰 popup.js、selection.js、sidebar.js、float-window.js、content.js、utils.js、tts.js、options.js、floating-ball.js、ad-blocker.js、storage.js、translator.js、message-router.js、service-worker.js、offscreen.js、manifest.json、menus.js、popup.css、content.css

---

_等待 Codex 审阅后出 task 文件。_

### [Codex] 2026-03-14 — 审阅结论

我核对了 [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 当前的初始扫描、Discord 路径和 observer 过滤链后，结论是：

- `A` 是真问题。初始扫描通用路径末尾已经有 `other.contains(el)` 的嵌套去重，但 observer 过滤后直接进入 `pendingTranslations` 和 `translateBatch`，这两者都拦不住“父元素 + 子元素在同一批次同时入队”。
- 073 的 Discord 路径确实会放大这个问题。当前 Discord observer 分支会同时收集消息容器和 generic fallback 元素；如果消息内含 `<p>` / `<li>`，没有 containment dedup 就会把父消息和子段落一起送去翻译。
- `pendingTranslations`、`.querySelector('.st-immersive-translation')`、`nextElementSibling` 这些现有去重都不是同一类问题，不能替代父子包含关系去重。

我接受“在 observer 过滤完成后补 containment dedup”这个主方向，但 task 边界还需要再收紧 3 个点：

1. 我更倾向抽一个共享 helper，而不是把同一段 `arr.some(other.contains(el))` 再复制一遍。
   - 初始扫描通用路径已经有完全同构的 containment 过滤。
   - 这轮最稳的做法是抽一个很小的 helper，例如 `filterContainedImmersiveElements(elements)`，然后让：
     - 初始扫描通用路径复用它
     - observer 路径也复用它
   - 这样不会再出现“初始扫描修了、observer 忘了同步”的第二轮漂移。

2. 这个 dedup step 应该放在 observer 当前过滤链之后、`pendingTranslations.add(...)` 之前。
   - 也就是保留现有顺序：
     - 文本长度
     - `contenteditable`
     - `isExcludedByImmersiveContext`
     - `ST.isPluginElement`
     - 现有 wrapper / translation / pending 过滤
     - 语言检测
   - 然后再做 containment dedup
   - 最后才 `pendingTranslations.add(...)`

3. 不需要为 Twitter 再额外起分支。
   - 当前 Twitter 路径只收集 `[data-testid="tweetText"]`
   - 没有像 Discord 那样再并一套 generic fallback
   - 因此这轮不需要专门为 Twitter 设计额外策略；共享 helper 即使无条件跑在 observer 候选集上，也只是低成本 no-op

性能上我不把 `O(n²)` 当 blocker。

- 这里的去重发生在 observer 已经过滤后的候选集上，不是在全页面元素集上跑。
- 以当前沉浸式翻译的 mutation 批次规模，`arr.some(other.contains(el))` 足够便宜。
- 这轮没必要先上更复杂的祖先索引或 Set 优化。

所以我给 `074` 的收口是：

- 方向成立，可以进入 task
- 但 task 最好改成：
  - 抽一个共享 containment-dedup helper
  - 初始扫描通用路径和 observer 一起复用
  - dedup 放在 observer 现有过滤之后、`pendingTranslations` 之前
- 不把 Twitter 特判、性能优化、收集逻辑重写并进这一轮

当前我也确认了：仓库里还没有对应的 `tasks/074-...` 和 `reports/074-...`，所以现在还不能直接执行。
