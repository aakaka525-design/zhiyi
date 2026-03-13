# 041 — UI 打磨 & CSS 架构修复报告

- 状态: done
- 对应任务: [tasks/041-ui-polish-and-architecture.md](../tasks/041-ui-polish-and-architecture.md)
- 来源讨论: [discussions/041-ui-polish-and-architecture.md](../discussions/041-ui-polish-and-architecture.md)
- 执行日期: 2026-03-13

## 结果概览

本轮完成了 `041` 收敛后的主体范围：

- **推荐**：`D2 + E2 + H1`

本轮没有实现可选项：

- `D1` 侧边栏/小窗 max-width 安全约束
- `D3` 翻译小窗固定定位适配
- `D4` 浮动球 resize 处理
- `E1` z-index 层级变量化
- `E3` st-fade-in 动画统一
- `E4` options.html inline style 提取
- `E5` content.css box-sizing
- `G2` Storage 非原子操作
- `I1` 浮动球菜单键盘支持
- `I2` 侧边栏/小窗焦点陷阱
- `I3` Options label `for=` 关联
- `J1` SVG querySelector 防御性 null 检查
- `J2` Popup 功能按钮缺少执行确认链路
- `J3` 沉浸模式 `getComputedStyle` 未缓存
- `J4` `transition: all` 逐步替换

按讨论结论，这些项目统一留给后续任务按需拾取，不在 `041` 内继续扩展。

## 已完成改动

### 41.1 D2 翻译气泡定位溢出修复

[content/modules/selection.js](/Users/xa/Desktop/projiect/zhiyi/.worktrees/feature-ui-update/content/modules/selection.js) 调整了气泡定位流程：

- `showBubble()` 现在先把 bubble 插入 DOM
- 然后根据实际 `offsetWidth / offsetHeight` 重新计算位置
- 新增 `calculateBubblePosition()` 统一处理边界约束

当前行为：

- 右边缘选区时，气泡会被 clamp 在视口内
- 底部选区时，气泡会翻转到选区上方
- 无有效 rect 时，仍保留原有 fallback 定位路径

这样修掉了原先只做左边界保护、没有右溢出和底部翻转的问题。

### 41.2 E2 重复 keyframe 清理

[popup/popup.css](/Users/xa/Desktop/projiect/zhiyi/.worktrees/feature-ui-update/popup/popup.css) 删除了本地的 `@keyframes spin`。

popup 继续复用 [popup/popup.html](/Users/xa/Desktop/projiect/zhiyi/.worktrees/feature-ui-update/popup/popup.html) 已加载的共享 [options/theme.css](/Users/xa/Desktop/projiect/zhiyi/.worktrees/feature-ui-update/options/theme.css) 中的 `spin` 定义，因此不影响 [popup/popup.js](/Users/xa/Desktop/projiect/zhiyi/.worktrees/feature-ui-update/popup/popup.js) 里 loading spinner 的内联动画名。

本轮没有合并 `slideUp`，也没有删除 `theme.css` 的 `fadeIn`，因为它们在当前代码中仍各自有实际使用点。

### 41.3 H1 `--text-tertiary` 对比度修复

以下 token 已调整到更高对比度：

- [options/theme.css](/Users/xa/Desktop/projiect/zhiyi/.worktrees/feature-ui-update/options/theme.css)
  - light: `#999999` -> `#767676`
  - dark: `#787878` -> `#949494`
- [content/content.css](/Users/xa/Desktop/projiect/zhiyi/.worktrees/feature-ui-update/content/content.css)
  - `#999999` -> `#767676`

本轮只改 token 值，没有顺手调整其他颜色规则，因此影响范围保持在已有 `var(--text-tertiary)` 使用点。

## TDD 记录

本轮按 test-first 执行，新增了 [ui-polish-architecture.test.mjs](/Users/xa/Desktop/projiect/zhiyi/.worktrees/feature-ui-update/tests/ui-polish-architecture.test.mjs)。

首次运行：

```bash
node --test tests/ui-polish-architecture.test.mjs
```

结果为 `5/5` 失败，覆盖了以下缺失行为：

- `selection.js` 还没有 `calculateBubblePosition()`
- `showBubble()` 还没有在 append 后按实际 bubble 尺寸重算位置
- `popup/popup.css` 仍有本地 `@keyframes spin`
- `content.css` / `theme.css` 的 `--text-tertiary` 仍是旧值

补丁完成后，同一测试文件达到 `5/5` 通过。

## 验证

本轮实际跑过：

```bash
node --test tests/ui-polish-architecture.test.mjs
node --test tests/*.test.mjs
node --check content/modules/selection.js
git diff --check
```

验证结果：

- `tests/ui-polish-architecture.test.mjs`：5/5 通过
- `node --test tests/*.test.mjs`：103/103 通过
- [content/modules/selection.js](/Users/xa/Desktop/projiect/zhiyi/.worktrees/feature-ui-update/content/modules/selection.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未在真实 Chrome 扩展环境中手工点验。仍待人工确认的页面级行为包括：

- 右边缘和底部划词时，bubble 的 clamp / 翻转位置是否符合预期
- 提升后的 `--text-tertiary` 在 popup、options、content 三个界面中的实际视觉层级是否合适
- popup loading spinner 在复用 shared `spin` keyframe 后，动画表现是否与之前一致
