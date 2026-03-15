---
status: done
priority: P2
created: 2026-03-14
---

# 068 — 沉浸式翻译 `td`/`th` cell 内注入 + Observer 选择器/去重补齐

- 来源讨论: [discussions/068-immersive-td-li-invalid-html-injection.md](../discussions/068-immersive-td-li-invalid-html-injection.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/068-immersive-td-li-invalid-html-injection.md](../discussions/068-immersive-td-li-invalid-html-injection.md)（完整讨论记录 + Codex 审阅）

## 背景

`injectTranslation` 的 block 路径对所有非 inline/flex/grid 元素统一使用 `<div class="st-immersive-wrapper">` 作为 sibling 插入。当 container 是 `td`/`th` 时，wrapper 作为 `<tr>` 的子元素是无效 HTML（`<tr>` 只接受 `<td>`/`<th>`）。DOM API 不做 foster-parenting（那是 HTML parser 行为），但非法 generic child 会导致**布局语义不稳定**和**跨站点/跨样式不可预测**的风险。

Codex 审阅结论：
- `td`/`th` 改为 cell 内注入（在 `<td>`/`<th>` 内部 append 翻译元素）
- **本轮不处理 `li`** — `li` 的 bullet/缩进/条目节奏问题需单独判断
- Observer 选择器补 `td, th` + 去重补 `querySelector`

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | A1：block 路径新增 `td/th` 分支（cell 内注入） |
| `content/modules/immersive.js` | B1：Observer 选择器补 `td, th` |
| `content/modules/immersive.js` | B2：Observer 去重补 `querySelector` |
| `tests/068-immersive-td-th-injection.test.mjs` | 回归测试 |

## 任务清单

### 必做

#### A1. `injectTranslation` 对 `td`/`th` 改为 cell 内注入

- [x] `immersive.js:189-208` — 在 block 路径的 `else` 前，新增 `td/th` 分支：

  ```javascript
  /* 改前（line 189-208） */
      } else {
          const wrapper = document.createElement('div');
          wrapper.className = 'st-immersive-wrapper';

          const blockTransEl = document.createElement('div');
          blockTransEl.className = 'st-immersive-translation';
          blockTransEl.innerText = translation;

          if (container.matches('h1, h2, h3, h4, h5, h6')) {
              const headingStyle = window.getComputedStyle(container);
              blockTransEl.style.fontSize = `calc(${headingStyle.fontSize} * 0.85)`;
              blockTransEl.style.fontWeight = headingStyle.fontWeight;
          }

          wrapper.appendChild(blockTransEl);

          if (container.parentNode) {
              container.parentNode.insertBefore(wrapper, container.nextSibling);
          }
      }

  /* 改后 */
      } else if (container.matches('td, th')) {
          // td/th：在 cell 内部追加翻译，避免在 <tr> 中插入非法 <div>
          const blockTransEl = document.createElement('div');
          blockTransEl.className = 'st-immersive-translation';
          blockTransEl.innerText = translation;
          container.appendChild(blockTransEl);
      } else {
          const wrapper = document.createElement('div');
          wrapper.className = 'st-immersive-wrapper';

          const blockTransEl = document.createElement('div');
          blockTransEl.className = 'st-immersive-translation';
          blockTransEl.innerText = translation;

          if (container.matches('h1, h2, h3, h4, h5, h6')) {
              const headingStyle = window.getComputedStyle(container);
              blockTransEl.style.fontSize = `calc(${headingStyle.fontSize} * 0.85)`;
              blockTransEl.style.fontWeight = headingStyle.fontWeight;
          }

          wrapper.appendChild(blockTransEl);

          if (container.parentNode) {
              container.parentNode.insertBefore(wrapper, container.nextSibling);
          }
      }
  ```

  行为说明：
  - **`td`/`th`**：翻译 `<div>` append 到 cell 内部 — `<td>` 内 `<div>` 是合法 HTML
  - **`p`/`blockquote`/`h1-h6`**：仍走原有 wrapper sibling 路径，不受影响
  - **`li`**：本轮不改，仍走原有 block 路径（Codex 明确：`li` 需单独判断）
  - 不用 wrapper：`.st-immersive-translation` 自身已有完整样式，cell 内不需要 wrapper 的额外 margin
  - 清除兼容：`toggleImmersive` 的 `querySelectorAll('.st-immersive-translation')` 会选中 cell 内的翻译并 remove ✅
  - 去重兼容：`injectTranslation:166` 的 `container.querySelector('.st-immersive-translation')` 会检测 cell 内已有翻译 ✅

#### B1. Observer 选择器补 `td, th`

- [x] `immersive.js:244` — 在 Observer 的 `querySelectorAll` 中补上 `td, th`：

  ```javascript
  /* 改前（line 244） */
  node.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote')

  /* 改后 */
  node.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote')
  ```

  行为说明：
  - 使 Observer 选择器与初始选择器（`immersive.js:52-57`）对 `td`/`th` 保持一致
  - 动态加载的表格内容（如无限滚动页面）也会被自动翻译

#### B2. Observer 去重补 `querySelector`

- [x] `immersive.js:263` — 在 Observer 过滤中，`nextElementSibling` 检查后追加 `querySelector` 检查：

  ```javascript
  /* 改前（line 263） */
  if (el.nextElementSibling?.classList.contains('st-immersive-wrapper')) return false;

  /* 改后（line 263-264） */
  if (el.nextElementSibling?.classList.contains('st-immersive-wrapper')) return false;
  if (el.querySelector('.st-immersive-translation')) return false;
  ```

  行为说明：
  - **保留** `nextElementSibling` 检查 — 对 `p`/`h1-h6`/`blockquote` 的 wrapper sibling 仍有效
  - **新增** `querySelector` 检查 — 覆盖 `td`/`th` 的 cell 内注入（无 wrapper sibling）
  - 与初始选择过滤（`immersive.js:69`）保持一致
  - 避免 Observer 对已翻译 `td`/`th` 发送重复 API 请求

#### C. 回归测试

- [x] 新建 `tests/068-immersive-td-th-injection.test.mjs`，至少覆盖：
  1. **A1 — `td`/`th` 走 cell 内注入**：当 container 匹配 `td` 或 `th` 时，`injectTranslation` block 路径应在 container 内部 append `.st-immersive-translation`（而非在 parentNode 中 insertBefore wrapper）
  2. **A1 — `p`/`blockquote` 仍走 wrapper sibling**：确认 `p`/`blockquote` 的 block 路径不受影响
  3. **B1 — Observer 选择器包含 `td, th`**：MutationObserver 初始化时使用的 querySelectorAll 字符串应包含 `td` 和 `th`
  4. **B2 — Observer 去重包含 `querySelector` 检查**：Observer 过滤逻辑应包含 `el.querySelector('.st-immersive-translation')` 检查

**不要做的事**：
- 不要改 `li` 的注入方式 — Codex 明确：本轮不处理 `li`，需单独判断
- 不要改 inline 路径（flex/grid/inline display）— 与 td/th 无关
- 不要改 heading 字号同步逻辑 — 066 已完成
- 不要改 `toggleImmersive` 中的清除逻辑 — `querySelectorAll('.st-immersive-translation')` 已覆盖 cell 内元素
- 不要改初始选择器（`immersive.js:52-57`）— 已包含 `td`/`th`
- 不要新增 CSS 规则 — `.st-immersive-translation` 现有样式在 cell 内显示正常
- 不要碰 popup.js、selection.js、sidebar.js、float-window.js、content.js、utils.js、tts.js、options.js、floating-ball.js、ad-blocker.js、storage.js、translator.js、message-router.js、service-worker.js、offscreen.js、manifest.json、menus.js、popup.css、content.css

## 不做的事

- **不做** `li` 注入方式修改 — Codex 明确推迟，bullet/缩进/条目节奏需单独判断
- **不做** 修改 block 路径的 `p`/`h1-h6`/`blockquote` 逻辑 — sibling 注入对这些元素完全合法
- **不做** 删除 Observer 的 `nextElementSibling` 检查 — 对非 cell 元素仍有效

## 验证要求

- [x] `node --test tests/068-immersive-td-th-injection.test.mjs` 通过
- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `git diff --check` 无输出
