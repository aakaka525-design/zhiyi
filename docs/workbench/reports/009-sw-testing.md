# 009 — Service Worker 消息路由测试报告

- 状态: done
- 对应任务: [tasks/009-sw-testing.md](../tasks/009-sw-testing.md)
- 来源讨论: [discussions/009-next-direction.md](../discussions/009-next-direction.md)
- 执行日期: 2026-03-10

## 结果概览

本轮完成了 `009-sw-testing` 的既定范围：

- 新增 [message-router.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/message-router.js)，把 Service Worker 的 action switch 抽成可独立测试的纯路由模块
- 将 [service-worker.js](/Users/xa/Desktop/projiect/zhiyi/background/service-worker.js) 改为 `ensureReady() + routeMessage()` 的薄壳结构
- 新增 [message-router.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/message-router.test.mjs)，覆盖 10 个消息路由用例
- 回跑 008 的存储层 / 翻译器测试，确认这次拆分没有破坏既有回归层

本轮没有变更 `handleMessage` 的业务语义，也没有触碰 `chrome.commands`、`onInstalled`、TTS UI 层或权限模型。

## 已完成改动

### 9.1 抽取纯路由模块

[message-router.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/message-router.js) 现在集中处理以下 action：

- `translate`
- `translateBatch`
- `ttsGLM`
- `ttsOpenAI`
- `ttsGoogle`
- `playAudioOffscreen`
- `getSettings`
- `getHistory`
- `updateSettings`
- unknown action

这个模块只接收已就绪的：

- `translator`
- `storage`
- `tts`

没有再承担初始化时序或模块级单例管理。

### 9.2 Service Worker 薄壳化

[service-worker.js](/Users/xa/Desktop/projiect/zhiyi/background/service-worker.js) 保留了：

- `init()`：translator 初始化 + `createContextMenus()`
- 新增 `ensureReady()`：负责 `if (!translator) await init()`
- 顶层 listener 注册：
  - `setupMenuListeners()`
  - `chrome.runtime.onInstalled`
  - `chrome.commands.onCommand`
  - `chrome.runtime.onMessage`

`handleMessage()` 现在只做两件事：

1. `await ensureReady()`
2. 调用 `routeMessage(request, deps)`

这样把“启动副作用”和“消息分发”清晰拆开，同时保持原先 first-message 的 ready 语义不变。

### 9.3 新增路由测试

[message-router.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/message-router.test.mjs) 当前覆盖了 10 个用例：

- translate 路由
- translateBatch 路由
- `ttsGLM`
- `ttsOpenAI`
- `ttsGoogle`
- `playAudioOffscreen`
- `getSettings`
- `getHistory`
- `updateSettings`
- unknown action

测试使用 fake `translator` / `storage` / `tts` 依赖，只验证路由分发和返回结构，不把 `service-worker.js` 的初始化副作用耦合进测试。

## TDD 记录

本轮按 test-first 执行：

1. 先新增 [message-router.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/message-router.test.mjs)
2. 运行 `node --test tests/message-router.test.mjs`
3. 首次失败原因为：
   - `ERR_MODULE_NOT_FOUND`
   - 目标文件 [message-router.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/message-router.js) 尚不存在
4. 随后补最小实现与 `service-worker.js` 薄壳改造
5. 新测试转绿，再回跑 008 既有测试

## 验证

实际跑过的验证命令：

```bash
node --test tests/message-router.test.mjs
node --test tests/storage.test.mjs tests/translator.test.mjs
node --test tests/*.test.mjs
node --check background/service-worker.js
node --check background/modules/message-router.js
git diff --check
```

验证结果：

- `tests/message-router.test.mjs`：10/10 通过
- `tests/storage.test.mjs` + `tests/translator.test.mjs`：23/23 通过
- `node --test tests/*.test.mjs`：33/33 通过
- [service-worker.js](/Users/xa/Desktop/projiect/zhiyi/background/service-worker.js) `node --check` 通过
- [message-router.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/message-router.js) `node --check` 通过
- `git diff --check` 无输出

## 未做项

- 没有测试 `chrome.commands.onCommand` 路由
- 没有测试 `onInstalled` 迁移逻辑
- 没有处理 `[3.1-2]` 返回结构不统一
- 没有开始 TTS UI 统一或 `<all_urls>` 权限收敛
