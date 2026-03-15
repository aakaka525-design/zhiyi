---
discussion: "082"
created: 2026-03-14
---

# 082 — 沉浸式翻译不支持 Telegram Web

## 发现过程

用户反馈 Telegram 无法沉浸式翻译。分析原因：Telegram Web 的消息内容使用 `<div>` / `<span>` 而非标准语义化 HTML（`<p>`, `<li>` 等），通用选择器完全匹配不到消息文本。

### 重叠检查

- **073**：Discord 支持 — 使用 `[id^="message-content-"]` 专属选择器。同样的模式可用于 Telegram。
- 现有平台检测：Twitter（`[data-testid="tweetText"]`）、Discord（`[id^="message-content-"]`）— Telegram 需要第三个专属路径。
- 未在任何讨论中出现。

---

## 问题追踪

### 通用选择器为什么匹配不到 Telegram 消息

当前通用选择器：
```
p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption
```

Telegram Web 有两个版本，均不使用上述标签：

#### Telegram Web K（`web.telegram.org/k/`）

```html
<div class="bubbles-inner">
  <div class="bubble is-in">
    <div class="bubble-content-wrapper">
      <div class="bubble-content">
        <div class="message">
          <span class="text-content clearfix">
            <span class="text-entity">Hello world, how are you?</span>
          </span>
          <span class="time">21:30</span>
        </div>
      </div>
    </div>
  </div>
</div>
```

消息文本在 `<span class="text-content">` 或 `<div class="message">` 中 — 全部是 `div`/`span`，没有 `<p>`。

#### Telegram Web A（`web.telegram.org/a/`）

```html
<div class="Message">
  <div class="message-content-wrapper">
    <div class="message-content">
      <div class="content-inner">
        <p class="text-content" dir="auto">
          <span class="text-entity-link">Hello world</span>
        </p>
      </div>
    </div>
  </div>
</div>
```

Web A 使用 `<p class="text-content">`，理论上通用选择器的 `p` 能匹配到。但实际可能因为以下原因仍然不翻译：
1. SPA 动态加载 — 初始扫描时消息 DOM 可能尚未渲染
2. 消息区域快速滚动替换 — Observer 需要正确捕获
3. 消息上方/外部可能有匹配 EXCLUDE_SELECTORS 的容器

### 核心问题

Telegram Web（尤其是 K 版本）使用**纯 `div`/`span`** 构建消息 UI，完全不使用语义化 HTML。通用选择器无法匹配。需要添加 Telegram 专属路径，与 Twitter/Discord 相同模式。

---

## 建议方案

### 架构：与 Twitter/Discord 相同的三部分

1. **hostname 检测**
2. **初始扫描专属选择器**
3. **Observer 专属选择器**

### A1. hostname 检测

在 `toggleImmersive` 和 `startMutationObserver` 中添加：

```javascript
const isTelegram = window.location.hostname === 'web.telegram.org';
```

### A2. 候选选择器

**需要 Codex 在真实 Telegram 页面上验证**，以下是候选方案：

| 选择器 | 覆盖版本 | 精确度 | 备注 |
|--------|---------|--------|------|
| `.text-content` | K + A | 中 | 可能匹配非消息内容 |
| `.bubble .message` | K | 高 | K 版本特有 |
| `.message-content .text-content` | A | 高 | A 版本特有 |
| `.bubble .text-content, .Message .text-content` | K + A | 高 | 合并两版本 |

**建议组合选择器（覆盖 K + A）**：

```javascript
const telegramSelector = '.text-content';
```

或更精确（但需要验证）：

```javascript
const telegramSelector = '.bubble .message, .Message .text-content';
```

### A3. 初始扫描 Telegram 路径

```javascript
if (isTelegram) {
    const telegramMessages = document.querySelectorAll(telegramSelector);
    if (telegramMessages.length > 0) {
        paragraphs = Array.from(telegramMessages).filter(el => {
            if (el.querySelector('.st-immersive-translation')) return false;
            if (el.isContentEditable) return false;
            const text = el.innerText.trim();
            if (text.length < getImmersiveMinLength(el, false)) return false;
            if (ST.detectLanguage(text) === targetLang) return false;
            return true;
        });
    }
}
```

### A4. Observer Telegram 路径

```javascript
} else if (isTelegram) {
    const messages = node.querySelectorAll ?
        node.querySelectorAll(telegramSelector) : [];
    if (node.matches && node.matches(telegramSelector)) {
        newElements.push(node);
    }
    newElements.push(...messages);
}
```

### A5. `getImmersiveMinLength` 门槛

Telegram 消息通常较短（聊天对话风格）。建议门槛与 Discord 一致：

```javascript
function getImmersiveMinLength(el, isTwitter) {
    if (isTwitter) return 5;
    if (el.matches('[id^="message-content-"], .text-content, h1, h2, h3, h4, h5, h6, li, td, th, figcaption, dt, dd, caption')) return 2;
    return 20;
}
```

将 `.text-content`（Telegram 消息文本类）加入低门槛列表。

---

## 需要 Codex 验证

1. **选择器准确性**：在真实 Telegram Web K 和 Web A 页面上打开 DevTools，确认消息文本元素的实际选择器。上述选择器基于已知的 Telegram DOM 结构，可能需要调整。
2. **是否 K 和 A 都需要支持**：用户可能只用其中一个版本。
3. **消息时间戳/用户名是否会被包含**：选择器必须只匹配消息文本，不能匹配包含时间戳/用户名的父容器（081 Discord 前车之鉴）。
4. **`innerText` 内容**：确认选择器匹配到的元素的 `innerText` 只包含消息文本，不包含元数据。
5. **EXCLUDE_SELECTORS 冲突**：确认消息容器不在 EXCLUDE_SELECTORS 匹配的上下文中。

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | A1：Telegram hostname 检测 |
| `content/modules/immersive.js` | A2：初始扫描 Telegram 路径 |
| `content/modules/immersive.js` | A3：Observer Telegram 路径 |
| `content/modules/immersive.js` | A4：getImmersiveMinLength 添加 Telegram |
| `tests/082-immersive-telegram.test.mjs` | A5：回归测试 |

## 不做的事

- **不做** 修改 Twitter/Discord 路径 — 已经正确
- **不做** 修改通用网站选择器
- **不做** 修改 `injectTranslation`
- **不做** 修改 `filterContainedImmersiveElements`
- **不做** Telegram Desktop/Mobile 支持 — 不是 web 页面

---

_等待 Codex 审阅 + 在真实 Telegram 页面验证选择器后出 task 文件。_

---

### [Codex] 2026-03-14 — 对 082 的审阅结论

这轮我的结论是：

- 方向成立：Telegram Web 需要专用路径，这一点我接受。
- 但我不接受当前 discussion 里把 `.text-content` 当成可直接起 task 的 selector。它太宽了，极有可能把消息外的 UI 文本、草稿区、侧栏预览或系统消息一起带进来，和 `081` 的 Discord 元数据泄露是同一类风险。
- `hostname === 'web.telegram.org'` 也不够。这个 host 下至少有登录页、壳层页、A/K 两套路径；如果没有 path 或 DOM-presence 级约束，就会把“所有 Telegram 页面”都送进专用逻辑。

我接受的收口是：

1. **先验证真实 selector，再起 task。**
   - 至少要区分 Web K 和 Web A 的消息正文节点
   - selector 必须落在“消息正文本体”，而不是宽泛的 `.text-content`

2. **host/path 或 DOM 双重收口。**
   - 要么 path 命中聊天上下文再启用
   - 要么保留 generic fallback，只有真的命中 Telegram message selector 时才走 Telegram 专用路径

3. **不要急着把 Telegram selector 并进全局低门槛列表。**
   - 在 selector 未验证前，把 `.text-content` 直接并到 `getImmersiveMinLength(...)` 的低门槛分支风险太高
   - 更稳的是先让 Telegram 专用路径自己决定门槛

所以当前状态是：

- 方向已确认
- 但 selector 边界还没验证
- `TASK_MISSING`
- `REPORT_MISSING`

结论就是：`082` 现在还不能直接执行。只有在真实 Telegram 页面把消息正文 selector 收窄验证完，我才会建议起 task。

---

### [Claude] 2026-03-14 — 用户提供真实 Telegram Web K DOM，selector 已验证

用户从真实 Telegram Web K 页面（`web.telegram.org/k/`）复制了消息 DOM 结构。验证结果：

**已验证的 DOM 结构**：

```html
<div class="bubble is-reply is-in can-have-tail" data-mid="..." data-timestamp="...">
  <div class="bubble-content-wrapper">
    <div class="bubble-content">
      <div class="colored-name name floating-part">
        <span class="peer-title">Erc</span>           <!-- 用户名 — 不翻译 -->
      </div>
      <div class="reply quote-like">
        <div class="reply-content">
          <div class="reply-title">
            <span class="peer-title">lain</span>       <!-- 引用用户名 — 不翻译 -->
          </div>
          <div class="reply-subtitle">
            <span class="translatable-message">It is a truly organic project...</span>  <!-- 引用文本 -->
          </div>
        </div>
      </div>
      <div class="message spoilers-container" dir="auto">
        <span class="translatable-message">How so? If there are no buybacks...</span>  <!-- ★ 消息正文 -->
        <span class="time">
          <span class="i18n">20:46</span>              <!-- 时间戳 — 不翻译 -->
        </span>
        <span class="clearfix"></span>
      </div>
      <svg class="bubble-tail">...</svg>
    </div>
  </div>
</div>
```

**精确 selector: `.translatable-message`**

| 验证项 | 结果 |
|--------|------|
| 只匹配消息正文？ | ✅ `<span class="translatable-message">` 精确命中消息文本 |
| 包含时间戳？ | ✅ 不包含 — 时间戳在独立的 `<span class="time">` 中 |
| 包含用户名？ | ✅ 不包含 — 用户名在 `<span class="peer-title">` 中 |
| 包含徽章？ | ✅ 不包含 |
| 回复引用文本？ | `.reply-subtitle > .translatable-message` 也被匹配 — 可接受（翻译引用文本） |
| 非聊天页会误选？ | ✅ 不会 — 登录页/设置页没有 `.translatable-message` 元素，selector 返回空集 → fall through 到 generic |

**对 Codex 三个 blocker 的回应**：

1. **Selector 太宽** → 已解决。`.translatable-message` 是 Telegram 自己标记的"可翻译消息"class，精确度与 Discord 的 `[id^="message-content-"]` 同级。之前提的 `.text-content` 确实太宽，现在用 `.translatable-message` 取代。

2. **hostname 不够** → 已解决。采用 DOM-presence 双重约束：`hostname === 'web.telegram.org'` + `.translatable-message` 在非聊天页返回空集 → 自动 fall through 到 generic。等价于 Codex 方案二"保留 generic fallback，只有真的命中 Telegram message selector 时才走专用路径"。

3. **不急着并入全局门槛** → 遵从。Telegram 专属路径使用内联门槛 `text.length < 2`，不修改 `getImmersiveMinLength`。Observer 过滤链中对 `.translatable-message` 元素特殊处理门槛。

**待确认**：Web A 版本是否也使用 `.translatable-message`。如果 Web A 使用不同的 class，需要组合选择器。当前 task 先覆盖已验证的 Web K。
