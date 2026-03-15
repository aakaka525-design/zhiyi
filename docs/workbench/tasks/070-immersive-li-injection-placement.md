---
status: done
priority: P2
created: 2026-03-14
---

# 070 — 沉浸式翻译 `li` 改为元素内部注入

- 来源讨论: [discussions/070-immersive-li-injection-placement.md](../discussions/070-immersive-li-injection-placement.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/070-immersive-li-injection-placement.md](../discussions/070-immersive-li-injection-placement.md)（完整讨论记录 + Codex 审阅）

## 背景

`li` 元素当前走 block 路径的最后 `else` 分支，在 `<ul>`/`<ol>` 中插入 `<div>` wrapper 作为 sibling。翻译块夹在两个列表项之间，无 bullet/编号，与对应列表项脱离。

068 修复了 `td`/`th`，Codex 在 070 审阅中接受了 `li` 与 `td`/`th` 统一走内部注入路径。

Codex 审阅结论：
- 把 `container.matches('td, th')` 扩成 `container.matches('td, th, li')`
- 不改 Observer — `li` 已在选择器中，`querySelector` 去重已有（068-B2）
- Report 必须把 nested list 写成 residual risk
- 不要把 070 描述成"列表场景全部解决"

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | A1：`td, th` 分支扩展为 `td, th, li` |
| `tests/070-immersive-li-injection.test.mjs` | A2：回归测试 |

## 任务清单

### 必做

#### A1. `injectTranslation` 的 `td, th` 分支加入 `li`

- [x] `immersive.js:189` — 把 `container.matches('td, th')` 扩展为 `container.matches('td, th, li')`：

  ```javascript
  /* 改前（line 189） */
  } else if (container.matches('td, th')) {

  /* 改后 */
  } else if (container.matches('td, th, li')) {
  ```

  行为说明：
  - **`li`**：翻译 `<div>` append 到 `<li>` 内部 — `<li>` 内 `<div>` 是合法 HTML
  - 翻译明确附属于对应列表项，在 bullet/编号范围内
  - 列表流不再断裂（无 wrapper margin 插入列表项之间）
  - **`td`/`th`**：不受影响，仍走同一分支
  - **`p`/`blockquote`/`h1-h6`**：不受影响，仍走 wrapper sibling 路径
  - 清除兼容：`toggleImmersive` 的 `querySelectorAll('.st-immersive-translation')` 会选中 li 内的翻译并 remove ✅
  - 去重兼容：`injectTranslation:166` 的 `container.querySelector('.st-immersive-translation')` 会检测 li 内已有翻译 ✅
  - Observer 兼容：`immersive.js:269` 的 `el.querySelector('.st-immersive-translation')` 已在 068-B2 补齐 ✅

  **Nested list residual risk**（不在本轮范围，report 中需记录）：
  - 父 `li` 包含子 `ul`/`ol` 时，父 `li` 的翻译会 append 在子列表之后
  - 初选去重（`immersive.js:79-83`）会保留父 `li`、过滤子 `li`
  - 父 `li` 的翻译可能覆盖"父项文本 + 子列表文本"的组合内容
  - 这是 `li` **选取粒度**的独立问题，不是注入位置能解决的

#### A2. 回归测试

- [x] 新建 `tests/070-immersive-li-injection.test.mjs`，至少覆盖：
  1. **A1 — `li` 走元素内部注入**：当 container 匹配 `li` 时，`injectTranslation` 应在 container 内部 append `.st-immersive-translation`（而非在 parentNode 中 insertBefore wrapper）
  2. **A1 — `td`/`th` 仍走内部注入**：确认 068 的 td/th 行为不受影响
  3. **A1 — `p`/`blockquote` 仍走 wrapper sibling**：确认普通 block 元素不受影响

**不要做的事**：
- 不要改 Observer 选择器或去重逻辑 — `li` 已在选择器中，去重已有
- 不要改 inline 路径（flex/grid/inline display）
- 不要改 heading 字号同步逻辑
- 不要改 `toggleImmersive` 中的清除逻辑
- 不要改初始选择器（`immersive.js:52-57`）
- 不要新增 CSS 规则
- 不要碰 popup.js、selection.js、sidebar.js、float-window.js、content.js、utils.js、tts.js、options.js、floating-ball.js、ad-blocker.js、storage.js、translator.js、message-router.js、service-worker.js、offscreen.js、manifest.json、menus.js、popup.css、content.css

## 不做的事

- **不做** nested list 选取粒度修复 — 独立问题，需单独讨论
- **不做** 用 `<li>` wrapper 替代 `<div>` wrapper — 方案 B 已在讨论中否决
- **不做** Observer 修改 — 068 已补齐

## 验证要求

- [x] `node --test tests/070-immersive-li-injection.test.mjs` 通过
- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `git diff --check` 无输出

## Report 特别要求

Report 中必须包含 **residual risk** 段落，记录 nested list 场景：
- 父 `li` 包含子 `ul`/`ol` 时，翻译 append 在子列表之后
- 这是选取粒度问题，不是 070 的注入位置修复能解决的
- 不要把 070 描述成"列表场景全部解决"
