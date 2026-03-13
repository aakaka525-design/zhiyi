---
status: done
priority: P2
created: 2026-03-13
discussion: 028-sw-init-race-and-batch-fallback
---

# 028 — Service Worker `ensureReady()` 冷启动竞态修复

## 背景

028 讨论确认：`ensureReady()` 只检查 `translator !== null`，但 `init()` 在 `translator = new Translator()` 后 await `translator.init()`。并发消息可能拿到 `settings === null`、`providers === {}` 的半初始化实例。

受影响的 action：`translate`、`translateBatch`、`updateSettings`（依赖 translator 内部状态）。
不受影响：`tts*`（用 tts 依赖）、`getSettings` / `getHistory` / `addHistory`（用 storage 依赖）。

---

## 任务 A：缓存 init Promise 并处理失败复位

**文件**：`background/service-worker.js:112-118`

**当前**：

```javascript
async function ensureReady() {
    if (!translator) {
        await init();
    }
    return translator;
}
```

**修复**：

```javascript
let initPromise = null;

async function ensureReady() {
    if (!initPromise) {
        initPromise = init().catch(err => {
            initPromise = null;
            translator = null;
            throw err;
        });
    }
    await initPromise;
    return translator;
}
```

关键点：
- 所有并发调用者 await 同一个 `initPromise`，不会跳过
- init 失败时清回 `initPromise = null` 和 `translator = null`，下次消息会重试 init
- 不会进入"永久坏状态"（rejected promise 被永久缓存）

---

## 任务 B：补测试

**文件**：`tests/service-worker.test.mjs`（新建或追加到已有测试文件）

### B1. 并发 `ensureReady()` 只调用一次 `init()`

```javascript
// mock init() 为一个带延迟的 promise
// 并发调用两次 ensureReady()
// 断言 init() 只被调用了一次
// 断言两次调用都返回同一个 translator 实例
```

### B2. init 失败后 `ensureReady()` 可以重试

```javascript
// mock init() 第一次抛错
// 调用 ensureReady() → 应该抛错
// mock init() 第二次成功
// 再调用 ensureReady() → 应该成功返回 translator
```

---

## 不做的事

- 不改 `init()` 内部逻辑（Translator 构造和 init 流程不变）
- 不改 `handleMessage()` 的消息分发逻辑
- 不改 `routeMessage()` 或 message-router
- 不碰 content script / popup / options
- 不碰 `translateBatch` fallback（独立 task 029）

---

## 验收标准

- [x] `ensureReady()` 缓存 init promise，并发调用 await 同一个 promise
- [x] init 失败后 `initPromise` 和 `translator` 被清回 null，下次可重试
- [x] 测试覆盖并发只 init 一次
- [x] 测试覆盖 init 失败后可重试
- [x] 现有 message-router 测试不受影响
