# 034 — 沉浸式批量翻译部分失败计数修正执行报告

- 日期: 2026-03-13
- 状态: 已完成
- 对应任务: [034-immersive-batch-error-count.md](../tasks/034-immersive-batch-error-count.md)
- 对应讨论: [033-history-gap-and-batch-error.md](../discussions/033-history-gap-and-batch-error.md)

## 执行结果

### 已修改

- `content/modules/immersive.js`
  - 在 `response.results` 分支内把 falsy 槽位计入 `errorCount`
  - 保持 `translatedCount += batch.length` 不变，继续表示 processed count
  - toast 文案逻辑保持不变，由修正后的 `errorCount` 驱动

- `tests/immersive-batch-error-count.test.mjs`
  - 新增动态测试夹具，直接执行 `ST.toggleImmersive()`
  - 覆盖 4 种场景：
    - 全部成功
    - 部分失败
    - 全部失败
    - `results` 短于 batch
  - 同时验证进度最终仍到 `100`

### 过程说明

- 先补动态失败测试复现 `immersive.js` 的 batch 行为
- 首次红灯时，部分失败 / 全部失败 / 缺槽位三组用例都显示：
  - 最终 toast 仍为 `翻译完成！共 3 个段落`
  - 说明 falsy 槽位没有进入 `errorCount`
- 随后只在 `immersive.js` 的 `batch.forEach` 内补最小 `else { errorCount++; }`

## 验证

执行了：

```bash
node --test tests/message-router.test.mjs tests/content-tts-history.test.mjs tests/immersive-batch-error-count.test.mjs
node --test tests/*.test.mjs
git diff --check -- background/modules/message-router.js content/modules/sidebar.js content/modules/immersive.js docs/reference/architecture.md tests/message-router.test.mjs tests/content-tts-history.test.mjs tests/immersive-batch-error-count.test.mjs docs/workbench/tasks/033-sidebar-history-write.md docs/workbench/reports/033-sidebar-history-write.md docs/workbench/tasks/034-immersive-batch-error-count.md docs/workbench/reports/034-immersive-batch-error-count.md
```

结果：

- 针对性测试：`19/19` 通过
- `node --test tests/*.test.mjs`：`100/100` 通过
- `git diff --check -- ...`：无输出

## 结论摘要

1. 沉浸式批量翻译不再把 `''` / `undefined` 结果静默算作成功。
2. 最终 toast 现在会反映真实失败段落数。
3. 进度条仍表示 processed count，没有改动既有语义。
