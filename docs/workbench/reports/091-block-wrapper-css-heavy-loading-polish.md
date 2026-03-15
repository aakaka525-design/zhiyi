---
report: "091"
status: done
created: 2026-03-15
---

# 091 — block wrapper 排版轻量化 + 加载动画视觉打磨

## 变更摘要

- block wrapper 的 `.st-immersive-translation` 改为透明背景、2px 细边框、无圆角/阴影、紧凑间距
- `.st-immersive-wrapper` margin 从 `12px 0 20px 0` 缩减到 `4px 0 6px 0`
- loading bar-pulse 改为递减宽度（40→28→16px），增加方向感

## 改动文件

| 文件 | 改动 |
|------|------|
| `content/content.css` | block wrapper 轻量化 + loading 递减宽度 |
| `tests/091-block-wrapper-loading-polish.test.mjs` | 静态断言 |

## 验证

- `/opt/homebrew/bin/node --test tests/091-block-wrapper-loading-polish.test.mjs`：`2/2`
- `/opt/homebrew/bin/node --test tests/*.test.mjs`：`301/301`
- `git diff --check`：通过

## 备注

- `content.css` 属于样式文件，`node --check` 不适用；本轮按 task 边界使用静态断言 + 全量回归验证
