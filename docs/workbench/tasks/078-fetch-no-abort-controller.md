---
status: done
priority: P2
created: 2026-03-14
---

# 078 — 翻译/TTS `fetch()` 无 `AbortController` — 慢失败不触发 fallback + 超时后僵尸连接

- 来源讨论: [discussions/078-fetch-no-abort-controller.md](../discussions/078-fetch-no-abort-controller.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/078-fetch-no-abort-controller.md](../discussions/078-fetch-no-abort-controller.md)（完整讨论记录 + Codex 审阅）

## 背景

Service Worker 中 4 个网络翻译 provider（google-free、openai、gemini、deepseek）和 TTS 模块共 11 处 `fetch()` 调用全部没有 `AbortController`，没有任何超时机制。

客户端侧（content script / popup）已有 `sendMessage` 超时保护（058/060 添加），但这只能恢复 UI，不能取消 SW 侧的底层 `fetch()` 请求。

**两个实际后果**：
1. **慢失败不触发 fallback**：`translator.translate()` 的 fallback 链（主 provider → Google → Offline）只对快失败有效（HTTP 错误、网络断开）。对慢失败（DNS 挂起、服务器无响应），`fetch()` 永不返回 → fallback 永不触发 → 翻译能力降级不了
2. **僵尸连接累积**：客户端 sendMessage 超时后，SW 侧 fetch 继续运行。用户重试 → 新 fetch 启动 → 旧 fetch 还在 → 多个并发僵尸请求消耗 API 配额/触发限流

**本轮不承诺的事**：`translateBatchIndividually` 串行处理多个 item，即使每个 item 有 fetch 超时，连续多个 item 都 hit primary + google fallback 超时时，整批仍可能超过客户端 60s。batch 总时长问题不在本轮承诺范围内，作为残余风险接受。

Codex 审阅结论：
- 方向接受：给 fetch 加 AbortController
- 范围：4 个网络翻译 provider + tts.js，不含 offline.js（扩展内资源）
- timeout 必须分层，不能一刀切
- AbortError 统一映射成中文可读错误，不裸透传
- 实现方式：共享 helper，不接受 11 处手写

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `src/core/fetch-with-timeout.js` | A：新建共享 helper |
| `src/core/google-free.js` | B：3 处 fetch 替换 |
| `src/core/openai.js` | C：2 处 fetch 替换 |
| `src/core/gemini.js` | D：2 处 fetch 替换 |
| `src/core/deepseek.js` | E：1 处 fetch 替换 |
| `background/modules/tts.js` | F：3 处 fetch 替换 |
| `tests/078-fetch-abort-controller.test.mjs` | G：回归测试 |

## 超时分层

| 类别 | fetch 超时 | 客户端 sendMessage 超时 | 约束 |
|------|-----------|------------------------|------|
| Google Free translate / fallback | 8s | 30s（sidebar/FW）, 60s（batch 单项） | < 30s |
| Google Free detectLanguage | 5s | 无（popup 内部） | 快速操作 |
| LLM 单条（OpenAI / Gemini / DeepSeek） | 20s | 30s（sidebar/FW） | < 30s |
| LLM batch（OpenAI / Gemini） | 45s | 60s（immersive batch） | < 60s |
| TTS（OpenAI / Google / GLM） | 12s | 15s（060 添加） | < 15s |

## 任务清单

### 必做

#### A. 新建共享 helper — `src/core/fetch-with-timeout.js`

- [x] 新建 `src/core/fetch-with-timeout.js`：

  ```javascript
  /**
   * 带超时的 fetch 包装
   * 超时后 abort 请求并抛出可读错误，不裸透传 AbortError
   */
  export function fetchWithTimeout(url, options = {}, timeoutMs, timeoutMessage = '请求超时') {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      return fetch(url, { ...options, signal: controller.signal })
          .catch(err => {
              if (err.name === 'AbortError') {
                  throw new Error(timeoutMessage);
              }
              throw err;
          })
          .finally(() => clearTimeout(timeoutId));
  }
  ```

  行为说明：
  - 只包 fetch timeout，不做 retry、日志、响应解析
  - `AbortError` → 转换为 `new Error(timeoutMessage)` → 调用方 catch 看到的是中文错误消息
  - 其他错误原样 throw → 不改变现有错误处理行为
  - `finally` 清理 timeout → 正常响应时不触发 abort
  - 不处理 `options` 中已有 `signal` 的情况 — 当前无调用方传 signal

#### B. `google-free.js` — 3 处 fetch 替换

- [x] 文件顶部添加 import：

  ```javascript
  import { fetchWithTimeout } from './fetch-with-timeout.js';
  ```

- [x] `translate` 方法（`google-free.js:45`）：

  ```javascript
  /* 改前 */
  const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
      method: 'GET',
      headers: {
          'Accept': 'application/json',
      },
  });

  /* 改后 */
  const response = await fetchWithTimeout(`${this.baseUrl}?${params.toString()}`, {
      method: 'GET',
      headers: {
          'Accept': 'application/json',
      },
  }, 8000, '翻译请求超时');
  ```

- [x] `translateFallback` 方法（`google-free.js:100`）：

  ```javascript
  /* 改前 */
  const response = await fetch(`https://clients5.google.com/translate_a/t?${params.toString()}`);

  /* 改后 */
  const response = await fetchWithTimeout(
      `https://clients5.google.com/translate_a/t?${params.toString()}`,
      {},
      8000,
      '翻译请求超时'
  );
  ```

- [x] `detectLanguage` 方法（`google-free.js:141`）：

  ```javascript
  /* 改前 */
  const response = await fetch(`${this.baseUrl}?${params.toString()}`);

  /* 改后 */
  const response = await fetchWithTimeout(
      `${this.baseUrl}?${params.toString()}`,
      {},
      5000,
      '语言检测超时'
  );
  ```

  行为说明：
  - 3 处 `fetch()` → `fetchWithTimeout()`
  - translate / fallback：8s 超时，远小于客户端 30s
  - detectLanguage：5s 超时，只在 popup 内部使用
  - 超时后抛出可读中文错误 → 进入模块已有的 catch 处理链
  - translate 超时 → catch → 调用 `translateFallback` → fallback 也超时 → throw → translator.js 的 fallback 链继续到 offline

#### C. `openai.js` — 2 处 fetch 替换

- [x] 文件顶部添加 import：

  ```javascript
  import { fetchWithTimeout } from './fetch-with-timeout.js';
  ```

- [x] `translate` 方法（`openai.js:59`）：

  ```javascript
  /* 改前 */
  const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { ... },
      body: JSON.stringify({ ... }),
  });

  /* 改后 */
  const response = await fetchWithTimeout(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { ... },
      body: JSON.stringify({ ... }),
  }, 20000, '翻译请求超时');
  ```

- [x] `translateBatch` 方法（`openai.js:124`）：

  ```javascript
  /* 改前 */
  const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { ... },
      body: JSON.stringify({ ... }),
  });

  /* 改后 */
  const response = await fetchWithTimeout(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { ... },
      body: JSON.stringify({ ... }),
  }, 45000, '批量翻译请求超时');
  ```

  行为说明：
  - 单条翻译 20s，batch 翻译 45s
  - 不改 `headers`、`body` 内容 — 只在 fetch 调用处替换
  - 超时后进入模块已有的 catch → throw → translator.js fallback

#### D. `gemini.js` — 2 处 fetch 替换

- [x] 文件顶部添加 import：

  ```javascript
  import { fetchWithTimeout } from './fetch-with-timeout.js';
  ```

- [x] `translate` 方法（`gemini.js:65`）：fetch 调用添加 `20000, '翻译请求超时'` 参数，与 C 同构

- [x] `translateBatch` 方法（`gemini.js:149`）：fetch 调用添加 `45000, '批量翻译请求超时'` 参数，与 C 同构

  行为说明：
  - 与 C（openai.js）完全同构的改法
  - Gemini 的 batch catch 块内还有逐条 fallback（`gemini.js:199-208`），这些逐条调用走 `this.translate()` → 也使用 `fetchWithTimeout` → 也有超时保护

#### E. `deepseek.js` — 1 处 fetch 替换

- [x] 文件顶部添加 import：

  ```javascript
  import { fetchWithTimeout } from './fetch-with-timeout.js';
  ```

- [x] `translate` 方法（`deepseek.js:47`）：fetch 调用添加 `20000, '翻译请求超时'` 参数，与 C 的单条翻译同构

  行为说明：
  - DeepSeek 没有 batch 方法，只有单条翻译
  - 超时值 20s，与 OpenAI / Gemini 单条一致

#### F. `tts.js` — 3 处 fetch 替换

- [x] 文件顶部添加 import：

  ```javascript
  import { fetchWithTimeout } from '../../src/core/fetch-with-timeout.js';
  ```

  注意路径：`tts.js` 在 `background/modules/`，需要 `../../` 到项目根再进 `src/core/`

- [x] `handleTTSGLM`（`tts.js:70`）：

  ```javascript
  /* 改前 */
  const response = await fetch('https://api.ppinfra.com/v3/glm-tts', {
      method: 'POST',
      headers: { ... },
      body: JSON.stringify({ ... })
  });

  /* 改后 */
  const response = await fetchWithTimeout('https://api.ppinfra.com/v3/glm-tts', {
      method: 'POST',
      headers: { ... },
      body: JSON.stringify({ ... })
  }, 12000, 'TTS 请求超时');
  ```

- [x] `handleTTSOpenAI`（`tts.js:110`）：同构，12000ms，'TTS 请求超时'

- [x] `handleTTSGoogle`（`tts.js:150`）：同构，12000ms，'TTS 请求超时'

  行为说明：
  - 3 处 TTS fetch 统一 12s 超时
  - 12s < 客户端 15s sendMessage 超时 → SW 侧先超时 → 客户端收到可读错误消息（而非等 15s 后才看到 generic 超时）
  - `catch(err) { return { error: err.message } }` — err.message 现在是 'TTS 请求超时'（中文），不是 'The user aborted a request'（英文 AbortError 默认文案）

#### G. 回归测试

- [x] 新建 `tests/078-fetch-abort-controller.test.mjs`，至少覆盖：
  1. **A — helper 存在且导出 `fetchWithTimeout`**：静态断言 `src/core/fetch-with-timeout.js` 存在且包含 `export function fetchWithTimeout`
  2. **A — helper 包含 AbortController 和 AbortError 转换**：静态断言 helper 包含 `AbortController`、`controller.abort()`、`err.name === 'AbortError'`
  3. **B — google-free.js 导入 helper 且 3 处使用 fetchWithTimeout**：静态断言 google-free.js 包含 `import { fetchWithTimeout }` 且包含 3 处 `fetchWithTimeout(` 调用
  4. **B — google-free.js 不包含裸 `fetch(`**：静态断言 google-free.js 中除 import 语句外不包含裸 `fetch(` 调用
  5. **C — openai.js 导入 helper 且使用 fetchWithTimeout**：静态断言同 B 模式
  6. **D — gemini.js 导入 helper 且使用 fetchWithTimeout**：同上
  7. **E — deepseek.js 导入 helper 且使用 fetchWithTimeout**：同上
  8. **F — tts.js 导入 helper 且使用 fetchWithTimeout**：静态断言 tts.js 包含 `import { fetchWithTimeout }` 且 3 处 TTS handler 使用
  9. **超时分层正确**：静态断言各文件的超时值在合理范围内（Google Free ≤ 10s，LLM 单条 ≤ 25s，LLM batch ≤ 50s < 60s，TTS ≤ 14s < 15s）
  10. **offline.js 未修改**：静态断言 `src/core/offline.js` 不包含 `fetchWithTimeout`，仍使用裸 `fetch`

#### H. 现有测试兼容性

- [x] 修改完 B-F 后运行 `node --test tests/*.test.mjs`，如果现有测试因 import 路径或正则变化而失败，需要更新

  更新原则：
  - 保留原有断言意图
  - 在正则中使用 `[\\s\\S]*` 或放宽匹配以兼容新增的 import 语句
  - 不删除原有断言

**不要做的事**：
- 不要修改 `src/core/offline.js` — 扩展内资源请求，不是网络请求
- 不要修改客户端 `sendMessage` 超时值 — 058/060 已设定，不需要调整
- 不要在 helper 中添加 retry 逻辑 — 超时后由 translator.js 的 fallback 链处理
- 不要在 helper 中添加日志/响应解析 — 只做 fetch timeout
- 不要修改 `translator.js` 的 fallback 链 — fallback 链本身正确
- 不要承诺 `translateBatchIndividually` 整批一定在 60s 内完成 — 串行多项超时累加可能超 60s，作为残余风险接受
- 不要碰 immersive.js、content.js、sidebar.js、float-window.js、popup.js、selection.js、content.css、popup.css、options.js、floating-ball.js、ad-blocker.js、storage.js、translator.js、message-router.js、service-worker.js、offscreen.js、manifest.json、menus.js、state.js、utils.js

## 不做的事

- **不做** 修改 offline.js
- **不做** 修改客户端 sendMessage 超时
- **不做** 在 helper 中添加 retry / 日志 / 响应解析
- **不做** 修改 translator.js fallback 链
- **不做** 承诺 batch 总时长 < 60s

## 验证要求

- [x] `node --test tests/078-fetch-abort-controller.test.mjs` 通过
- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check src/core/fetch-with-timeout.js` 通过
- [x] `node --check src/core/google-free.js` 通过
- [x] `node --check src/core/openai.js` 通过
- [x] `node --check src/core/gemini.js` 通过
- [x] `node --check src/core/deepseek.js` 通过
- [x] `node --check background/modules/tts.js` 通过
- [x] `git diff --check` 无输出
