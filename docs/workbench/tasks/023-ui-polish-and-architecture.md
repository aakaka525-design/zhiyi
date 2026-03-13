---
status: pending
priority: P2
created: 2026-03-13
---

# 023 — UI 打磨 & CSS 架构修复

## 背景

022 的延续，收录中低优先级的 UI 问题。不影响核心功能正确性，但影响视觉一致性、代码可维护性和边缘场景下的用户体验。

## 范围

待 discussions/023 讨论收敛后确定。当前建议：

### 推荐

- **E2** 删除重复/死代码 keyframe 动画
- **G1** Options settings snapshot 自动保存后同步
- **H1** --text-tertiary 对比度修复（WCAG AA）
- **D2** 翻译气泡定位溢出修复

### 可选

- **D1** 侧边栏/小窗 max-width 安全约束
- **D3** 翻译小窗固定定位适配
- **D4** 浮动球 resize 处理
- **E1** z-index 层级变量化
- **E3** st-fade-in 动画统一
- **E4** options.html inline style 提取
- **E5** content.css box-sizing
- **F1** MutationObserver 单例化
- **G2** Storage 非原子操作
- **I1** 浮动球菜单键盘支持
- **I2** 侧边栏/小窗焦点陷阱
- **I3** Options label for= 关联
- **J1** SVG querySelector 防御性 null 检查（`popup/popup.js:192,357`）— 从 022 移入
- **J2** Popup 功能按钮缺少执行确认链路（`popup/popup.js:207-252`）— 从 022 移入
- **J3** 沉浸模式 getComputedStyle 未缓存（`content/modules/immersive.js:156-160`）— 从 022 移入
- **J4** transition:all 逐步替换（29 处）— 从 022 移入

## 执行要求

- 先读 `docs/workbench/CONVENTIONS.md`
- 按 TDD 执行：先写测试、再改实现
- 每项改动附 `文件路径:行号`
- 最终跑 `node --test tests/*.test.mjs` 全绿
