# 020 — Sidebar/Float-window 翻译错误反馈 & Copy 竞态 & 死代码清理报告

- 状态: done
- 对应任务: [tasks/020-translate-error-swallowing.md](../tasks/020-translate-error-swallowing.md)
- 来源讨论: [discussions/020-translate-error-swallowing.md](../discussions/020-translate-error-swallowing.md)
- 执行日期: 2026-03-13

## 结果概览

本轮一次性完成了 `A/B/C`：

- `A` Sidebar / Float-window 翻译错误反馈补齐
- `B` Sidebar 复制按钮 innerHTML 竞态修复
- `C` 删除 `content.js` 死 `refreshSettings` handler

## 已完成改动

### 20.1 A Sidebar / Float-window 翻译错误反馈

[sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 和 [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) 现在都在：

- `if (response && response.text)`

后补了显式 `else` 分支。

当后台返回的是：

- `{ error: '...' }`

而不是带 `text` 的成功结果时，两条路径现在都会：

- 显示结果区域
- 渲染 `翻译失败: ${response?.error || '未知错误'}`
- 用 `var(--error)` 着色

这次没有动 [utils.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/utils.js) 的 `ST.sendMessage()` 契约，也没有改 [service-worker.js](/Users/xa/Desktop/projiect/zhiyi/background/service-worker.js) 的错误包装方式；修复点只落在消费 `{ error }` 的两个调用方。

### 20.2 B Sidebar 复制按钮竞态修复

[sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 里：

- `const originalIcon = copyBtn.innerHTML`

现在提升到了 `onclick` 外层，只在绑定时捕获一次。

这样修掉了快速连续点击时的竞态：第二次点击不再把“已复制”文字本身当作原始图标，按钮最终会稳定恢复为 SVG。

### 20.3 C 删除死 `refreshSettings` handler

[content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) 里的：

- `case 'refreshSettings': ...`

已经删除。

在执行前我重新核过，这个 message handler 没有调用方；内容侧设置同步实际依赖的是同文件中的 `chrome.storage.onChanged`。  
所以这次删除只是清掉无效分支，没有改变现有设置同步行为。

## TDD 记录

本批按 test-first 执行，新增了 [translate-error-feedback.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/translate-error-feedback.test.mjs)。

首次运行 `node --test tests/translate-error-feedback.test.mjs` 时，3 个断言全部失败，分别覆盖：

- sidebar / float-window 还没有处理 `{ error }` 响应的 else 分支
- sidebar 复制按钮仍在点击时重新捕获 `originalIcon`
- `content.js` 里仍保留 `refreshSettings` dead case

补丁完成后，目标测试转绿。

## 验证

本批实际跑过：

```bash
node --test tests/translate-error-feedback.test.mjs
node --test tests/*.test.mjs
node --check content/modules/sidebar.js
node --check content/modules/float-window.js
node --check content/content.js
git diff --check
```

验证结果：

- `tests/translate-error-feedback.test.mjs`：3/3 通过
- `node --test tests/*.test.mjs`：90/90 通过
- [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) `node --check` 通过
- [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) `node --check` 通过
- [content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- Sidebar / Float-window 在翻译失败时，会显示红色错误文案而不是静默回到空结果区
- Sidebar 连续点击复制按钮后，图标会正常恢复，不会永久停在“已复制”
- 删除 `refreshSettings` case 后，Options 保存设置仍然通过 `chrome.storage.onChanged` 正常同步到内容页
