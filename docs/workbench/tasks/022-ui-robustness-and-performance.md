---
status: pending
priority: P1
created: 2026-03-13
---

# 022 — UI 健壮性 & 性能修复

## 背景

011-021 修复了大量 UX 问题（暗色模式、CSS token、错误反馈、TTS 回退等）。本轮聚焦之前未覆盖的健壮性缺陷和性能瓶颈。

## 范围

待 discussions/022 讨论收敛后确定。当前建议：

### 必做

- **A1** SVG querySelector 空指针崩溃（`popup/popup.js:192,357`）
- **A2** CSS 变量在 inline style 中无效（`popup/popup.js:102,104`）
- **C2** 无 CSS disabled 状态（全部 CSS 文件）

### 推荐

- **A3** 翻译时未锁定输入（`popup/popup.js:320-340`）
- **B1** 广告拦截器 O(n×m) 性能（`content/modules/ad-blocker.js`）
- **C1** outline:none 替换为 :focus-visible（7 处 CSS）
- **C3** document.onmousemove 改为 addEventListener（`content/modules/float-window.js`）

### 可选

- **A4** 100ms popup 关闭竞态（`popup/popup.js:207-252`）
- **B2** 沉浸模式 getComputedStyle 缓存（`content/modules/immersive.js`）
- **B3** transition:all 逐步替换（29 处）

## 执行要求

- 先读 `docs/workbench/CONVENTIONS.md`
- 按 TDD 执行：先写测试、再改实现
- 每项改动附 `文件路径:行号`
- 最终跑 `node --test tests/*.test.mjs` 全绿
