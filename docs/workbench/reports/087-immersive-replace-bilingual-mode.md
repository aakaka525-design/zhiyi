---
report: "087"
status: done
created: 2026-03-15
---

# 087 — 沉浸式翻译替换/对照模式设置

## 变更摘要

接线已有的 `showOriginal` 设置，通过 CSS body class toggle 实现非破坏性替换模式：

- `injectTranslation` 三条路径添加容器标记 class（`st-translated` / `st-translated-inline`）
- `toggleImmersive` 启动时读取 `showOriginal` 设置添加 `st-replace-mode` body class，关闭时清理
- CSS 替换模式规则：全局禁止 `display: none / visibility: hidden`，所有隐藏均用 visually-hidden
  - block wrapper 路径：`position: absolute; clip-path: inset(50%)`
  - inline/cell-internal 路径：父级 `font-size: 0`，子元素 visually-hidden + `pointer-events: none`
  - 翻译恢复 `0.9rem`，loading 通过 `:not()` 排除保持可见
- Options UI 添加 showOriginal toggle（`saveImmediateToggle` 自动保存）

## 改动文件

| 文件 | 改动 |
|------|------|
| `content/modules/immersive.js` | 标记 class + 模式切换/清理 |
| `content/content.css` | 替换模式 CSS |
| `options/options.html` | showOriginal toggle UI |
| `options/options.js` | showOriginal 设置读写 |
| `tests/087-replace-bilingual-mode.test.mjs` | 静态 + runtime harness（含 innerText 不变断言） |

## 验证

- `/opt/homebrew/bin/node --test tests/087-replace-bilingual-mode.test.mjs` → `4/4`
- `/opt/homebrew/bin/node --test tests/*.test.mjs` → `305/305`
- `/opt/homebrew/bin/node --check content/modules/immersive.js`
- `/opt/homebrew/bin/node --check options/options.js`
- `git diff --check`

## 同步更新的旧测试基线

- `tests/066-immersive-inline-style-heading-fontsize.test.mjs`
- `tests/068-immersive-td-th-injection.test.mjs`
- `tests/070-immersive-li-injection.test.mjs`
- `tests/075-cell-css-selector-coverage.test.mjs`
- `tests/immersive-color-misc.test.mjs`
- `tests/immersive-menu-drag.test.mjs`
- `tests/084-immersive-ux.test.mjs`
- `tests/085-loading-visibility.test.mjs`

## 未做

- runtime 实时切换（启动前设置，不支持运行中切换）
- storage.js 改动（默认值已存在）
