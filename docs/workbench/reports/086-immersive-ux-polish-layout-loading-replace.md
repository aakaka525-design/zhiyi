---
report: "086"
status: done
created: 2026-03-15
---

# 086 — 沉浸式翻译 UX：inline 排版轻量化 + 加载动画 CSS 升级

## 变更摘要

### A — inline 路径 CSS 轻量化

纯 CSS 修复。添加 `span.st-immersive-translation` 覆盖规则，给 inline 路径的翻译元素使用轻量样式（透明背景、2px 细边框、最小 padding），与 cell-internal 覆盖对齐。无 JS 改动。

### B — 加载动画 CSS-only 视觉升级

保留 loading DOM 结构（`<span>` 内 3 个空 `<span>`），仅通过 CSS 将三个圆点改造为脉冲条段（bar-pulse）。新增 `@keyframes st-bar-pulse`，保留 `@keyframes st-bounce`（popup 依赖）。

## 改动文件

| 文件 | 改动 |
|------|------|
| `content/content.css` | A + B 的 CSS 规则 |
| `tests/086-immersive-ux-polish.test.mjs` | 静态 + runtime harness 两层测试 |
| `tests/084-immersive-ux.test.mjs` | 同步旧静态断言到 bar-pulse 新结构 |
| `tests/085-loading-visibility.test.mjs` | 同步旧静态断言到 bar-pulse 新结构 |

## 未做

- C（替换/对照模式设置）— 拆到后续独立任务
- loading helper DOM 结构 / JS 逻辑

## 验证

- `node --test tests/086-immersive-ux-polish.test.mjs`：`4/4`
- `node --test tests/*.test.mjs`：`301/301`
- `git diff --check`
