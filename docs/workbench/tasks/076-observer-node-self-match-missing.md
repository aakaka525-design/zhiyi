---
status: done
priority: P2
created: 2026-03-14
---

# 076 — Observer 通用路径缺少 node.matches() 自身检查 — 直接添加的元素被静默跳过

- 来源讨论: [discussions/076-observer-node-self-match-missing.md](../discussions/076-observer-node-self-match-missing.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/076-observer-node-self-match-missing.md](../discussions/076-observer-node-self-match-missing.md)（完整讨论记录 + Codex 审阅）

## 背景

Observer 的 Twitter 和 Discord 消息路径对 mutation 添加的节点都做了 `node.matches()` + `querySelectorAll()` 双重检查（检查节点自身 + 搜索后代），但通用路径和 Discord 通用 fallback 只用 `querySelectorAll()`（只搜后代，不检查节点自身）。由于 `querySelectorAll` 的 W3C 规范行为是不包含调用者自身，当 SPA 框架直接追加单个 `<p>`/`<li>` 等匹配元素时，Observer 无法捕获 — 元素被静默跳过，不翻译。

Codex 审阅结论：
- A1 成立 — 通用路径补 `node.matches()`
- A2 接受 — Discord generic fallback 也补 `node.matches()`，同一类缺口不分开留
- 不提取选择器常量 — 这轮只修自身检查，不做代码去重
- `filterContainedImmersiveElements` 足够承接变化 — 074 已收进 observer 末尾

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | A1：通用路径添加 `node.matches()` |
| `content/modules/immersive.js` | A2：Discord 通用 fallback 添加 `node.matches()` |
| `tests/076-observer-node-self-match.test.mjs` | C：回归测试 |

## 任务清单

### 必做

#### A1. 通用路径添加 node.matches() 自身检查

- [x] `immersive.js:308-312` — 在 `querySelectorAll` 之前添加 `node.matches()` 检查：

  ```javascript
  /* 改前（line 308-312） */
  } else {
      const paragraphs = node.querySelectorAll ?
          node.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption') : [];
      newElements.push(...paragraphs);
  }

  /* 改后 */
  } else {
      if (node.matches && node.matches('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption')) {
          newElements.push(node);
      }
      const paragraphs = node.querySelectorAll ?
          node.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption') : [];
      newElements.push(...paragraphs);
  }
  ```

  行为说明：
  - 先检查 `node` 自身是否匹配选择器 → 匹配则收集
  - 再搜索 `node` 的后代 → 收集所有匹配后代
  - 与 Twitter 路径（`immersive.js:293-296`）和 Discord 消息路径（`immersive.js:300-303`）完全同构
  - `node.matches &&` 前置守卫：与现有代码一致（`immersive.js:293, 300`），防止非 Element 节点调用失败
  - 如果 `node` 自身和后代都被收集（如 `<blockquote>` 包含 `<p>`）→ `filterContainedImmersiveElements`（`immersive.js:334`）会做嵌套去重，保留外层
  - 选择器字符串与现有 `querySelectorAll` 使用完全相同的字符串 — 保持内联，不提常量

#### A2. Discord 通用 fallback 添加 node.matches() 自身检查

- [x] `immersive.js:305-307` — 在 `querySelectorAll` 之前添加 `node.matches()` 检查：

  ```javascript
  /* 改前（line 305-307） */
      const genericEls = node.querySelectorAll ?
          node.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption') : [];
      newElements.push(...genericEls);

  /* 改后 */
      if (node.matches && node.matches('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption')) {
          newElements.push(node);
      }
      const genericEls = node.querySelectorAll ?
          node.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption') : [];
      newElements.push(...genericEls);
  ```

  行为说明：
  - 与 A1 完全同构
  - Discord 场景：如果一个 `<p>` / `<figcaption>` 被直接追加到 Discord 页面（不是消息容器），也会被 Observer 捕获
  - Discord 消息容器的自身检查（`node.matches('[id^="message-content-"]')`）仍在上方（`immersive.js:300`）独立处理，不受影响
  - 注意缩进：A2 在 `} else if (isDiscord) {` 块内部，缩进应与现有 `genericEls` 声明一致

#### C. 回归测试

- [x] 新建 `tests/076-observer-node-self-match.test.mjs`，至少覆盖：
  1. **A1 — 通用路径：单个 `<p>` 直接追加被收集**：模拟 mutation 添加单个 `<p>` 节点 → 该 `<p>` 进入 `newElements` → 被翻译
  2. **A1 — 通用路径：单个 `<li>` 直接追加被收集**：模拟 mutation 添加单个 `<li>` 节点 → 被翻译
  3. **A1 — 通用路径：单个 `<blockquote>` 直接追加被收集**：模拟 mutation 添加单个 `<blockquote>` 节点 → 被翻译
  4. **A1 — 通用路径：容器包含后代仍正常**：模拟 mutation 添加 `<div>` 包含 `<p>` → `<p>` 通过 `querySelectorAll` 被收集 → 仍正常工作
  5. **A1 — 通用路径：node + 后代同时收集时 dedup 保留外层**：模拟 mutation 添加 `<blockquote>` 包含 `<p>` → 两者都被收集 → `filterContainedImmersiveElements` 只保留 `<blockquote>`
  6. **A1 — 不匹配的 node 不被收集**：模拟 mutation 添加 `<div>`（不在选择器列表中）且无匹配后代 → `newElements` 为空
  7. **A1 — 新增选择器元素也被自身检查覆盖**：模拟 mutation 添加单个 `<figcaption>` → 被收集（验证 075 扩展的选择器在自身检查中也生效）
  8. **A2 — Discord fallback：单个 `<p>` 直接追加被收集**：模拟 Discord 环境 + mutation 添加单个 `<p>` → 通过 generic fallback 的 `node.matches` 被收集
  9. **Twitter/Discord 消息路径不受影响**：模拟 Twitter 环境 + mutation 添加 `[data-testid="tweetText"]` 节点 → 仍通过已有 `node.matches` 被收集
  10. **不选 `<summary>`**：模拟 mutation 添加单个 `<summary>` → 不被收集（不在选择器中）

**不要做的事**：
- 不要修改初始扫描的元素收集逻辑 — 用 `document.querySelectorAll` 搜索全文档，不存在此问题
- 不要修改 Twitter 路径 — 已有 `node.matches()` 自身检查
- 不要修改 Discord 消息路径 — 已有 `node.matches('[id^="message-content-"]')` 自身检查
- 不要修改 Observer 过滤链 — 过滤逻辑正确，只是收集阶段遗漏
- 不要修改 `filterContainedImmersiveElements` — 已能正确处理 node + 后代同时收集的场景
- 不要修改 `getImmersiveMinLength` / `injectTranslation` / `isExcludedByImmersiveContext`
- 不要提取选择器字符串为常量 — Codex 明确本轮不做
- 不要修改初始扫描选择器 — 只改 Observer 收集逻辑
- 不要碰 popup.js、selection.js、sidebar.js、float-window.js、content.js、utils.js、tts.js、options.js、floating-ball.js、ad-blocker.js、storage.js、translator.js、message-router.js、service-worker.js、offscreen.js、manifest.json、menus.js、popup.css、content.css

## 不做的事

- **不做** 修改初始扫描
- **不做** 修改 Twitter / Discord 消息路径
- **不做** 提取选择器常量
- **不做** 修改过滤链或嵌套去重逻辑

## 验证要求

- [x] `node --test tests/076-observer-node-self-match.test.mjs` 通过
- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `git diff --check` 无输出
