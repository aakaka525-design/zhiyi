---
status: done
priority: P2
created: 2026-03-14
---

# 071 — 沉浸式翻译短文本过滤：共享门槛 helper + 初始/Observer 同步

- 来源讨论: [discussions/071-immersive-coverage-short-text-hidden-elements.md](../discussions/071-immersive-coverage-short-text-hidden-elements.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/071-immersive-coverage-short-text-hidden-elements.md](../discussions/071-immersive-coverage-short-text-hidden-elements.md)（完整讨论记录 + Codex 审阅）

## 背景

沉浸式翻译使用固定的 `text.length < 20` 门槛过滤短文本（`immersive.js:74`），导致短标题（如 "FAQ"、"Getting Started"）和短列表项（如 "Key concepts"、"Summary"）被静默跳过。070 修复了 `li` 注入位置后，列表中的翻译空洞变得更加明显 — 部分列表项有翻译、部分没有，用户不知道为什么。

Codex 审阅结论：
- 不接受全局降到 5 — 会把短导航项/目录项一起带进翻译面
- 抽共享 helper `getImmersiveMinLength(el, isTwitter)`，按元素类型分层门槛
- 初始扫描和 Observer 必须复用同一 helper，不能分两套数字
- B（隐藏元素变可见后不翻译）不进本轮，单独起 task

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | A1：新增 `getImmersiveMinLength` helper |
| `content/modules/immersive.js` | A2：初始扫描 Twitter 路径调用 helper |
| `content/modules/immersive.js` | A3：初始扫描通用路径调用 helper |
| `content/modules/immersive.js` | A4：Observer 过滤路径调用 helper |
| `tests/071-immersive-coverage.test.mjs` | A5：回归测试 |

## 任务清单

### 必做

#### A1. 新增 `getImmersiveMinLength` helper

- [x] 在 `immersive.js` 模块作用域（`EXCLUDE_SELECTORS` 定义之后、`ST.toggleImmersive` 之前）新增：

  ```javascript
  /**
   * 根据元素类型返回沉浸式翻译的最小文本长度门槛
   * @param {Element} el 目标元素
   * @param {boolean} isTwitter 是否 Twitter/X 页面
   * @returns {number}
   */
  function getImmersiveMinLength(el, isTwitter) {
      if (isTwitter) return 5;
      if (el.matches('h1, h2, h3, h4, h5, h6, li, td, th')) return 2;
      return 20;  // p, blockquote 等
  }
  ```

  行为说明：
  - **Twitter 元素**（`[data-testid="tweetText"]`）：门槛 5，与当前行为一致
  - **h1-h6**：门槛 2 — "FAQ"（3 字符）、"Getting Started"（15 字符）等短标题不再被跳过
  - **li**：门槛 2 — "Key concepts"（12 字符）、"Summary"（7 字符）等短列表项不再被跳过
  - **td/th**：门槛 2 — 短表格单元格不再被跳过
  - **p/blockquote**：门槛 20 — 保持当前行为，避免翻译短碎片文本
  - EXCLUDE_SELECTORS（nav/header/footer/button/a/label 等）在门槛检查之前已过滤掉 UI 元素，所以低门槛不会误选导航/按钮文本

#### A2. 初始扫描 Twitter 路径调用 helper

- [x] `immersive.js:46` — 替换硬编码的 `5`：

  ```javascript
  /* 改前（line 46） */
  if (text.length < 5) return false;

  /* 改后 */
  if (text.length < getImmersiveMinLength(el, true)) return false;
  ```

  行为不变（Twitter 元素返回 5），但统一走 helper 路径。

#### A3. 初始扫描通用路径调用 helper

- [x] `immersive.js:74` — 替换硬编码的 `20`：

  ```javascript
  /* 改前（line 74） */
  if (text.length < 20) return false;

  /* 改后 */
  if (text.length < getImmersiveMinLength(p, false)) return false;
  ```

  行为变化：
  - **h1-h6, li, td, th**：门槛从 20 降到 2 — 短标题和短列表项不再被跳过
  - **p, blockquote**：门槛仍为 20 — 无变化

#### A4. Observer 过滤路径调用 helper

- [x] `immersive.js:260-261` — 替换硬编码的分支：

  ```javascript
  /* 改前（line 260-261） */
  const minLength = isTwitter ? 5 : 20;
  if (text.length < minLength) return false;

  /* 改后 */
  if (text.length < getImmersiveMinLength(el, isTwitter)) return false;
  ```

  行为变化与 A3 一致。`isTwitter` 变量在 Observer 回调中已有定义（`immersive.js:223-224`）。

#### A5. 回归测试

- [x] 新建 `tests/071-immersive-coverage.test.mjs`，至少覆盖：
  1. **A1 — `getImmersiveMinLength` 返回值**：验证 Twitter 返回 5、h1-h6 返回 2、li/td/th 返回 2、p/blockquote 返回 20
  2. **A3 — 短标题不再被跳过**：模拟 `<h2>FAQ</h2>`（3 字符），确认不被过滤
  3. **A3 — 短列表项不再被跳过**：模拟 `<li>Summary</li>`（7 字符），确认不被过滤
  4. **A3 — 短段落仍被跳过**：模拟 `<p>Read more.</p>`（10 字符），确认仍被过滤
  5. **A4 — Observer 使用同一 helper**：验证 Observer 过滤逻辑与初始扫描一致

**不要做的事**：
- 不要实现 B（隐藏元素变可见后的翻译触发）— Codex 明确排除，单独起 task
- 不要改 EXCLUDE_SELECTORS — 排除 nav/header/footer/button/a 是正确的
- 不要改 `detectLanguage` 检测逻辑
- 不要改 `injectTranslation` 注入逻辑
- 不要改 Observer 选择器列表或监听配置（`childList`/`subtree`）
- 不要改 heading 字号同步逻辑
- 不要新增 CSS 规则
- 不要碰 popup.js、selection.js、sidebar.js、float-window.js、content.js、utils.js、tts.js、options.js、floating-ball.js、ad-blocker.js、storage.js、translator.js、message-router.js、service-worker.js、offscreen.js、manifest.json、menus.js、popup.css、content.css

## 不做的事

- **不做** B（隐藏元素变可见后不翻译）— Codex 明确：不与 A 绑在同一轮，后续单独起 task
- **不做** 全局统一门槛到 5 — Codex 否决，会误选短导航项
- **不做** 修改纯符号正则过滤 — 与门槛无关
- **不做** 修改去重逻辑（dedup filter）— 与门槛无关

## 验证要求

- [x] `node --test tests/071-immersive-coverage.test.mjs` 通过
- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `git diff --check` 无输出
