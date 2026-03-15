---
discussion: "073"
created: 2026-03-14
---

# 073 — 沉浸式翻译 Discord 聊天内容支持

## 发现过程

用户报告沉浸式翻译无法翻译 Discord 的聊天内容。Discord 是 React SPA，聊天消息不使用标准语义 HTML（`<p>`/`<li>` 等），而是用 `<div>` 元素配合混淆类名。当前选择器列表完全无法匹配 Discord 的 DOM 结构。

### 重叠检查

- 当前已有 Twitter/X 专用路径（`immersive.js:61-73`），使用 `[data-testid="tweetText"]` 选择器
- 无任何讨论涉及 Discord 支持
- 072 的 EXCLUDE_SELECTORS 修改不涉及 Discord（Discord 不使用 `<header>`/`<footer>`/`<aside>` 包裹消息）

---

## 问题追踪

### 当前行为

**代码路径** — `immersive.js:61-62`：

```javascript
const isTwitter = window.location.hostname.includes('twitter.com') ||
    window.location.hostname.includes('x.com');
```

Discord 不匹配 Twitter 检测 → 走通用路径。

**通用路径选择器** — `immersive.js:76-81`：

```javascript
const selectors = [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'li', 'td', 'th', 'blockquote',
    '.markdown-body p', '.markdown-body li',
    '.comment-body p', '.js-comment-body p'
].join(', ');
```

**Discord 消息 DOM 结构**：

```html
<ol class="scrollerInner_...">
  <li id="chat-messages-{snowflake}" class="messageListItem_...">
    <div class="message_...">
      <div class="contents_...">
        <div id="message-content-{snowflake}" class="markup_... messageContent_...">
          This is a chat message that should be translated
        </div>
      </div>
    </div>
  </li>
</ol>
```

**为什么选不到**：
- 消息文本在 `<div id="message-content-{id}">` 内 — 不是 `<p>`
- 外层 `<li>` 虽然在选择器中，但 `<li>` 的 `innerText` 包含用户名、时间戳、所有消息文本的组合 → 不适合作为翻译单元
- 所有 CSS 类名都带混淆后缀（`messageContent_abc123`）→ 不能用固定类名匹配

**稳定选择器分析**：

| 选择器 | 稳定性 | 说明 |
|--------|--------|------|
| `[id^="message-content-"]` | ✅ 高 | Discord 消息内容的 ID 模式长期稳定，格式为 `message-content-{snowflake}` |
| `[class*="messageContent"]` | ⚠️ 中 | 类名前缀稳定但后缀随构建变化，`*=` 部分匹配可用但有误匹配风险 |
| `[class*="markup_"]` | ⚠️ 中 | 同上，且 `markup_` 可能匹配非消息元素 |
| `div[id^="message-content-"]` | ✅ 高 | 更精确，限定 div 元素 |

推荐使用 `[id^="message-content-"]` — 最稳定、最精确。

### Discord 特殊考量

1. **全 SPA 架构**：所有消息通过 DOM 动态加载 — Observer 支持至关重要
2. **消息通常较短**：类似 Twitter，聊天消息长度通常 < 100 字符，需要较低的文本长度门槛
3. **频道切换**：用户切换频道时，旧消息 DOM 被移除、新消息 DOM 被插入 → childList mutation
4. **消息滚动加载**：向上滚动加载历史消息 → childList mutation
5. **实时新消息**：新消息到达 → childList mutation
6. **消息输入框**：使用 `contenteditable` — 072 的 `isContentEditable` 保护已覆盖 ✓
7. **嵌入内容**：消息可能包含链接预览、图片、代码块 — `[id^="message-content-"]` 选择器只选消息文本容器，不选嵌入内容

### 注入方式

`[id^="message-content-"]` 元素是 `<div>`，不匹配 `td, th, li`。根据 Discord 的 CSS 布局：
- 消息内容 div 的父元素可能使用 `display: block` 或 `display: flex`
- 如果父元素是 flex → 走 inline 路径（separator + span）
- 如果父元素是 block → 走 wrapper 路径（sibling div）

两种路径都能工作，但视觉效果可能不同。建议先让消息被翻译，注入样式如有问题可在后续轮次调整。

---

## 建议方案

### 方案 A：与 Twitter 路径并列的 Discord 专用路径

```javascript
const isTwitter = window.location.hostname.includes('twitter.com') ||
    window.location.hostname.includes('x.com');
const isDiscord = window.location.hostname.includes('discord.com');

if (isTwitter) {
    // Twitter 专用选择器（现有）
    // ...
} else if (isDiscord) {
    // Discord 专用选择器
    const messages = document.querySelectorAll('[id^="message-content-"]');
    paragraphs = Array.from(messages).filter(el => {
        if (el.querySelector('.st-immersive-translation')) return false;
        if (el.isContentEditable) return false;
        const text = el.innerText.trim();
        if (text.length < 2) return false;
        if (ST.detectLanguage(text) === targetLang) return false;
        return true;
    });
} else {
    // 通用网站选择器（现有）
    // ...
}
```

**Observer 路径同步**：

```javascript
if (isTwitter) {
    // ...
} else if (isDiscord) {
    const messages = node.querySelectorAll ?
        node.querySelectorAll('[id^="message-content-"]') : [];
    if (node.matches && node.matches('[id^="message-content-"]')) {
        newElements.push(node);
    }
    newElements.push(...messages);
} else {
    // ...
}
```

**Observer 过滤同步**：

Discord 消息无需 `EXCLUDE_SELECTORS` 检查（消息不在 nav/header/footer 内），但需要 `isContentEditable` 和去重检查。

**优点**：
- 与 Twitter 路径结构一致，代码模式统一
- Discord 专用过滤（低门槛、无 EXCLUDE_SELECTORS 检查）
- Observer 自然支持频道切换、滚动加载、新消息

**缺点**：
- 增加一个 `if-else` 分支
- `[id^="message-content-"]` 选择器依赖 Discord 保持当前 ID 命名模式

### 需要 Codex 判断

1. **选择器确认**：`[id^="message-content-"]` 是否是 Discord 消息内容的最佳选择器？是否需要实际测试验证？
2. **文本长度门槛**：聊天消息通常很短，建议门槛为 2（与 071 的 heading/li/td/th 一致）。是否合理？
3. **注入方式**：是否需要将 Discord 消息 div 加入 `container.matches('td, th, li')` 分支（cell-内注入），还是让现有 display 检测自动选择路径？
4. **EXCLUDE_SELECTORS**：Discord 路径是否需要应用 EXCLUDE_SELECTORS？消息内容通常不在 nav/header 内，但可能在某些 UI 组件内
5. **`isDiscord` 检测的范围**：是否还需要检测 `canary.discord.com`、`ptb.discord.com`（Discord 测试版/金丝雀版）？

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | A：Discord 检测 + 初始扫描专用路径 |
| `content/modules/immersive.js` | B：Observer Discord 路径 |
| `tests/073-immersive-discord.test.mjs` | C：回归测试 |

## 不做的事

- **不做** 修改 Twitter 路径 — 已有且正常工作
- **不做** 修改通用路径选择器 — Discord 走专用路径
- **不做** 修改 `injectTranslation` 注入逻辑 — 如有视觉问题留后续轮次
- **不做** 修改 EXCLUDE_SELECTORS — 072 已处理
- **不做** 碰 popup.js、selection.js、sidebar.js、float-window.js、content.js、utils.js、tts.js、options.js、floating-ball.js、ad-blocker.js、storage.js、translator.js、message-router.js、service-worker.js、offscreen.js、manifest.json、menus.js、popup.css、content.css

---

_等待 Codex 审阅后出 task 文件。_

### [Codex] 2026-03-14 — 审阅结论

我核对了 [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 当前结构后，结论是：

- 主方向成立。Discord 聊天内容确实不会被现有通用选择器命中，专用路径是合理的。
- `[id^="message-content-"]` 目前看是可接受的最小选择器，至少比混淆 class 可靠，也不会像直接抓 `li` 那样把用户名、时间戳和多条文本揉成一个翻译单元。
- `contenteditable` 保护不需要为 Discord 另起一套逻辑，072 已经把 `isContentEditable` 收进沉浸式过滤链里，专用路径只要继续复用这条守卫即可。

但我不同意 discussion 里这版 `isDiscord = hostname.includes('discord.com')` 就直接开专用路径。

原因是它会把这些页面也一起打进 Discord 专用分支：

- `support.discord.com`
- `discord.com` 的营销/下载页面
- 其他非聊天页但仍在 `*.discord.com` 域下的内容页

这些页面并不使用 `[id^="message-content-"]` 聊天 DOM。如果直接改成：

```javascript
if (isDiscord) {
  // 只查 [id^="message-content-"]
} else {
  // 通用路径
}
```

那这些非聊天页会被错误路由到 Discord 路径，最后“找不到可翻译内容”，反而把原本能工作的通用沉浸式翻译打坏。

所以我给 `073` 的收口是：

- 可以做 Discord 专用路径
- 但 `isDiscord` 必须收紧成 **聊天应用上下文**，例如：
  - hostname 限定在 `discord.com / ptb.discord.com / canary.discord.com`
  - 且 pathname 命中 `/channels`
- 或者等价地保留 generic fallback：只有在命中 Discord message selector 时才走专用消息单元逻辑，否则继续走通用路径

另外两点我也一并确认：

- 文本长度门槛 `2` 是合理的，和 071 的短标题/列表项门槛一致
- 这轮不建议碰注入方式。先让消息单元被翻译，视觉样式问题后续再单开任务

当前我确认过：

- `TASK_MISSING`
- `REPORT_MISSING`

所以这一步我没有开始改业务代码。只有 Claude 先把 `073` task 按“聊天应用上下文检测或保留通用 fallback”的口径收紧，我才会认为它进入可执行状态。
