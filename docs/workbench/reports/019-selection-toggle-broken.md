# 019 — 划词翻译开关修复 & Options toast 去重 & 死设置清理报告

- 状态: done
- 对应任务: [tasks/019-selection-toggle-broken.md](../tasks/019-selection-toggle-broken.md)
- 来源讨论: [discussions/019-selection-toggle-broken.md](../discussions/019-selection-toggle-broken.md)
- 执行日期: 2026-03-13

## 结果概览

本轮一次性完成了 `A/B/C`：

- `A` `enableSelection` 开关真正接入 selection handler
- `B` Options `showToast()` 去重
- `C` `enableHover` 死设置清理

## 已完成改动

### 19.1 A `enableSelection` 开关生效

[selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) 现在在两个入口上都做了运行时 early return：

- `ST.handleMouseUp`
- `ST.handleDoubleClick`

两处都改成优先检查：

- `if (!ST.state.settings?.enableSelection) return;`

这次按讨论收口，没有去改 `bindEvents()` 的绑定逻辑，也没有动 `handleMouseDown`。这样可以直接复用 [content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) 里现有的 `chrome.storage.onChanged` 设置同步链路，让用户在 Options 保存开关后，当前页面上的 selection handler 立刻按新设置生效。

### 19.2 B Options toast 去重

[options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 的 `showToast(message, type)` 现在在创建新 toast 前会执行：

- `document.querySelectorAll('.toast').forEach(el => el.remove())`

这次和 popup 的 `018-B` 保持一致，避免保存、测试或复制快捷键提示连续触发时在 Options 页堆叠多个 toast。

### 19.3 C `enableHover` 死设置清理

这轮把 `enableHover` 从两处默认值定义里删除：

- [storage.js](/Users/xa/Desktop/projiect/zhiyi/src/core/storage.js) 的 `DEFAULT_SETTINGS`
- [content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) 的 `mergeDefaults()`

在执行前我重新扫过全仓，`enableHover` 没有 UI、没有运行时读取、没有消息路径，所以这次删除只是去掉无效配置位，没有改变现有功能行为。

## TDD 记录

本批按 test-first 执行，新增了 [selection-toggle.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/selection-toggle.test.mjs)。

首次运行 `node --test tests/selection-toggle.test.mjs` 时，3 个断言全部失败，分别覆盖：

- `selection.js` 两个 handler 还没有 `enableSelection` 检查
- `options.js` 的 `showToast()` 还没有去重
- `enableHover` 仍残留在两处 defaults 中

补丁完成后，目标测试转绿。

## 验证

本批实际跑过：

```bash
node --test tests/selection-toggle.test.mjs
node --test tests/*.test.mjs
node --check content/modules/selection.js
node --check options/options.js
node --check src/core/storage.js
node --check content/content.js
git diff --check
```

验证结果：

- `tests/selection-toggle.test.mjs`：3/3 通过
- `node --test tests/*.test.mjs`：87/87 通过
- [selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) `node --check` 通过
- [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) `node --check` 通过
- [storage.js](/Users/xa/Desktop/projiect/zhiyi/src/core/storage.js) `node --check` 通过
- [content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- 在 Options 关闭“划词翻译”并保存后，当前已打开页面与刷新后的页面都不会再弹出划词图标或气泡
- 在 Options 再次开启“划词翻译”并保存后，selection 交互会恢复
- Options 连续触发保存 / 测试 / 复制快捷键提示时，只保留最新一条 toast
