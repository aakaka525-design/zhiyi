---
report: "100"
status: done
created: 2026-03-15
---

# 100 — Popup 视觉优化

## 变更摘要

- 头部渐变光球删除
- 语言栏圆角 `var(--radius-xl)` → `var(--popup-lang-radius)` (10px)
- 翻译按钮从实心深绿改为浅绿填充 + 绿色文字（dark-mode-safe 局部变量）

## 改动文件

| 文件 | 改动 |
|------|------|
| `popup/popup.css` | A + B + C |
| `tests/100-popup-visual-polish.test.mjs` | 静态断言 |

## 验证

- `/opt/homebrew/bin/node --test tests/100-popup-visual-polish.test.mjs`：`3/3`
- `/opt/homebrew/bin/node --test tests/*.test.mjs`：`346/346`
- `git diff --check`：无输出

## 备注

- 这轮保持 `CSS-only`
- 未改 `popup.html` / `popup.js` / `theme.css`
- 真实 Chrome 手测仍未执行
