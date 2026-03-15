---
report: "098"
status: done
created: 2026-03-15
---

# 098 — 深色页面译文颜色不可见

## 变更摘要

`injectTranslation` 在注入前捕获原容器的 `computedStyle.color`，存为 `--st-page-color` CSS 自定义属性。替换模式 CSS 使用 `var(--st-page-color, var(--text-primary))`。关闭沉浸式翻译时清理属性。

不碰全局 content theme、双语模式颜色、bubble/sidebar/toast。

## 改动文件

| 文件 | 改动 |
|------|------|
| `content/modules/immersive.js` | 捕获颜色 + 关闭清理 |
| `content/content.css` | replace mode 使用 `--st-page-color` |
| `tests/098-dark-page-color.test.mjs` | 回归测试 |

## 验证

- `/opt/homebrew/bin/node --test tests/098-dark-page-color.test.mjs`：`4/4`
- `/opt/homebrew/bin/node --test tests/*.test.mjs`：通过
- `/opt/homebrew/bin/node --check content/modules/immersive.js tests/098-dark-page-color.test.mjs`：通过
- `git diff --check`：无输出

## 备注

- 这轮只修节点级沉浸式译文颜色恢复，不改全局 `data-st-theme`
- 真实 Chrome 深色页面手测仍未执行
