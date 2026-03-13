---
status: pending
priority: P2
created: 2026-03-13
---

# 023 — UI 打磨 & CSS 架构修复

## 背景

022 的延续，收录中低优先级的 UI 问题。不影响核心功能正确性，但影响视觉一致性、代码可维护性和边缘场景下的用户体验。

## 范围（讨论已收敛）

### 推荐

- **D2** 翻译气泡右/下边界定位修复（`content/modules/selection.js:136-137`）
  - 现状：只有左边界 `Math.max(10, ...)` 保护，无右溢出 clamp 和底部翻转
  - 修法：添加右边界 clamp（`Math.min(rect.left, viewport - bubbleWidth - 10)`）和底部翻转逻辑
- **E2** 清理重复 keyframe 定义
  - `popup/popup.css` 的 `@keyframes spin` 与 `options/theme.css` 重复（popup 已加载 theme.css）
  - `popup/popup.css` 的 `@keyframes slideUp` 与 `options/options.css` 重复（各自独立使用，无需合并）
  - 修法：删除 `popup/popup.css` 中重复的 `spin`（theme.css 已提供）
  - 注意：`theme.css` 的 `fadeIn` 不是死代码（被 `options/options.js:618,713` 使用），不要删
- **H1** --text-tertiary 对比度修复（WCAG AA）
  - 亮色模式：`#999999` → `#767676`（4.5:1 on white）
  - 暗色模式：`#787878` → `#949494`（4.5:1 on #1E222B）
  - 修改位置：`content/content.css:25` 和 `options/theme.css:84`
  - 只改 token 值，不顺手调其他颜色

### 可选

- **D1** 侧边栏/小窗 max-width 安全约束
- **D3** 翻译小窗固定定位适配
- **D4** 浮动球 resize 处理
- **E1** z-index 层级变量化
- **E3** st-fade-in 动画统一
- **E4** options.html inline style 提取
- **E5** content.css box-sizing
- **G2** Storage 非原子操作
- **I1** 浮动球菜单键盘支持
- **I2** 侧边栏/小窗焦点陷阱
- **I3** Options label for= 关联
- **J1** SVG querySelector 防御性 null 检查 — 从 022 移入
- **J2** Popup 功能按钮缺少执行确认链路 — 从 022 移入
- **J3** 沉浸模式 getComputedStyle 未缓存 — 从 022 移入
- **J4** transition:all 逐步替换 — 从 022 移入

### 已移除

- **F1** MutationObserver 重复创建 — 当前已有 `if (ST.observers.mutation) return;` 守卫
- **G1** Options settings snapshot 未同步 — `saveSettings()` 成功路径已更新 snapshot

## 执行要求

- 先读 `docs/workbench/CONVENTIONS.md`
- 按 TDD 执行：先写测试、再改实现
- 每项改动附 `文件路径:行号`
- 最终跑 `node --test tests/*.test.mjs` 全绿
