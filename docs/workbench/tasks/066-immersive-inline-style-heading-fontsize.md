---
status: done
priority: P2
created: 2026-03-14
---

# 066 — 沉浸式翻译 inline 路径样式冲突 & 标题翻译字号不匹配

- 来源讨论: [discussions/066-immersive-inline-style-conflict-heading-fontsize.md](../discussions/066-immersive-inline-style-conflict-heading-fontsize.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/066-immersive-inline-style-conflict-heading-fontsize.md](../discussions/066-immersive-inline-style-conflict-heading-fontsize.md)（完整讨论记录 + Codex 审阅）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | A：inline 路径 `style.cssText` 覆盖所有 block 装饰；B：block 路径标题字号+字重同步 |
| `tests/066-immersive-inline-style-heading-fontsize.test.mjs` | 回归测试 |

## 任务清单

### 必做

#### A. inline 路径退回轻量文本标注样式

- [x] `content/modules/immersive.js:185` — 扩展 `style.cssText` 覆盖所有 block-oriented CSS 属性，退回纯文本标注：
  ```javascript
  // 改前（line 185）
  transEl.style.cssText = 'display: inline; font-style: normal; color: var(--accent); margin-left: 4px;';

  // 改后
  transEl.style.cssText = 'display: inline; font-style: normal; color: var(--accent); margin-left: 4px; background: transparent; border-left: none; padding: 0; border-radius: 0; box-shadow: none; margin-top: 0; margin-bottom: 0; font-size: inherit; line-height: inherit;';
  ```

  行为说明：
  - **block 路径**（`p`/`blockquote` 等）：不受影响，仍使用 CSS 类的完整卡片装饰
  - **inline 路径**（flex/grid/inline 容器）：退回轻量文本标注模型，只保留 `color`（绿色标识）和 `margin-left`（与分隔符间距）
  - 完全消除 inline 多行时的视觉碎片化：无断裂背景、无逐行 border-left、无碎片化阴影/圆角
  - `font-size: inherit` 和 `line-height: inherit` 覆盖 CSS 类的 `0.95em` / `1.7`，让 inline 翻译文本与容器内原文保持一致的排版节奏
  - 不新增 CSS class — Codex 明确：直接在 JS 写全覆盖更便宜，不引入 token scope / selector 漏配风险

#### B. block 路径标题翻译同步字号和字重

- [x] `content/modules/immersive.js:193-195` — 在 block 路径中检测标题元素并同步 `fontSize` 和 `fontWeight`：
  ```javascript
  // 改前（line 193-195）
  const blockTransEl = document.createElement('div');
  blockTransEl.className = 'st-immersive-translation';
  blockTransEl.innerText = translation;

  // 改后
  const blockTransEl = document.createElement('div');
  blockTransEl.className = 'st-immersive-translation';
  blockTransEl.innerText = translation;

  if (container.matches('h1, h2, h3, h4, h5, h6')) {
      const headingStyle = window.getComputedStyle(container);
      blockTransEl.style.fontSize = `calc(${headingStyle.fontSize} * 0.85)`;
      blockTransEl.style.fontWeight = headingStyle.fontWeight;
  }
  ```

  行为说明：
  - **非标题元素**（`p`/`li`/`td`/`blockquote`）：不受影响，仍用 CSS 的 `font-size: 0.95em`
  - **`h1`（~32px, 700）**：翻译字号 = 32px × 0.85 = 27.2px，字重 = 700 — 保持标题级视觉层级
  - **`h2`（~24px, 700）**：翻译字号 = 24px × 0.85 = 20.4px，字重 = 700 — 保持中标题层级
  - **`h3`（~20px, 600-700）**：翻译字号 = 20px × 0.85 = 17px，字重同步 — 保持小标题层级
  - `0.85` 系数使翻译明显比原文小一档（好识别哪个是翻译），同时不会掉回正文大小
  - `fontWeight` 同步使字号上去后不会因字重掉回 normal 而失去层级感
  - 不同步 `lineHeight`/`letterSpacing`/`fontFamily` — Codex 明确：只做字号+字重，避免滑向完整 heading 样式复制

#### C. 回归测试

- [x] 新建 `tests/066-immersive-inline-style-heading-fontsize.test.mjs`，至少覆盖：
  1. **A — inline 路径无 block 装饰**：immersive.js 的 inline 路径 `style.cssText` 包含 `background: transparent`、`border-left: none`、`padding: 0`、`border-radius: 0`、`box-shadow: none`、`font-size: inherit`、`line-height: inherit`
  2. **B — 标题翻译同步字号和字重**：immersive.js 的 block 路径对 `h1-h6` 检测 `container.matches('h1, h2, h3, h4, h5, h6')` 并设置 `fontSize`（含 `0.85`）和 `fontWeight`

**不要做的事**：
- 不要新增 CSS class — Codex 明确不建议，直接 inline style 覆盖
- 不要修改 separator 样式 — 无同类 block 样式冲突
- 不要修改 content.css 中 `.st-immersive-translation` 的 block 样式 — block 路径表现正常
- 不要同步 `lineHeight`/`letterSpacing`/`fontFamily` — Codex 明确限定字号+字重
- 不要改 `text.length < 20` 的标题过滤 — 独立问题，不属本轮
- 不要碰 content.js、sidebar.js、float-window.js、utils.js、selection.js、popup.js、tts.js、options.js、floating-ball.js、ad-blocker.js、storage.js、translator.js、message-router.js、service-worker.js、offscreen.js、manifest.json、menus.js、content.css

## 不做的事

- **不做** 新增 CSS class — Codex 明确：inline style 覆盖更便宜，不引入 scope 风险
- **不做** separator 样式修改 — 无 block 样式冲突
- **不做** `lineHeight`/`letterSpacing`/`fontFamily` 同步 — Codex 明确限定范围
- **不做** 标题过滤长度阈值调整 — 独立问题

## 验证要求

- [x] `node --test tests/066-immersive-inline-style-heading-fontsize.test.mjs` 通过
- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check content/modules/immersive.js` 通过
- [x] `git diff --check` 无输出
