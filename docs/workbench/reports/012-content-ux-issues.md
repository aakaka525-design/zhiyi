# 012 — Content Script UX 问题修复报告

- 状态: done
- 对应任务: [tasks/012-content-ux-issues.md](../tasks/012-content-ux-issues.md)
- 来源讨论: [discussions/012-content-ux-issues.md](../discussions/012-content-ux-issues.md)
- 执行日期: 2026-03-12

## 结果概览

本轮完成了 `012` 收敛后的主线范围：

- 在 [content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 为内容脚本 UI 补上了 scoped design tokens，修复小窗、侧边栏、进度条等后续控件引用未定义 CSS 变量的问题
- 在 [floating-ball.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/floating-ball.js) 给悬浮球菜单补上了“翻译小窗”入口
- 删除了 [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 和 [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) 里绕过 `enableShortcut` 设置的本地快捷键旁路
- 把侧边栏底部提示改成“默认快捷键”，不再暗示当前实际绑定值就是 `Alt + S`

本轮没有实现：

- `B1` TTS 行为统一
- `C1/C2/C3` 三个低优先级内容区 UX 收尾项
- 任何 popup / options / service worker / manifest 变更

## 已完成改动

### 12.1 A1 Content Script UI 补 scoped tokens

[content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 顶部新增了一组只挂在扩展自有容器上的设计变量，覆盖：

- `#smart-translator-bubble`
- `.st-immersive-wrapper`
- `#st-sidebar`
- `#st-sidebar-toggle-btn`
- `#st-float-window`
- `#st-page-progress`
- `#st-floating-ball-container`
- `#st-toast`

这组变量补齐了内容脚本样式里真实消费到的 `--accent`、`--accent-light`、`--accent-glow`、`--bg-secondary`、`--bg-tertiary`、`--text-primary`、`--text-secondary`、`--text-tertiary`、`--border-color`、`--transition`、`--error`，同时避免了把 token 泄露到宿主页面全局 `:root`。

### 12.2 A2 悬浮球补翻译小窗入口

[floating-ball.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/floating-ball.js) 的 `menuData` 现在有 3 个页面内入口：

- 全页翻译
- 侧边栏
- 翻译小窗

新增项会直接调用 `ST.toggleFloatWindow()`，让小窗和悬浮球之间的产品入口对齐。

### 12.3 B2 移除 content script 本地快捷键旁路

以下两个本地 `document.addEventListener('keydown', ...)` 已删除：

- [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js)
- [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js)

这意味着 `Alt+S / Alt+W` 这类入口不再绕过 `manifest commands -> service worker -> content script` 主路径，也不会再绕过 `enableShortcut` 设置。

### 12.4 B3 快捷键提示改成默认值文案

[sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 底部提示从 `快捷键: Alt + S` 改成了 `默认快捷键: Alt + S`。这轮没有引入 `chrome.commands.getAll()` 动态查询链路，只做低风险文案收敛。

## TDD 记录

本轮按 test-first 执行：

1. 先新增 [content-ux-static.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/content-ux-static.test.mjs)
2. 首次运行 `node --test tests/content-ux-static.test.mjs` 时 4 个断言全部失败，分别覆盖：
   - content script 缺少 scoped token block
   - 悬浮球没有翻译小窗入口
   - 侧边栏仍保留本地 keydown listener，且文案不是“默认快捷键”
   - 小窗仍保留本地 `Alt+W` listener
3. 随后补最小实现，再回跑目标测试转绿
4. 最后回跑全量测试确认无回归

## 验证

实际跑过的验证命令：

```bash
node --test tests/content-ux-static.test.mjs
node --test tests/*.test.mjs
node --check content/modules/floating-ball.js
node --check content/modules/sidebar.js
node --check content/modules/float-window.js
git diff --check
```

验证结果：

- `tests/content-ux-static.test.mjs`：4/4 通过
- `node --test tests/*.test.mjs`：56/56 通过
- [floating-ball.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/floating-ball.js) `node --check` 通过
- [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) `node --check` 通过
- [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮没有在真实 Chrome 扩展环境手工点验。仍待人工确认的页面级行为有：

- 小窗、侧边栏、进度条在真实页面中的颜色和边框恢复正常
- 悬浮球菜单新增的“翻译小窗”入口点击后能正确打开/关闭小窗
- 关闭 `enableShortcut` 后，页面内不再被 `Alt+S / Alt+W` 本地旁路触发
- 侧边栏底部“默认快捷键”文案在真实页面布局下无截断或重叠
