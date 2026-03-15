---
report: "096"
status: done
created: 2026-03-15
---

# 096 — 加载占位符重新设计

## 变更摘要

bar-pulse（3px 不可见条形）替换为"翻译中..."文字 + 呼吸动画。文字通过 CSS `::before` 伪元素实现，不污染 `innerText`。DOM 从 `<span>` 含 3 个子 `<span>` 简化为单个空 `<div>`。

## 改动文件

| 文件 | 改动 |
|------|------|
| `content/modules/immersive.js` | `injectLoadingPlaceholder` DOM 简化 |
| `content/content.css` | loading CSS 完全重写 |
| `tests/096-loading-redesign.test.mjs` | 新增测试 |

## 额外同步

- `tests/084-immersive-ux.test.mjs`
- `tests/085-loading-visibility.test.mjs`
- `tests/086-immersive-ux-polish.test.mjs`
- `tests/091-block-wrapper-loading-polish.test.mjs`

## 验证

- `/opt/homebrew/bin/node --test tests/096-loading-redesign.test.mjs`
- `/opt/homebrew/bin/node --test tests/*.test.mjs`
- `/opt/homebrew/bin/node --check content/modules/immersive.js tests/096-loading-redesign.test.mjs`
- `git diff --check`
