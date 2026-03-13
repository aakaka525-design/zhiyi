# 036 — Service Worker `ensureReady()` 冷启动竞态修复执行报告

- 日期: 2026-03-13
- 状态: 已完成
- 对应任务: [036-sw-ensureready-race.md](../tasks/036-sw-ensureready-race.md)
- 对应讨论: [036-sw-init-race-and-batch-fallback.md](../discussions/036-sw-init-race-and-batch-fallback.md)

## 执行结果

### 已修改

- `background/service-worker.js`
  - 新增可测试的 `createEnsureReadyManager()`
  - `ensureReady()` 现在复用同一个 in-flight init promise，不再让并发消息拿到半初始化 translator
  - init 失败时会同时清回 `translator` 和内部 `initPromise`
  - init 成功后也会释放内部 `initPromise`，保留已就绪 translator

- `tests/service-worker.test.mjs`
  - 新增 service-worker 侧 `chrome` stub，允许直接导入后台模块
  - 新增 `ensureReady awaits the same in-flight init and returns the same translator instance`
  - 新增 `ensureReady clears state after init failure so the next call can retry`

### 过程说明

- 先在 `tests/service-worker.test.mjs` 补两条失败测试，锁住并发冷启动和失败后重试语义
- 首次运行 `node --test tests/service-worker.test.mjs tests/translator.test.mjs` 时，`background/service-worker.js` 还没有导出可复用的 `ensureReady` 管理器，测试报错 `createEnsureReadyManager is not a function`
- 随后在 `service-worker.js` 抽出 `createEnsureReadyManager()` 并接回真实 `ensureReady()`
- 第一次实现曾把 `init()` 推迟到微任务里，导致并发测试在同步断言时看到 `initCalls === 0`；随后调整为同步触发 `init()`、异步复用同一个 promise

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

1. `ensureReady()` 现在不会在并发冷启动时泄露半初始化 translator。
2. init 失败后不会进入永久坏状态，下一个消息可以重试初始化。
3. `handleMessage()` 和既有 message-router 分发逻辑保持不变。
