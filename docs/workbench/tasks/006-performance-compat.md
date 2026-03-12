---
status: superseded
priority: P2
created: 2026-03-10
superseded_by: 007-lazy-init
---

# ~~006 — 收敛全站注入与默认副作用~~

> **已被 [007-lazy-init](007-lazy-init.md) 取代。** 编号 006 已被 cleanup 任务占用，本草稿的 A1 部分（懒初始化 + 默认副作用收敛）已迁移到 007，并补充了 onInstalled 迁移策略和收紧的完成标准。

## 背景

003 审核中与性能 / 兼容性相关的风险没有在 004 中处理，主要包括：

- 内容脚本默认在 `<all_urls>` 注入
- 启动时就创建侧边栏、小窗、悬浮球等 UI
- 多个观察器和广告拦截逻辑在所有站点默认生效
- 高侵入能力可能影响 Chrome Web Store 审核和复杂站点兼容性

这组问题改动面明显大于 005，因此单独立项。

## 任务目标

在不误伤现有核心翻译功能的前提下，减少默认启动成本和页面副作用，并明确 `<all_urls>` 相关策略边界。

## 修复 / 评估清单

### 6.1 懒初始化 UI

- [ ] `content/content.js` — 审查当前启动流程
- [ ] 侧边栏改为首次触发时创建，而不是启动即创建
- [ ] 悬浮小窗改为首次触发时创建，而不是启动即创建
- [ ] 悬浮球仅在设置允许时创建，并评估是否也应懒初始化

### 6.2 默认副作用收敛

- [ ] 审查 `content/modules/ad-blocker.js` 的默认启用路径
- [ ] 评估哪些副作用可以推迟到用户显式启用或首次使用后再挂载
- [ ] 收紧高频 `MutationObserver` / 定时扫描的默认启动条件

### 6.3 `<all_urls>` 与注入策略评估

- [ ] 盘点当前哪些功能真正依赖全站内容脚本
- [ ] 评估“保持 `<all_urls>` 但减少默认初始化”和“收敛到白名单 / optional host permissions”两条路径
- [ ] 如果需要产品决策，先在报告中写清 trade-off，再决定是否落代码

### 6.4 兼容性回归检查

- [ ] 检查懒初始化后是否影响划词翻译、快捷键、侧边栏、小窗入口
- [ ] 检查广告拦截在关闭状态下是否仍残留观察器或事件监听
- [ ] 记录不能仅靠静态检查确认的风险点，留给人工手测

## 非目标

- 不在本任务中建立自动化测试框架
- 不处理 PDF / 离线翻译 / Popup TTS 这类产品表面问题（这些归 005）
- 不做大规模模块重写或 TypeScript 化

## 执行要求

1. 先做启动路径和副作用盘点，再做代码改动
2. 若 `<all_urls>` 收缩需要产品决策，先在报告中说明，不要擅自猜测
3. 优先做不改变功能边界的懒初始化和默认副作用减少
4. 结果写入 `reports/006-performance-compat.md`

## 相关文档

- 讨论: [discussions/006-performance-compat.md](../discussions/006-performance-compat.md)
- 上游讨论: [discussions/004-critical-fixes.md](../discussions/004-critical-fixes.md)
- 上游报告: [reports/003-full-audit.md](../reports/003-full-audit.md)
