---
status: done
priority: P1
created: 2026-03-10
---

# 009 — Service Worker 消息路由测试

## 背景

008 建立了 storage.js 和 translator.js 的测试基础。Service Worker 是项目的消息中枢，所有前端（popup、content script、options）的后台通信都经过它。当前 `handleMessage()` 内联在 `service-worker.js` 中，无法独立测试——import 就会触发顶层 listener 注册。

本任务抽取消息路由 seam，使其可独立测试。

## 相关讨论

- 方向讨论: [discussions/009-next-direction.md](../discussions/009-next-direction.md)
- 测试方案来源: [discussions/006-cleanup.md](../discussions/006-cleanup.md)（B3 讨论）
- 008 测试报告: [reports/008-testing.md](../reports/008-testing.md)

## 当前 handleMessage 结构

`background/service-worker.js:96-131` 的 `handleMessage(request, sender)` 处理以下 action：

| Action | 依赖 | 返回 |
|--------|------|------|
| `translate` | `translator.translate()` | `{ text, provider, from, to }` |
| `translateBatch` | `translator.translateBatch()` | `{ results }` |
| `ttsGLM` | `handleTTSGLM(request)` | TTS 结果 |
| `ttsOpenAI` | `handleTTSOpenAI(request)` | TTS 结果 |
| `ttsGoogle` | `handleTTSGoogle(request)` | TTS 结果 |
| `playAudioOffscreen` | `playAudioViaOffscreen()` | 播放结果 |
| `getSettings` | `StorageManager.getSettings()` | 设置对象 |
| `getHistory` | `StorageManager.getHistory()` | 历史数组 |
| `updateSettings` | `translator.refreshSettings()` | `{ success: true }` |
| unknown | 无 | `{ error: 'Unknown action' }` |

## 任务清单

### 9.1 抽取消息路由模块

- [x] 创建 `background/modules/message-router.js`
- [x] 导出 `routeMessage(request, deps)` 函数
- [x] `deps` 参数结构：
  ```javascript
  {
      translator: translatorInstance,  // 已就绪的 translator 实例
      storage: StorageManager,         // 或其静态方法
      tts: { handleTTSGLM, handleTTSOpenAI, handleTTSGoogle, playAudioViaOffscreen },
  }
  ```
- [x] `routeMessage` 内部是**纯 action switch**，不引用模块级变量，不负责初始化
- [x] `routeMessage` 接收已就绪的 `deps.translator`，不包含 `ensureTranslator()` 逻辑

### 9.2 改造 service-worker.js

- [x] `service-worker.js` 保留 ready 状态管理：
  - 保留 `init()`（translator 初始化 + createContextMenus）
  - 新增 `ensureReady()` 封装懒初始化（`if (!translator) await init()`）
  - `handleMessage` 改为先 `await ensureReady()` 获取 translator，再调用 `routeMessage(request, deps)`
  - `deps` 使用真实依赖构造
- [x] 保留顶层 listener 注册（`onInstalled`、`onCommand`、`onMessage`、menu）
- [x] 保留 `INSTALLED_MIGRATIONS` 和 `forwardCommandToActiveTab` 在 `service-worker.js` 中（不在 009 测试范围）
- [x] 确认改造后所有现有功能不受影响

### 9.3 路由测试

- [x] 创建 `tests/message-router.test.mjs`
- [x] 构造 fake `deps`：
  - `translator`：带 fake `translate`/`translateBatch`/`refreshSettings` 的对象
  - `storage`：使用 008 的 chrome-stub + 真实 StorageManager（或 fake 静态方法）
  - `tts.*`：使用 fake handler
- [x] 测试用例覆盖：

**翻译路由**
- [x] `action: 'translate'` → 调用 `deps.translator.translate()`，返回结果
- [x] `action: 'translateBatch'` → 调用 `deps.translator.translateBatch()`，返回 `{ results }`

**TTS 路由**
- [x] `action: 'ttsGLM'` → 调用 `deps.tts.handleTTSGLM`
- [x] `action: 'ttsOpenAI'` → 调用 `deps.tts.handleTTSOpenAI`
- [x] `action: 'ttsGoogle'` → 调用 `deps.tts.handleTTSGoogle`
- [x] `action: 'playAudioOffscreen'` → 调用 `deps.tts.playAudioViaOffscreen`

**存储路由**
- [x] `action: 'getSettings'` → 调用 `deps.storage.getSettings()`
- [x] `action: 'getHistory'` → 调用 `deps.storage.getHistory()`

**设置更新**
- [x] `action: 'updateSettings'` → 调用 `deps.translator.refreshSettings()`，返回 `{ success: true }`

**未知 action**
- [x] 未知 action → 返回 `{ error: 'Unknown action' }`

### 9.4 验证

- [x] `node --test tests/*.test.mjs` 全部通过（包含 008 的 23 个 + 009 新增的）
- [x] `node --check background/service-worker.js`
- [x] `node --check background/modules/message-router.js`
- [x] 现有 008 测试不被破坏

---

## 非目标

- 不测试 `chrome.commands.onCommand` 路由（那需要 `chrome.tabs` stub）
- 不测试 `onInstalled` 迁移逻辑（007 已有回归脚本）
- 不重构 TTS UI 层
- 不改 `<all_urls>` 权限模型
- 不处理 `[3.1-2]` 返回结构不统一（可作为 009 后的相邻后续）

## 执行要求

1. **先做 9.1 抽取，再做 9.2 改造，最后 9.3 测试**
2. **9.2 改造后立即跑 008 的测试确认无回归**
3. **不修改 `handleMessage` 的业务逻辑** — 只做结构拆分
4. **报告写入** `reports/009-sw-testing.md`

## 相关文档

- 方向讨论: [discussions/009-next-direction.md](../discussions/009-next-direction.md)
- 008 测试报告: [reports/008-testing.md](../reports/008-testing.md)
- Service Worker 当前代码: `background/service-worker.js`
