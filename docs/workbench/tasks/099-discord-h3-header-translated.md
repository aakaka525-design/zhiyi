---
task: "099"
status: done
priority: P2
created: 2026-03-15
scope: "Discord 聊天页 generic fallback 去掉 h1/h2/h3"
---

# 099 — Discord 消息头部 h3 被翻译

## 范围

新增 `DISCORD_CHAT_GENERIC_SELECTORS`（去掉 h1/h2/h3），只在 Discord 聊天页（`/channels`）使用。非聊天页保留 `DISCORD_GENERIC_SELECTORS`。

---

## 改动

**文件：`content/modules/immersive.js`**

### 1. 新增常量

在 `DISCORD_GENERIC_SELECTORS` 之后添加：

```javascript
const DISCORD_CHAT_GENERIC_SELECTORS = 'p, h4, h5, h6, td, th, blockquote, figcaption, dt, dd, caption';
```

### 2. 新增 `isDiscordChat` 判断

在三处 `isDiscord` 判断之后（`toggleImmersive`、`startMutationObserver`、`rescanUntranslatedElements`），添加：

```javascript
const isDiscordChat = isDiscord && window.location.pathname.startsWith('/channels');
```

### 3. rescan — 使用聊天页专用选择器

改前：

```javascript
} else if (isDiscord) {
    selectors = '[id^="message-content-"], ' + DISCORD_GENERIC_SELECTORS;
```

改后：

```javascript
} else if (isDiscord) {
    const discordGeneric = isDiscordChat ? DISCORD_CHAT_GENERIC_SELECTORS : DISCORD_GENERIC_SELECTORS;
    selectors = '[id^="message-content-"], ' + discordGeneric;
```

### 4. observer — 使用聊天页专用选择器

改前：

```javascript
} else if (isDiscord) {
    // ... [id^="message-content-"] 处理 ...
    if (node.matches && node.matches(DISCORD_GENERIC_SELECTORS)) {
        newElements.push(node);
    }
    const genericEls = node.querySelectorAll ?
        node.querySelectorAll(DISCORD_GENERIC_SELECTORS) : [];
    newElements.push(...genericEls);
```

改后：

```javascript
} else if (isDiscord) {
    // ... [id^="message-content-"] 处理不变 ...
    const discordGeneric = isDiscordChat ? DISCORD_CHAT_GENERIC_SELECTORS : DISCORD_GENERIC_SELECTORS;
    if (node.matches && node.matches(discordGeneric)) {
        newElements.push(node);
    }
    const genericEls = node.querySelectorAll ?
        node.querySelectorAll(discordGeneric) : [];
    newElements.push(...genericEls);
```

### 5. 初始扫描不动

Discord 初始扫描已只用 `[id^="message-content-"]`，不走 generic fallback。无需修改。

---

## 约束

1. **`DISCORD_GENERIC_SELECTORS` 常量不改**（保持原值）
2. **只移除 `h1/h2/h3`**，保留 `h4-h6`
3. **只在 `/channels` 路径下收窄**，非聊天 Discord 页面不受影响
4. **不改** `GENERIC_SELECTORS`
5. **不改** `[id^="message-content-"]` 选择器
6. **不处理** `hiddenVisually` 通用规则
7. **不碰** content.css、options.*、storage.js、popup.js

---

## 测试

**文件：`tests/099-discord-h3-header.test.mjs`**

### 静态断言

1. 源码包含 `DISCORD_CHAT_GENERIC_SELECTORS` 常量定义
2. `DISCORD_CHAT_GENERIC_SELECTORS` **不包含** `h1`、`h2`、`h3`
3. `DISCORD_CHAT_GENERIC_SELECTORS` **包含** `h4`、`h5`、`h6`
4. `DISCORD_GENERIC_SELECTORS` **仍包含** `h1`、`h2`、`h3`（未被修改）
5. 源码包含 `/channels` 路径判断

全量 `node --test tests/*.test.mjs` 必须通过。

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `content/modules/immersive.js` | 新增常量 + `isDiscordChat` + rescan/observer 选择器分支 |
| `tests/099-discord-h3-header.test.mjs` | 静态断言 |

## 完成情况

- [x] 新增 `DISCORD_CHAT_GENERIC_SELECTORS`
- [x] observer 在 Discord `/channels` 聊天页使用收窄后的 generic fallback
- [x] rescan 在 Discord `/channels` 聊天页使用收窄后的 generic fallback
- [x] 非聊天 Discord 页面保留原有 `DISCORD_GENERIC_SELECTORS`
- [x] 新增 `099` 测试并验证聊天页忽略 `h3`、非聊天页保留 `h3`
- [x] `/opt/homebrew/bin/node --test tests/*.test.mjs`
