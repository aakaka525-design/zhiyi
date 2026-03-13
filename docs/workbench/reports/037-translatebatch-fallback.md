# 037 — `Translator.translateBatch()` 回退链补齐执行报告

- 日期: 2026-03-13
- 状态: 已完成
- 对应任务: [037-translatebatch-fallback.md](../tasks/037-translatebatch-fallback.md)
- 对应讨论: [036-sw-init-race-and-batch-fallback.md](../discussions/036-sw-init-race-and-batch-fallback.md)

## 执行结果

### 已修改

- `src/core/translator.js`
  - `translateBatch()` 的 openai/gemini batch 路径新增 `try/catch`
  - provider batch 抛错时，会回退到逐条 `translate()`，复用既有 provider -> Google -> offline 回退链
  - provider batch 返回 `''` 或缺槽位时，也会只对缺失条目补走 `translate()`
  - 逐条路径新增 per-item `try/catch`，单条失败返回 `''`，不会中断整批

- `tests/translator.test.mjs`
  - 新增 `translateBatch retries empty provider batch slots through translate fallback parity`
  - 新增 `translateBatch falls back to per-item translate when provider batch throws`
  - 新增 `translateBatch does not fail the whole batch when the selected provider has no key`
  - 新增 `translateBatch keeps processing when one per-item translate call still fails`

### 过程说明

- 先补 `translateBatch()` 的失败测试，覆盖讨论里确认的两类缺口：batch 抛错、batch 返回空槽位
- 首次运行 `node --test tests/service-worker.test.mjs tests/translator.test.mjs` 时：
  - 空槽位场景直接返回 `['', '']`
  - batch throw 和缺 key 场景会把错误直接冒出，整批失败
  - 非 batch provider 的逐条路径在单条失败时会提前中断
- 随后只在 `Translator` 层收口，不改 `openai.js` / `gemini.js` 的 provider-local retry
- 最终实现比 task 伪码更严一点：不仅兜住 batch throw，也把 provider 返回的 `''` / 缺槽位重新接回 `Translator.translate()` 的统一回退链

## 验证

执行了：

```bash
node --test tests/service-worker.test.mjs tests/translator.test.mjs
node --test tests/*.test.mjs
git diff --check -- background/service-worker.js src/core/translator.js tests/service-worker.test.mjs tests/translator.test.mjs docs/workbench/tasks/036-sw-ensureready-race.md docs/workbench/reports/036-sw-ensureready-race.md docs/workbench/tasks/037-translatebatch-fallback.md docs/workbench/reports/037-translatebatch-fallback.md
```

结果：

- 针对性测试：`19/19` 通过
- `node --test tests/*.test.mjs`：`108/108` 通过
- `git diff --check -- ...`：无输出

## 结论摘要

1. `translateBatch()` 现在和 `translate()` 一样，能落回 Translator 层的 Google/offline 回退链。
2. provider-local retry 产出的 `''` 或缺槽位，不会再被静默当作最终结果。
3. 单条文本翻译失败不会中断同批剩余文本。
