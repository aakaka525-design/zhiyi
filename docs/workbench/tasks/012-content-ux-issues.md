---
status: done
priority: P1
created: 2026-03-12
---

# 012 — Content Script UX 问题修复

- 来源讨论: [discussions/012-content-ux-issues.md](../discussions/012-content-ux-issues.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/012-content-ux-issues.md](../discussions/012-content-ux-issues.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|---------|
| `content/content.css` | A1 |
| `content/modules/floating-ball.js` | A2 |
| `content/modules/sidebar.js` | B2 + B3 |
| `content/modules/float-window.js` | B2 |
| `tests/content-ux-static.test.mjs` | A1 + A2 + B2 + B3 |

## 任务清单

### 必做

#### A1. Content Script UI 补 scoped design tokens

- [x] 在 `content/content.css` 中为扩展自有根节点补齐设计变量，不使用页面全局 `:root`
- [x] 作用域至少覆盖：
  - `#smart-translator-bubble`
  - `#st-sidebar`
  - `#st-sidebar-toggle-btn`
  - `#st-float-window`
  - `#st-page-progress`
  - `.st-immersive-wrapper`
  - `#st-floating-ball-container`
  - `#st-toast`
- [x] 至少补齐当前已被内容脚本样式消费的变量：`--accent`、`--accent-light`、`--bg-secondary`、`--text-primary`、`--border-color`、`--transition`、`--error`

#### A2. 悬浮球补翻译小窗入口

- [x] 在 `content/modules/floating-ball.js` 的 `menuData` 中添加“翻译小窗”项
- [x] 点击后调用 `ST.toggleFloatWindow()`

### 推荐

#### B2. 移除 content script 本地快捷键旁路

- [x] 删除 `content/modules/sidebar.js` 中的本地 `Alt+S` keydown listener
- [x] 删除 `content/modules/float-window.js` 中的本地 `Alt+W` keydown listener
- [x] 保持快捷键主路径只走 manifest commands → service worker → content script

### 顺手

#### B3. 快捷键提示改成默认值文案

- [x] 将 `content/modules/sidebar.js` 中的 `快捷键: Alt + S` 改为 `默认快捷键: Alt + S`
- [x] 不新增 `chrome.commands.getAll()` 查询链路

## 不做的事

- **不做 B1**（TTS 公共 speak 抽取）— 跨 content + popup 的行为收敛，单独起任务
- **不做 C1/C2/C3** — 继续留作可选 UX 收尾项
- **不碰** popup、options、service worker、manifest

## 验证要求

- [x] `node --test tests/content-ux-static.test.mjs` 通过
- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check content/modules/floating-ball.js` 通过
- [x] `node --check content/modules/sidebar.js` 通过
- [x] `node --check content/modules/float-window.js` 通过
- [x] `git diff --check` 无输出
