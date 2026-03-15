---
status: done
priority: P2
created: 2026-03-14
---

# 073 — 沉浸式翻译 Discord 聊天内容支持

- 来源讨论: [discussions/073-immersive-discord-support.md](../discussions/073-immersive-discord-support.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/073-immersive-discord-support.md](../discussions/073-immersive-discord-support.md)（完整讨论记录 + Codex 审阅）

## 背景

Discord 聊天消息用 `<div id="message-content-{snowflake}">` 包裹，不匹配当前通用选择器列表中的任何元素。需要添加 Discord 专用路径，类似现有的 Twitter 路径。

Codex 审阅结论：
- 主方向成立，`[id^="message-content-"]` 是可接受的选择器
- 不接受单纯 `hostname.includes('discord.com')` — 会把非聊天页（support.discord.com、营销页）错误路由
- 必须保留通用 fallback：Discord 选择器找到消息就走专用路径，找不到就 fallback 到通用路径
- hostname 限定：`discord.com` / `ptb.discord.com` / `canary.discord.com`
- 文本长度门槛 2 合理
- 不碰注入方式

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | A1：`isDiscord` 域名检测 |
| `content/modules/immersive.js` | A2：`getImmersiveMinLength` 支持 Discord 消息元素 |
| `content/modules/immersive.js` | A3：初始扫描 Discord 路径 + 通用 fallback |
| `content/modules/immersive.js` | A4：Observer Discord 路径 + 通用 fallback |
| `tests/073-immersive-discord.test.mjs` | A5：回归测试 |

## 任务清单

### 必做

#### A1. `isDiscord` 域名检测

- [x] `immersive.js:61-62` — 在 `isTwitter` 检测之后添加 `isDiscord`：

  ```javascript
  /* 改后（在 isTwitter 之后） */
  const isTwitter = window.location.hostname.includes('twitter.com') ||
      window.location.hostname.includes('x.com');
  const isDiscord = window.location.hostname === 'discord.com' ||
      window.location.hostname === 'ptb.discord.com' ||
      window.location.hostname === 'canary.discord.com';
  ```

  行为说明：
  - 严格匹配三个 Discord 域名（聊天应用 + 测试版 + 金丝雀版）
  - `support.discord.com`、`status.discord.com` 等子域 **不匹配** → 走通用路径 ✓
  - `discord.com` 的营销/下载页匹配域名，但 A3 的 fallback 逻辑保证这些页面仍走通用路径

#### A2. `getImmersiveMinLength` 支持 Discord 消息元素

- [x] `immersive.js:15-19` — 在 helper 中加入 Discord 消息元素检测：

  ```javascript
  /* 改前 */
  function getImmersiveMinLength(el, isTwitter) {
      if (isTwitter) return 5;
      if (el.matches('h1, h2, h3, h4, h5, h6, li, td, th')) return 2;
      return 20;
  }

  /* 改后 */
  function getImmersiveMinLength(el, isTwitter) {
      if (isTwitter) return 5;
      if (el.matches('[id^="message-content-"], h1, h2, h3, h4, h5, h6, li, td, th')) return 2;
      return 20;
  }
  ```

  行为说明：
  - Discord 消息元素（`<div id="message-content-...">`) 匹配 `[id^="message-content-"]` → 门槛 2
  - 不修改函数签名 — 初始扫描和 Observer 复用同一 helper（071 要求）
  - 非 Discord 页面上不存在 `id^="message-content-"` 的元素，无副作用

#### A3. 初始扫描 Discord 路径 + 通用 fallback

- [x] `immersive.js:64-104` — 在 `isTwitter` 分支之后、通用路径之前，插入 Discord 尝试路径：

  ```javascript
  if (isTwitter) {
      // Twitter 专用选择器（现有代码，不修改）
      // ...
  } else {
      // Discord: 尝试专用选择器
      if (isDiscord) {
          const discordMessages = document.querySelectorAll('[id^="message-content-"]');
          if (discordMessages.length > 0) {
              paragraphs = Array.from(discordMessages).filter(el => {
                  if (el.querySelector('.st-immersive-translation')) return false;
                  if (el.isContentEditable) return false;
                  const text = el.innerText.trim();
                  if (text.length < getImmersiveMinLength(el, false)) return false;
                  if (ST.detectLanguage(text) === targetLang) return false;
                  return true;
              });
          }
      }

      // 通用 fallback（非 Discord，或 Discord 未找到消息元素）
      if (paragraphs.length === 0) {
          const selectors = [
              'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
              'li', 'td', 'th', 'blockquote',
              '.markdown-body p', '.markdown-body li',
              '.comment-body p', '.js-comment-body p'
          ].join(', ');

          paragraphs = Array.from(document.querySelectorAll(selectors))
              .filter(p => {
                  // ... 现有过滤逻辑，不修改 ...
              })
              .filter((el, index, arr) => {
                  // ... 现有去重逻辑，不修改 ...
              });
      }
  }
  ```

  行为说明：
  - **Discord 聊天页**（`discord.com/channels/...`）：`discordMessages.length > 0` → 走 Discord 过滤 → 翻译聊天消息 ✓
  - **Discord 非聊天页**（营销页、下载页）：`discordMessages.length === 0` → fallback 到通用路径 → 翻译页面段落 ✓
  - **`support.discord.com`**：`isDiscord = false` → 直接走通用路径 ✓
  - **非 Discord 站点**：`isDiscord = false` → 直接走通用路径 ✓
  - Discord 过滤不使用 EXCLUDE_SELECTORS — 消息内容不在 nav/header/footer 内，且 `[id^="message-content-"]` 已足够精确
  - Discord 过滤复用 `isContentEditable`（072 保护）和 `getImmersiveMinLength`（071 helper）

#### A4. Observer Discord 路径 + 通用 fallback

- [x] `immersive.js` Observer 部分 — `isDiscord` 变量需在 Observer 作用域内可用（与 `isTwitter` 同级定义），并在元素收集和过滤中添加 Discord 路径：

  **元素收集**（在 Observer 回调的 mutation 遍历中）：

  ```javascript
  if (isTwitter) {
      // Twitter（现有代码，不修改）
  } else if (isDiscord) {
      // Discord: 同时收集专用和通用元素
      const messages = node.querySelectorAll ?
          node.querySelectorAll('[id^="message-content-"]') : [];
      if (node.matches && node.matches('[id^="message-content-"]')) {
          newElements.push(node);
      }
      newElements.push(...messages);
      // 通用 fallback 元素也收集（支持 Discord 非聊天页的动态内容）
      const genericEls = node.querySelectorAll ?
          node.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote') : [];
      newElements.push(...genericEls);
  } else {
      // 通用（现有代码，不修改）
  }
  ```

  **过滤逻辑**不需要特殊修改 — 现有过滤链已处理：
  - `getImmersiveMinLength(el, isTwitter)` → Discord 消息元素匹配 `[id^="message-content-"]` → 门槛 2 ✓
  - `el.isContentEditable` → 保护编辑区域 ✓
  - `isExcludedByImmersiveContext(el)` → Discord 消息不在 EXCLUDE 祖先内 ✓
  - `el.querySelector('.st-immersive-translation')` → 去重 ✓

  **`isDiscord` 作用域**：`isDiscord` 需要在 `startMutationObserver` 函数内定义，与 `isTwitter`（`immersive.js:246-247`）同级。

#### A5. 回归测试

- [x] 新建 `tests/073-immersive-discord.test.mjs`，至少覆盖：
  1. **A1 — 域名检测**：`discord.com`、`ptb.discord.com`、`canary.discord.com` 匹配；`support.discord.com`、`other.com` 不匹配
  2. **A2 — `getImmersiveMinLength` 对 Discord 消息元素返回 2**：`<div id="message-content-123">` → 2；普通 `<div>` → 20
  3. **A3 — Discord 聊天页走专用路径**：页面有 `[id^="message-content-"]` 元素时，选中这些元素
  4. **A3 — Discord 非聊天页 fallback 到通用路径**：页面无 `[id^="message-content-"]` 元素时，选中 `<p>` 等通用元素
  5. **A3 — 非 Discord 站点不受影响**：通用路径行为不变
  6. **A4 — Observer 收集 Discord 消息元素**：模拟 mutation 添加含 `[id^="message-content-"]` 的节点

**不要做的事**：
- 不要修改 Twitter 路径 — 现有代码不变
- 不要修改 `injectTranslation` 注入逻辑 — 视觉样式问题留后续
- 不要修改 EXCLUDE_SELECTORS — 072 已处理
- 不要修改 `getImmersiveMinLength` 函数签名 — 保持 `(el, isTwitter)` 不变
- 不要碰 popup.js、selection.js、sidebar.js、float-window.js、content.js、utils.js、tts.js、options.js、floating-ball.js、ad-blocker.js、storage.js、translator.js、message-router.js、service-worker.js、offscreen.js、manifest.json、menus.js、popup.css、content.css

## 不做的事

- **不做** 修改注入方式 — 让现有 display 检测自动选择路径，视觉问题后续处理
- **不做** 修改 Twitter 路径
- **不做** 只靠 `hostname.includes('discord.com')` 检测 — 会误匹配非聊天域名
- **不做** 在 Discord 路径中添加 EXCLUDE_SELECTORS 检查 — `[id^="message-content-"]` 已足够精确

## 验证要求

- [x] `node --test tests/073-immersive-discord.test.mjs` 通过
- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `git diff --check` 无输出
