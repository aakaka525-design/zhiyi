---
report: "102"
status: done
created: 2026-03-15
---

# 102 — 悬浮气泡显示原文

## 变更摘要

替换模式下 hover 译文时弹出浮动气泡显示原文。`data-st-original-text` 存储原文，全局气泡事件委托，`positionOriginalBubble` 做上下翻转 + 视口 clamp。`#st-original-bubble` 已纳入 content token scope，并移除了 101 的 `:has()` in-place hover 规则。新增 `hoverShowOriginal` 设置开关。

## 改动文件

| 文件 | 改动 |
|------|------|
| `content/modules/immersive.js` | 存原文 + 气泡 + 事件 + 清理 |
| `content/content.css` | 气泡样式 + token scope + 删 101 hover |
| `content/content.js` | mergeDefaults 增加 `hoverShowOriginal` 默认值 |
| `options/options.html` | hoverShowOriginal toggle |
| `options/options.js` | 读写 |
| `options/options-ui-state.js` | snapshot |
| `src/core/storage.js` | 默认值 |
| `tests/102-hover-bubble.test.mjs` | 回归测试 |
| `tests/101-hover-reveal.test.mjs` 等旧基线 | 对齐 102 的合法新结构 |

## 验证

- `/opt/homebrew/bin/node --test tests/102-hover-bubble.test.mjs`：`3/3`
- `/opt/homebrew/bin/node --test tests/*.test.mjs`：`352/352`
- `/opt/homebrew/bin/node --check content/modules/immersive.js options/options.js options/options-ui-state.js src/core/storage.js content/content.js`
- `git diff --check`
