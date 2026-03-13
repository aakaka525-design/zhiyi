# 033 — Sidebar 翻译历史写入缺口修复执行报告

- 日期: 2026-03-13
- 状态: 已完成
- 对应任务: [033-sidebar-history-write.md](../tasks/033-sidebar-history-write.md)
- 对应讨论: [033-history-gap-and-batch-error.md](../discussions/033-history-gap-and-batch-error.md)

## 执行结果

### 已修改

- `background/modules/message-router.js`
  - 新增 `addHistory` action，转发到 `storage.addHistory(request.item)`

- `content/modules/sidebar.js`
  - sidebar 翻译成功后新增 `ST.sendMessage({ action: 'addHistory', item: ... })`
  - 写入内容包含 `source`、`target`、`sourceLang`、`targetLang`、`provider`
  - 保持 `refreshSidebarHistory()` 的现有 500ms 延迟刷新链路不变

- `docs/reference/architecture.md`
  - 在消息 Action 清单中补入 `addHistory`

- `tests/message-router.test.mjs`
  - 扩展 storage stub，支持 `addHistory()` 写入和后续 `getHistory()` 读取
  - 新增 `addHistory` action 路由测试

- `tests/content-tts-history.test.mjs`
  - 新增静态回归测试，锁住 sidebar 翻译成功后先写历史再刷新列表的行为

### 过程说明

- 先补 `message-router` 和 `sidebar` 的失败测试
- 首次运行 `node --test tests/message-router.test.mjs tests/content-tts-history.test.mjs tests/immersive-batch-error-count.test.mjs` 时：
  - `routeMessage({ action: 'addHistory' })` 返回 `Unknown action`
  - `sidebar.js` 不存在 `addHistory` 调用
- 随后按 task 最小范围补 `message-router`、`sidebar` 和 `architecture.md`

## 验证

执行了：

```bash
node --test tests/message-router.test.mjs tests/content-tts-history.test.mjs tests/immersive-batch-error-count.test.mjs
node --test tests/*.test.mjs
git diff --check -- background/modules/message-router.js content/modules/sidebar.js docs/reference/architecture.md tests/message-router.test.mjs tests/content-tts-history.test.mjs tests/immersive-batch-error-count.test.mjs docs/workbench/tasks/033-sidebar-history-write.md docs/workbench/reports/033-sidebar-history-write.md docs/workbench/tasks/034-immersive-batch-error-count.md docs/workbench/reports/034-immersive-batch-error-count.md
```

结果：

- 针对性测试：`19/19` 通过
- `node --test tests/*.test.mjs`：`100/100` 通过
- `git diff --check -- ...`：无输出

## 结论摘要

1. Sidebar 翻译成功后会显式写入历史，不再只刷新旧列表。
2. message-router 现在支持 content 侧通过 `addHistory` 走受支持的写路径。
3. architecture 的消息 Action 文档已经同步到当前实现。
