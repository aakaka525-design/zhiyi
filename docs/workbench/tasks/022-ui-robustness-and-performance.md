---
status: done
priority: P1
created: 2026-03-13
---

# 022 — UI 健壮性 & 性能修复

## 背景

011-021 修复了大量 UX 问题（暗色模式、CSS token、错误反馈、TTS 回退等）。本轮聚焦之前未覆盖的健壮性缺陷和性能瓶颈。

## 范围（讨论已收敛）

### 必做

- **A2** Popup 字符计数状态未集中管理（`popup/popup.js:98-105,141-142,302-303,314-317`）
  - 根因：字数文本更新分散在 `input` 监听器和多个程序化写值路径中，后者只更新计数文本不同步颜色
  - 修法：提取 `updateCharCount()` 统一管理字数文本 + 超限颜色，使用 class toggle 替代 inline style
- **A3** 翻译时未锁定输入（`popup/popup.js:320-340`）
  - `setLoading()` 仅禁用翻译按钮，textarea 和语言选择器仍可交互
  - 修法：loading 状态下禁用 textarea 和语言选择器
- **C2** 无 CSS disabled 状态（`popup/popup.css`、`content/content.css`、`options/theme.css`）
  - 影响范围：popup、sidebar、float-window、options 均有 disabled 路径但无样式反馈
  - 修法：添加 `button:disabled`、`input:disabled`、`select:disabled` 样式（降低 opacity、cursor: not-allowed）

### 推荐

- **B1** 广告拦截器 removeAds() 全量扫描优化（`content/modules/ad-blocker.js:171-186`）
  - 现状：observer 已有 addedNodes 前置过滤，但命中后 removeAds() 对 126 个选择器逐个 querySelectorAll 仍然昂贵
  - 修法：合并 126 个选择器为一个复合选择器字符串，一次 querySelectorAll
- **C1** outline:none 补 :focus-visible 键盘焦点态（7 处 CSS）
  - 保留鼠标操作时的视觉风格，为键盘操作补 `:focus-visible` 反馈
  - 重点关注：`.btn-icon`（popup）和 `.btn`（theme）当前无等价键盘焦点态
- **C3** document.onmousemove 改为 addEventListener（`content/modules/float-window.js:205,216`）
  - 属性赋值会覆盖宿主页面处理器，改用 addEventListener/removeEventListener

### 可选

- **A1** SVG querySelector 防御性 null 检查（`popup/popup.js:192,357`）— hardening，非已证实高频 crash
- **A4** Popup 功能按钮缺少执行确认链路（`popup/popup.js:207-252`）— 若引入 message ack 协议
- **B2** 沉浸模式 getComputedStyle 缓存（`content/modules/immersive.js:156-160`）
- **B3** transition:all 逐步替换（29 处）

## 执行要求

- 先读 `docs/workbench/CONVENTIONS.md`
- 按 TDD 执行：先写测试、再改实现
- 每项改动附 `文件路径:行号`
- 最终跑 `node --test tests/*.test.mjs` 全绿
