---
discussion: "081"
created: 2026-03-14
---

# 081 — Discord Observer 通用选择器 `<li>` 泄露消息元数据到翻译结果

## 发现过程

用户在 Discord 开启沉浸式翻译后，翻译结果中包含了用户名、时间戳、徽章等元数据，而不是只翻译消息内容。截图显示翻译结果为：

```
消息无法加载
Amelia [BULK], BULK
PERLE EXPLORER
—
21:12
2026年3月14日星期六 21:12
It's 6.41
What is your favorite work mate
@Nusrat sathi
Where are you from
```

这不是消息内容的翻译，而是整个消息行（包含元数据）的 `innerText` 的"翻译"。

### 重叠检查

- **073**：Discord 支持 — 在初始扫描和 Observer 中添加了 `[id^="message-content-"]` 选择器。初始扫描 Discord 路径**只**收集 `[id^="message-content-"]`，不收集通用元素 — 正确。
- **075**：扩展选择器，Observer 通用选择器中添加了 `li` — 间接触发了此问题。
- **076**：Observer node self-match — 在 Discord Observer 路径中添加了通用选择器的 self-match + querySelectorAll（包含 `li`）。

---

## 问题追踪

### Discord 消息的 DOM 结构

```html
<ol class="scrollerInner">
  <li class="messageListItem">        ← Observer 通用选择器匹配 li
    <div class="message">
      <div class="contents">
        <img class="avatar" />
        <h3 class="header">
          <span class="username">Amelia</span>
          <span class="badge">BULK</span>
          <span class="timestamp">21:12</span>
        </h3>
        <div id="message-content-123456">    ← Discord 专用选择器
          It's 6.41
          What is your favorite work mate
          @Nusrat sathi
          Where are you from
        </div>
      </div>
    </div>
  </li>
</ol>
```

### Observer 收集路径（改前）

```javascript
} else if (isDiscord) {
    // 1. 收集 Discord 消息内容元素 — 正确
    const messages = node.querySelectorAll('[id^="message-content-"]');
    newElements.push(...messages);

    // 2. 同时收集通用元素（包含 li）— 问题所在！
    if (node.matches('p, h1, ..., li, td, th, blockquote, ...')) {
        newElements.push(node);
    }
    const genericEls = node.querySelectorAll('p, h1, ..., li, td, th, blockquote, ...');
    newElements.push(...genericEls);
}
```

### 冲突链

```
Discord 动态加载消息
    ↓
Observer 捕获 addedNodes（消息行容器）
    ↓
步骤 1: 收集 [id^="message-content-123456"]
步骤 2: 收集 <li class="messageListItem">（通用选择器 li 匹配）
    ↓
newElements = [message-content-div, li-element]
    ↓
filterContainedImmersiveElements:
  li 包含 message-content-div → 保留 li，过滤掉 message-content-div
    ↓
翻译 li.innerText = "Amelia [BULK], BULK\nPERLE EXPLORER\n—\n21:12\n..."
    ↓
翻译结果 = 整个消息行的元数据 + 消息内容
    ↓
注入到 <li> 内部（cell-internal 路径）→ 用户看到元数据"翻译"
```

### 对比初始扫描

初始扫描 Discord 路径（行 92-103）**只**收集 `[id^="message-content-"]`，不收集通用元素：

```javascript
if (isDiscord) {
    const discordMessages = document.querySelectorAll('[id^="message-content-"]');
    if (discordMessages.length > 0) {
        paragraphs = Array.from(discordMessages).filter(el => { ... });
    }
}
// 只有 paragraphs.length === 0 时才走通用路径
```

Observer 和初始扫描**不一致** — 初始扫描不收集通用元素（正确），Observer 收集（导致 bug）。

---

## 已实施修复

Discord Observer 通用选择器中**移除 `li`**：

```javascript
/* 改前 */
if (node.matches && node.matches('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption')) {
    newElements.push(node);
}
const genericEls = node.querySelectorAll ?
    node.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption') : [];
newElements.push(...genericEls);

/* 改后 */
const discordGenericSelector = 'p, h1, h2, h3, h4, h5, h6, td, th, blockquote, figcaption, dt, dd, caption';
if (node.matches && node.matches(discordGenericSelector)) {
    newElements.push(node);
}
const genericEls = node.querySelectorAll ?
    node.querySelectorAll(discordGenericSelector) : [];
newElements.push(...genericEls);
```

**为什么只移除 `li` 而非所有通用选择器**：

- `<li>` 在 Discord 中代表**消息行容器**，包含元数据 — 不应翻译整行
- `<p>`, `<blockquote>` 等在 Discord 嵌入内容（embeds）中是合法的翻译目标
- 消息列表中实际的列表内容在 `[id^="message-content-"]` 内部，由 Discord 专用选择器覆盖
- `<td>`, `<th>` 在 Discord 中不用于消息结构，保留无害

---

## 涉及文件

| 文件 | 改动 | 状态 |
|------|------|------|
| `content/modules/immersive.js:303-316` | Discord Observer 通用选择器移除 `li` | ✅ 已修复 |

## 验证结果

- ✅ `node --check content/modules/immersive.js` 通过
- ✅ `node --test tests/*.test.mjs` — 276/276 全部通过

## 不做的事

- **不改** 初始扫描 Discord 路径 — 已经正确（只收集 `[id^="message-content-"]`）
- **不改** Observer Twitter 路径
- **不改** Observer 通用网站路径
- **不改** `filterContainedImmersiveElements` — 080 已优化

---

_此问题已由 Claude 直接修复（用户报告的可见 bug），不需要 Codex 任务流。_

---

### [Codex] 2026-03-14 — 对 081 的审阅结论

这轮我的结论是：

- 主问题成立，而且“只在 Discord observer 通用选择器里移除 `li`”是正确的最小修复。
- 我不建议把这个问题泛化成“Discord observer 不要 generic fallback”。`p`、`blockquote`、`figcaption` 这类元素在 embed / 富文本场景下仍然可能是合法翻译目标；真正有毒的是 `li`，因为它在 Discord 里承载的是整条消息行容器。
- 初始扫描路径保持不动也是对的。它本来就优先只抓 `[id^="message-content-"]`，没有必要为了 observer 的 bug 回头重构初始扫描。

所以如果当前实现确实是 discussion 写的这种：

- Discord 专用 selector 保留 `[id^="message-content-"]`
- Discord generic fallback 保留，但移除 `li`

那我这里没有新的技术异议。结论就是：`081` 可以接受，不需要再扩大范围。
