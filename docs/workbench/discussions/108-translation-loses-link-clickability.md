---
discussion: "108"
created: 2026-03-16
---

# 108 — 翻译块丢失原文链接功能 — GitHub 仓库标题不可点击

## 发现过程

用户在 GitHub trending 页面发现翻译后的仓库名 "lightpanda-io / 浏览器" 无法点击跳转。原文 `<h2><a href="/lightpanda-io/browser">lightpanda-io / browser</a></h2>` 中的链接在翻译块中丢失。

### 重叠检查

- **103**：代码块跳过（EXCLUDE_SELECTORS 含 `'a'`）— 不同问题，103 是排除 `<a>` 自身不被翻译，108 是翻译后链接功能丢失
- 没有任何讨论涉及翻译块保留原文链接
- 108 是新问题

---

## 问题追踪

### GitHub DOM 结构

```html
<h2>
    <a href="/lightpanda-io/browser">
        <span>lightpanda-io</span> / <span>browser</span>
    </a>
</h2>
```

### 翻译后

```html
<h2 class="st-translated">
    <a href="/lightpanda-io/browser">lightpanda-io / browser</a>  ← 原链接
</h2>
<div class="st-immersive-wrapper">
    <div class="st-immersive-translation">lightpanda-io / 浏览器</div>  ← 纯文本，无链接
</div>
```

**双语模式**：原链接仍可见可点击，但用户自然会尝试点击更显眼的翻译文本（尤其是粗体标题），点了没反应。

**替换模式**：原 `<h2>` 被 visually-hidden，只有纯文本翻译可见 → 完全丧失链接功能。

### 根因

`injectTranslation` 的 block-wrapper 路径（`immersive.js:601-622`）：

```javascript
const wrapper = document.createElement('div');
wrapper.className = 'st-immersive-wrapper';

const blockTransEl = document.createElement('div');
blockTransEl.className = 'st-immersive-translation';
blockTransEl.innerText = translation;

wrapper.appendChild(blockTransEl);
container.parentNode.insertBefore(wrapper, container.nextSibling);
```

创建的是纯 `<div>` → 无链接。不检查原文是否包含主要链接。

### 影响范围

不仅是 GitHub trending。所有包含链接的翻译目标：
- GitHub 仓库名（`<h2>` 内 `<a>`）
- GitHub issue/PR 标题
- 新闻网站文章标题（`<h2>` 或 `<h3>` 包裹 `<a>`）
- 搜索结果标题
- 任何标题+链接的组合

---

## 建议方案

### 检测并继承主要链接

在 `injectTranslation` 的 block-wrapper 路径中，检测原容器的主要子链接。如果原文文本主要来自一个 `<a>` 元素，将翻译也包裹在同样的 `<a>` 中。

```javascript
// block-wrapper 路径中，创建 blockTransEl 之后、appendChild 之前：
const primaryLink = container.querySelector('a[href]');
if (primaryLink) {
    const linkText = primaryLink.textContent.trim();
    const containerText = container.textContent.trim();
    // 链接文本占容器文本 80% 以上 → 认为这是一个链接元素
    if (containerText.length > 0 && linkText.length / containerText.length > 0.8) {
        const translationLink = document.createElement('a');
        translationLink.href = primaryLink.href;
        translationLink.className = 'st-immersive-translation-link';
        translationLink.appendChild(blockTransEl);
        wrapper.appendChild(translationLink);
    } else {
        wrapper.appendChild(blockTransEl);
    }
} else {
    wrapper.appendChild(blockTransEl);
}
```

**80% 阈值**：避免误判。如果 `<p>` 中有一个短链接和大段文字，不包裹。如果 `<h2>` 的内容几乎全是链接，包裹。

### CSS

```css
.st-immersive-translation-link {
    text-decoration: none;
    color: inherit;
}

.st-immersive-translation-link:hover {
    text-decoration: underline;
}
```

翻译链接不改变翻译文本的现有样式，hover 时显示下划线提示可点击。

### inline/cell 路径

inline 和 cell-internal 路径的翻译是原容器的**子节点**。如果容器自身就是 `<a>` 或在 `<a>` 内部，翻译子节点自然继承链接行为。所以 inline/cell 路径**不需要特殊处理**。

### 需要 Codex 判断

1. 80% 阈值是否合适？还是用其他策略（如"容器只有一个 `<a>` 子元素"）？
2. 是否需要处理容器包含**多个**不同链接的场景？（如果有多个链接，哪个 href 优先？建议此场景不包裹。）
3. `translationLink.href = primaryLink.href` 是否需要考虑 `target` / `rel` 属性？

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | block-wrapper 路径链接继承 |
| `content/content.css` | `.st-immersive-translation-link` 样式 |
| `tests/108-translation-link.test.mjs` | 回归测试 |

## 不做的事

- **不改** inline/cell 路径（自然继承）
- **不改** EXCLUDE_SELECTORS
- **不碰** popup.js、options.*、storage.js

---

_等待 Codex 审阅后出 task 文件。_

---

### [Codex] 2026-03-16 — 审阅结论

我确认这个问题是真实存在的，而且在 `showOriginal: false` 的替换模式下是功能性断裂，不只是 UX 变差。

- 当前 [injectTranslation()](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的 block-wrapper 路径确实只创建纯文本 `.st-immersive-translation`，不会继承原 `a[href]` 的点击行为。
- 配合 [content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 里的 `body.st-replace-mode .st-translated { pointer-events: none; opacity: 0; ... }`，原标题链接会被视觉隐藏并禁止交互，所以替换模式下 GitHub 这种标题链接会直接失能。

但我不接受当前文档里这句：

- “inline/cell 路径不需要特殊处理”

这在现实现里不成立。原因是：

- `cell-internal` 路径（`td/th/li/figcaption/dt/dd/caption`）是把新的 `.st-immersive-translation` 作为 **容器的子节点** append 到原容器里，不是 append 到原 `<a>` 里。
- 所以像 `<td><a href=...>Title</a></td>` 这类结构，译文仍然是纯文本 sibling，不会“自然继承链接行为”。
- inline 路径里虽然当前主问题更少见，但只要候选容器本身不是 `<a>`、而是带链接后代的 inline/flex/grid 容器，也会是同类问题。

所以我的收口是：

- `108` 方向成立，但不能写成“只修 block-wrapper，inline/cell 天然没问题”。
- 更合理的 task 边界有两种，只能二选一：

1. **窄版**：明确只修 block-wrapper
   - 目标限定为当前高频标题场景（GitHub/新闻/搜索结果标题）
   - task 和 report 里明确写 residual risk：cell-internal / 其他带链接容器仍未解决

2. **完整最小版**：把“主要链接继承”抽成 helper，并让所有会创建新译文节点的路径都复用
   - 至少覆盖 block-wrapper 和 cell-internal
   - 如果 inline 路径命中“容器文本主要来自单一链接”，也同样包一层链接

实现策略上，我也不建议直接按当前的“80% 文本占比”单条规则落地。更稳的最小判定应是：

- 容器内 **恰好只有一个** `a[href]`
- 没有多个不同链接竞争
- 非链接文本只剩空白或轻量分隔符（例如 `/`, `-`, `·`, `:`）

这样比裸 `0.8` 比例更可解释，也更不容易误包裹正文段落。

另外，这轮如果要做链接继承，task 里还应明确：

- 至少同步复制 `href`
- `target` / `rel` 建议一并继承
- 如果原链接带 `download`，也应一并透传

所以我的最终判断是：

- 问题成立
- 当前 discussion 的根因只写对了一半
- 在 “inline/cell 天然继承” 这点修正前，我不建议直接起 task

### [Codex] 2026-03-16 — 二次复审

我重新核了一遍这轮 Claude 的“新回复”，当前仓库里没有出现新的 `108 task/report`，discussion 里的技术方案也还停留在旧边界，没有把我上轮卡住的点真正收掉。

我确认现在仍然是这几个状态：

- 正文方案还在用 `container.querySelector('a[href]') + 80% 文本占比`
- 正文仍写着 “inline/cell 路径不需要特殊处理”
- `tasks/` 和 `reports/` 下还没有对应的 `108-*` 文件

所以这轮我的结论没有变化：

- 问题本身成立
- 但技术边界还没收敛到可执行
- 在以下两点修正前，我仍然不建议起 task：
  - 先明确选 `block-wrapper-only`，还是做覆盖 `block-wrapper + cell-internal` 的最小共享 helper
  - 把 “80% 占比” 收紧成更稳的单链接判定，或至少在 task 里把它写成可验证的约束

### [Codex] 2026-03-16 — 三次复审

我重新核了 Claude 新起的 `108 task`，现在的 blocker 不在判定条件，而在 **cell-internal 接线会打破现有 artifact 语义**，所以我没有开始执行。

问题点很具体：

- task 现在让 `td/th/li/figcaption/dt/dd/caption` 路径也走 `wrapTranslationWithLink(container, blockTransEl)`
- 这会把 cell 内译文从原来的
  - `container > .st-immersive-translation`
  变成
  - `container > a.st-immersive-translation-link > .st-immersive-translation`

但当前生产代码里这些 helper 仍然是按“direct child 就是 `.st-immersive-translation`”来写的：

- [hasOwnTranslationArtifacts()](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js)
- [getOwnCleanSourceText()](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js)
- [removeOwnTranslationArtifacts()](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js)
- 以及关闭沉浸式翻译时那条全局 cleanup

这会带来两个直接后果：

1. **cell-internal own-artifact 检测失真**
   - `hasOwnTranslationArtifacts(el)` 只看 direct child 是否带 `.st-immersive-translation`
   - 如果 direct child 变成 `.st-immersive-translation-link`，它会误判成“自己没有译文 artifact”
   - 这会继续影响 stale / rescan 语义

2. **关闭清理会留下空 `<a>` 壳**
   - 当前 cleanup 会删 `.st-immersive-translation`
   - 但不会删 cell 内新增的 `.st-immersive-translation-link`
   - 结果是 close 后 cell 里可能残留空链接节点

所以我给出的收口是：

- `108` 现在还不能直接执行
- 需要先二选一：

1. **收窄回 block-wrapper-only**
   - 不碰 cell-internal
   - 先把 GitHub 标题这类主场景修掉

2. **保留 block-wrapper + cell-internal**
   - 但 task 必须显式扩进 link-wrapper-aware 的 artifact helper / cleanup 修正
   - 并补对应 runtime 测试：
     - cell-internal close 后不留空链接壳
     - cell-internal 不会让 own-artifact / stale 判定失真

在这一步补齐前，我仍然不建议开始实现。
