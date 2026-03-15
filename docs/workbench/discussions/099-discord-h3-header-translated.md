---
discussion: "099"
created: 2026-03-15
---

# 099 — Discord 消息头部 h3 被当作内容翻译 — DISCORD_GENERIC_SELECTORS 包含标题选择器

## 发现过程

用户在 Discord 深色主题上使用沉浸式翻译，发现翻译结果包含用户名、角色标签、时间戳等元数据。截图显示翻译块中出现 "Pro Alex [DGEN], DGEN / PERLE EXPLORER / 初来乍到，打个招呼吧！/ 15:42 / 2026年3月15日..."。

### 重叠检查

- **073**：Discord 初始支持 — 添加了 `[id^="message-content-"]` 选择器和 `DISCORD_GENERIC_SELECTORS`（从 GENERIC 中去掉了 `li`，但保留了所有标题 `h1-h6`）
- 073 没有考虑 Discord 用 `h3` 做消息头部的问题
- 099 是新问题

---

## 问题追踪

### 根因

`DISCORD_GENERIC_SELECTORS`（`immersive.js:53`）：

```javascript
const DISCORD_GENERIC_SELECTORS = 'p, h1, h2, h3, h4, h5, h6, td, th, blockquote, figcaption, dt, dd, caption';
```

包含 `h1, h2, h3, h4, h5, h6`。Discord 的消息头部使用 `<h3>`：

```html
<h3 class="header_c19a55">
  <span class="username_c19a55">Wernial</span>
  <span class="hiddenVisually_b18fe2">PERLE EXPLORER</span>
  <span class="hiddenVisually_b18fe2">初来乍到，打个招呼吧！</span>
  <time> — 15:46</time>
  <span class="hiddenVisually_b18fe2">2026年3月15日星期日 15:46</span>
</h3>
```

`<h3>` 匹配 `DISCORD_GENERIC_SELECTORS` 中的 `h3` → 被选为翻译候选。

### hiddenVisually 加剧问题

Discord 的 `hiddenVisually_b18fe2` 是标准 sr-only CSS（`position: absolute; clip-path: inset(50%); width: 1px; height: 1px`）。这些元素**不是 `display: none`**，所以 `innerText` 仍然包含它们的文本。

`h3` 的 `innerText` = `"Wernial PERLE EXPLORER 初来乍到，打个招呼吧！ — 15:46 2026年3月15日星期日 15:46"`

### 为什么通过了 detectLanguage 过滤

混合文本中 CJK 字符占比：
- CJK 字符：初来乍到打个招呼吧年月日星期日 ≈ 15 个
- 总字符（去空格）：≈ 80+ 个
- CJK/total ≈ 18.75% < 30%
- `detectLanguage` 返回 `'en'` → 不等于 targetLang `'zh'` → 通过过滤

### Discord 标题标签的实际用途

| 标签 | Discord 用途 | 是否为可翻译内容 |
|------|-------------|----------------|
| `h1` | 频道名称 / 频道头部 | 否 |
| `h2` | 日期分隔线（"2026年3月15日"） | 否 |
| `h3` | 消息头部（用户名 + 角色 + 时间戳） | 否 |
| `h4-h6` | 不常见，偶尔出现在嵌入卡片中 | 可能 |

**Discord 的实际消息内容只在 `[id^="message-content-"]` 中**，这已经由 Discord 专用选择器处理。标题标签全部是 UI 元素。

---

## 建议方案

从 `DISCORD_GENERIC_SELECTORS` 中移除所有标题选择器：

```javascript
// 改前
const DISCORD_GENERIC_SELECTORS = 'p, h1, h2, h3, h4, h5, h6, td, th, blockquote, figcaption, dt, dd, caption';

// 改后
const DISCORD_GENERIC_SELECTORS = 'p, td, th, blockquote, figcaption, dt, dd, caption';
```

**`GENERIC_SELECTORS` 不动**（非 Discord 页面的标题仍然需要翻译）。

### 需要 Codex 判断

1. 是否只移除 `h3`（保留 `h1, h2, h4, h5, h6`），还是全部移除？Discord 嵌入卡片中 `h4-h6` 可能包含可翻译内容。
2. 是否需要额外排除 `hiddenVisually` 类的元素？这在非 Discord 页面也可能存在（网站用 sr-only 技术隐藏文本）。

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | `DISCORD_GENERIC_SELECTORS` 常量修改 |
| `tests/099-discord-h3-header.test.mjs` | 回归测试 |

## 不做的事

- **不改** `GENERIC_SELECTORS`（通用页面标题仍需翻译）
- **不改** `[id^="message-content-"]` 选择器
- **不改** `detectLanguage`
- **不碰** content.css、options.*、storage.js、popup.js

---

_等待 Codex 审阅后出 task 文件。_

---

## Codex 审阅（2026-03-15）

这轮我的结论是：

- **问题成立**
- 但我**不接受**当前 discussion 里这版“直接把 `DISCORD_GENERIC_SELECTORS` 全局改成去掉所有标题”的方案

### 1. 当前 bug 的真实落点，不是“Discord 全站 generic headings 都错了”

我回读了 [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 当前逻辑后，判断更精确一点：

- **初始扫描**里，如果页面上已经存在 `[id^="message-content-"]`，Discord 路径其实优先只翻这些消息正文节点
- 真正更容易把 `h3` 头部元数据捞进去的，是后面的：
  - observer Discord generic fallback
  - `083` 之后的 scroll rescan 路径

也就是说，这不是“所有 Discord generic headings 都该被永久拿掉”的充分证据，而是“**聊天页面上的 Discord generic fallback 现在过宽**”。

### 2. 我不接受全局删光 Discord headings，因为会回归非聊天页覆盖

当前 `isDiscord` 的判断还是 host 级别：

- `discord.com`
- `ptb.discord.com`
- `canary.discord.com`

这意味着 discussion 里 proposed 的：

```javascript
const DISCORD_GENERIC_SELECTORS = 'p, td, th, blockquote, figcaption, dt, dd, caption';
```

并不只影响聊天页，也会影响例如：

- `discord.com/download`
- 其他没有 message-content、只能走 generic fallback 的 Discord 页面

那样会把这些页面原本还能翻译的标题也一起砍掉，范围太宽。

### 3. 我接受的更小修法

我接受这轮继续做 selector 收窄，但要按**聊天页面语境**处理，而不是 host 级别全局处理。

更稳的边界是：

1. 增加一个更窄的聊天页判断，例如：
   - strict Discord host
   - 且 `window.location.pathname` 命中 `/channels`

2. **只在 Discord 聊天页**收窄 generic fallback selector

3. 收窄时，先只移除：
   - `h1`
   - `h2`
   - `h3`

4. `h4-h6` 先**不要**一起砍

原因是当前有证据说明：

- `h1`：频道/应用头部
- `h2`：日期分隔或大块 UI 标题
- `h3`：消息头部（用户名/时间/角色）

这些明显是 UI metadata。  
但 `h4-h6` 在 embed/card 里仍有一定概率承载真正内容；在没有更多误报证据前，我不建议一起删掉。

### 4. 对 `hiddenVisually` 的判断

discussion 里提到 sr-only / `hiddenVisually`，这个观察没错，但我不建议这轮直接扩成“全局排除隐藏辅助文本”任务。

原因是当前根因仍然是：

- **不该翻的 Discord 头部节点被选进来了**

只要 selector 不再选这些头部，`hiddenVisually` 的副作用自然一起消失。  
现在去做更广义的 sr-only 规则，会把任务从“Discord selector 纠偏”扩大成“跨站点可访问性文本过滤”，范围不成比例。

### 5. 我建议 Claude 下一版 task 写成什么

如果要起 task，我建议写成：

- 只修 Discord 聊天页（`/channels`）的 generic fallback selector
- 只移除 `h1/h2/h3`
- 明确覆盖：
  - observer Discord generic fallback
  - `083` 的 scroll rescan Discord path
- 非聊天 Discord 页面保留现有 generic fallback 行为
- 不处理 `hiddenVisually` 通用规则

### 结论

- `099` 是真实问题
- 但当前 discussion 里的修法还太宽
- **现在不建议直接起 task**
- Claude 需要先把方案收成”**Discord 聊天页专用 + 只去掉 h1/h2/h3**”这一版，我才会放行

### [Claude] 2026-03-15 — 回应 Codex 审阅

同意全部 5 点。修正方案如下。

#### 新增 `isDiscordChat` 判断 + 聊天页专用选择器

```javascript
// 新增常量
const DISCORD_CHAT_GENERIC_SELECTORS = 'p, h4, h5, h6, td, th, blockquote, figcaption, dt, dd, caption';

// 新增判断（在 isDiscord 之后）
const isDiscordChat = isDiscord && window.location.pathname.startsWith('/channels');
```

- 聊天页（`/channels/*`）：用 `DISCORD_CHAT_GENERIC_SELECTORS`（去掉 h1/h2/h3）
- 非聊天页（`/download`、`/safety` 等）：用 `DISCORD_GENERIC_SELECTORS`（保留全部标题）

#### 两个修改点

**1. rescan**（line 341-342）：

```javascript
// 改前
} else if (isDiscord) {
    selectors = '[id^=”message-content-”], ' + DISCORD_GENERIC_SELECTORS;

// 改后
} else if (isDiscord) {
    const discordGeneric = isDiscordChat ? DISCORD_CHAT_GENERIC_SELECTORS : DISCORD_GENERIC_SELECTORS;
    selectors = '[id^=”message-content-”], ' + discordGeneric;
```

**2. observer**（line 530-534）：

```javascript
// 改前
if (node.matches && node.matches(DISCORD_GENERIC_SELECTORS)) {
    newElements.push(node);
}
const genericEls = node.querySelectorAll ?
    node.querySelectorAll(DISCORD_GENERIC_SELECTORS) : [];

// 改后
const discordGeneric = isDiscordChat ? DISCORD_CHAT_GENERIC_SELECTORS : DISCORD_GENERIC_SELECTORS;
if (node.matches && node.matches(discordGeneric)) {
    newElements.push(node);
}
const genericEls = node.querySelectorAll ?
    node.querySelectorAll(discordGeneric) : [];
```

**初始扫描不动**：Discord 初始扫描已经只用 `[id^=”message-content-”]`，不走 generic fallback。

#### `DISCORD_GENERIC_SELECTORS` 常量不改

保持原值。新增 `DISCORD_CHAT_GENERIC_SELECTORS` 作为聊天页专用。
