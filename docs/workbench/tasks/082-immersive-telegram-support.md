---
status: done
priority: P2
created: 2026-03-14
---

# 082 — 沉浸式翻译支持 Telegram Web

- 来源讨论: [discussions/082-immersive-telegram-support.md](../discussions/082-immersive-telegram-support.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/082-immersive-telegram-support.md](../discussions/082-immersive-telegram-support.md)（完整讨论记录 + Codex 审阅 + 真实 DOM 验证）

## 背景

Telegram Web K 的消息内容使用 `<div>` / `<span>` 而非 `<p>` 等语义化标签，通用选择器无法匹配。用户在真实 Telegram 页面验证了 DOM 结构，精确 selector 为 **`.translatable-message`**。

Codex 审阅结论：
- 方向接受：Telegram 需要专用路径
- `.text-content` 太宽，已替换为已验证的 `.translatable-message`
- hostname + DOM-presence 双重约束（非聊天页 selector 返回空集 → fall through）
- 不修改 `getImmersiveMinLength`，Telegram 路径自行管理门槛

## 已验证的 DOM 结构（Telegram Web K）

```html
<div class="message spoilers-container" dir="auto">
  <span class="translatable-message">消息正文文本</span>    ← 精确目标
  <span class="time"><span class="i18n">20:46</span></span> ← 不翻译
  <span class="clearfix"></span>
</div>
```

`.translatable-message` 精确命中消息正文，不包含时间戳/用户名/徽章。回复引用的文本也带此 class（`.reply-subtitle > .translatable-message`），会一并翻译。

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | A1：Telegram hostname 检测 |
| `content/modules/immersive.js` | A2：初始扫描 Telegram 路径 |
| `content/modules/immersive.js` | A3：Observer Telegram 路径 |
| `content/modules/immersive.js` | A4：Observer 过滤链 Telegram 门槛 |
| `tests/082-immersive-telegram.test.mjs` | A5：回归测试 |

## 任务清单

### 必做

#### A1. Telegram hostname 检测

- [x] 在 `toggleImmersive` 中（`isDiscord` 定义之后，约 line 79）添加：

  ```javascript
  const isTelegram = window.location.hostname === 'web.telegram.org';
  ```

- [x] 在 `startMutationObserver` 中（`isDiscord` 定义之后，约 line 280）添加同样的检测：

  ```javascript
  const isTelegram = window.location.hostname === 'web.telegram.org';
  ```

#### A2. 初始扫描 Telegram 路径

- [x] 在 Discord 检测块之后、`if (paragraphs.length === 0)` 之前（约 line 104），添加 Telegram 检测：

  ```javascript
  /* 在 Discord 块的 } 之后 */

  if (isTelegram && paragraphs.length === 0) {
      const telegramMessages = document.querySelectorAll('.translatable-message');
      if (telegramMessages.length > 0) {
          paragraphs = Array.from(telegramMessages).filter(el => {
              if (el.querySelector('.st-immersive-translation')) return false;
              if (el.isContentEditable) return false;
              const text = el.innerText.trim();
              if (text.length < 2) return false;
              if (ST.detectLanguage(text) === targetLang) return false;
              return true;
          });
      }
  }

  if (paragraphs.length === 0) {
      // 通用网站选择器（已有代码）
  ```

  行为说明：
  - 使用 `.translatable-message` 精确匹配 Telegram 消息正文
  - 内联门槛 `text.length < 2`（不修改 `getImmersiveMinLength`）
  - 如果 `.translatable-message` 找不到（登录页、设置页），`paragraphs` 仍为空 → fall through 到 generic 路径
  - 不调用 `getComputedStyle` — Telegram 消息都是可见的
  - 不调用 `isExcludedByImmersiveContext` — `.translatable-message` 精确定位，无需排除检查

#### A3. Observer Telegram 路径

- [x] 在 Observer 回调的 Discord 分支之后、generic `else` 之前（约 line 318），添加 Telegram 分支：

  ```javascript
  } else if (isTelegram) {
      const messages = node.querySelectorAll ?
          node.querySelectorAll('.translatable-message') : [];
      if (node.matches && node.matches('.translatable-message')) {
          newElements.push(node);
      }
      newElements.push(...messages);
  } else {
  ```

  行为说明：
  - 只收集 `.translatable-message`，不收集通用元素
  - 避免 081 Discord `<li>` 元数据泄露的同类问题
  - Telegram 的 `.bubble` 容器不会被误选

#### A4. Observer 过滤链 Telegram 门槛

- [x] Observer 过滤链中（约 line 330），`getImmersiveMinLength` 调用对 `.translatable-message` 返回 20（因为它是 `<span>`，不在匹配列表中）。需要为 Telegram 消息特殊处理门槛。

  将 Observer 过滤链中的门槛检查：

  ```javascript
  /* 改前 */
  if (text.length < getImmersiveMinLength(el, isTwitter)) return false;

  /* 改后 */
  const minLen = (isTelegram && el.matches('.translatable-message')) ? 2 : getImmersiveMinLength(el, isTwitter);
  if (text.length < minLen) return false;
  ```

  行为说明：
  - 仅在 Telegram 页面 + 元素为 `.translatable-message` 时使用门槛 2
  - 其他情况走 `getImmersiveMinLength` 原有逻辑
  - 不修改 `getImmersiveMinLength` 函数本身 — 遵循 Codex 指示

#### A5. 回归测试

- [x] 新建 `tests/082-immersive-telegram.test.mjs`，至少覆盖：
  1. **A1 — hostname 检测**：静态断言 `immersive.js` 包含 `web.telegram.org` hostname 检测
  2. **A2 — 初始扫描使用 `.translatable-message`**：模拟 Telegram hostname + `.translatable-message` 元素，确认被正确收集
  3. **A2 — 非聊天页 fall through**：模拟 Telegram hostname 但无 `.translatable-message` 元素，确认 fall through 到 generic 路径
  4. **A3 — Observer 收集 `.translatable-message`**：模拟 Observer addedNodes 包含 `.translatable-message`，确认被收集
  5. **A3 — Observer 不收集通用元素**：模拟 Telegram hostname，确认 Observer 不额外收集 `<p>`、`<li>` 等
  6. **A4 — 短消息不被过滤**：模拟 `.translatable-message` 元素文本长度 3（如 "Hi!"），确认通过门槛检查
  7. **A4 — 非 Telegram 页面不受影响**：确认非 Telegram hostname 的 `<span>` 元素仍使用默认门槛 20

**不要做的事**：
- 不要修改 `getImmersiveMinLength` 函数 — Codex 明确要求 Telegram 路径自行管理门槛
- 不要修改 Twitter/Discord 路径
- 不要修改通用网站选择器
- 不要修改 `injectTranslation`
- 不要修改 `filterContainedImmersiveElements`
- 不要添加通用元素 fallback 到 Telegram Observer — 只收集 `.translatable-message`
- 不要碰 popup.js、selection.js、sidebar.js、float-window.js、content.js、utils.js、tts.js、options.js、floating-ball.js、ad-blocker.js、storage.js、translator.js、message-router.js、service-worker.js、offscreen.js、manifest.json、menus.js、popup.css、content.css

## 不做的事

- **不做** Telegram Web A 专属支持 — 当前只验证了 Web K。如果 Web A 也用 `.translatable-message`，此 task 自动覆盖；如果不是，后续单独起 task
- **不做** 修改 `getImmersiveMinLength` — Codex 指示 Telegram 路径自行管理门槛
- **不做** 修改 `injectTranslation` — 当前注入路径对 `<span>` 走 inline path，可接受
- **不做** Telegram Desktop/Mobile — 不是 web 页面

## 验证要求

- [x] `node --test tests/082-immersive-telegram.test.mjs` 通过
- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check content/modules/immersive.js` 通过
- [x] `git diff --check` 无输出
