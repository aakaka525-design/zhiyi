# 078 — `fetch()` 无 `AbortController` 修复报告

- 状态: done
- 对应任务: [tasks/078-fetch-no-abort-controller.md](../tasks/078-fetch-no-abort-controller.md)
- 来源讨论: [discussions/078-fetch-no-abort-controller.md](../discussions/078-fetch-no-abort-controller.md)
- 执行日期: 2026-03-14

## 结果概览

本轮按收窄后的边界完成了 `A + B + C + D + E + F + G + H`：

- 新增了共享 helper [fetch-with-timeout.js](/Users/xa/Desktop/projiect/zhiyi/src/core/fetch-with-timeout.js)，统一做 `AbortController + timeoutMessage` 映射。
- [google-free.js](/Users/xa/Desktop/projiect/zhiyi/src/core/google-free.js) 的 3 处网络请求已接入分层 timeout：翻译/备用翻译 `8000ms`，语言检测 `5000ms`。
- [openai.js](/Users/xa/Desktop/projiect/zhiyi/src/core/openai.js)、[gemini.js](/Users/xa/Desktop/projiect/zhiyi/src/core/gemini.js)、[deepseek.js](/Users/xa/Desktop/projiect/zhiyi/src/core/deepseek.js) 已按单条 `20000ms`、batch `45000ms` 接入。
- [tts.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/tts.js) 的 GLM / OpenAI / Google TTS 请求已统一到 `12000ms`，并把超时错误归一化成中文消息。
- 新增回归测试 [078-fetch-abort-controller.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/078-fetch-abort-controller.test.mjs)；`offline.js` 明确保留原样。

## 已完成改动

### 78.1 新增共享 fetch timeout helper

[fetch-with-timeout.js](/Users/xa/Desktop/projiect/zhiyi/src/core/fetch-with-timeout.js) 现在提供：

```javascript
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

行为边界保持得很窄：

- 只负责 `fetch` 超时和 `AbortError -> 中文消息`
- 不做 retry
- 不做日志
- 不做响应解析
- 不碰调用方已有的错误处理链

### 78.2 Google Free 现在会在慢失败时更早进入 fallback

[google-free.js](/Users/xa/Desktop/projiect/zhiyi/src/core/google-free.js) 的：

- `translate(...)`
- `translateFallback(...)`
- `detectLanguage(...)`

都已接入 `fetchWithTimeout(...)`。

这意味着：

- 主翻译接口挂起时，`translate(...)` 不会无限等，会在 `8000ms` 后进入已有 catch
- catch 会继续尝试 `translateFallback(...)`
- fallback 也挂起时，会在第二个 `8000ms` 后返回可读错误，交给上层 `translator.js` 的 fallback 链
- `detectLanguage(...)` 现在也不会无上限挂住 popup 内部流程

### 78.3 三个 LLM provider 现在都有分层网络超时

[openai.js](/Users/xa/Desktop/projiect/zhiyi/src/core/openai.js)、[gemini.js](/Users/xa/Desktop/projiect/zhiyi/src/core/gemini.js)、[deepseek.js](/Users/xa/Desktop/projiect/zhiyi/src/core/deepseek.js) 的 raw `fetch(...)` 都已替换为 `fetchWithTimeout(...)`。

当前分层是：

- 单条翻译：`20000ms`
- 批量翻译：`45000ms`

这样做的效果是：

- 单条翻译超时现在会在客户端 `30000ms` 前失败，给 fallback 留出空间
- 沉浸式 batch 超时会在客户端 `60000ms` 前失败，不再只靠客户端 message timeout 兜底

### 78.4 TTS 不再在客户端超时后继续悬挂僵尸 fetch

[tts.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/tts.js) 的：

- `handleTTSGLM(...)`
- `handleTTSOpenAI(...)`
- `handleTTSGoogle(...)`

都已经接到 `fetchWithTimeout(..., 12000, 'TTS 请求超时')`。

结果是：

- `12000ms < 15000ms` 客户端 message timeout
- Service Worker 会先返回 `TTS 请求超时`
- 不再出现客户端先超时、SW 侧 raw fetch 继续悬挂的僵尸请求

### 78.5 offline.js 明确保持不动

[offline.js](/Users/xa/Desktop/projiect/zhiyi/src/core/offline.js) 依然使用裸 `fetch(url)` 读取扩展内资源，没有被并入本轮。

这是刻意保留的边界，不是遗漏：

- 它不是外部网络请求
- 不存在 discussion 里讨论的“慢失败不触发 fallback + 僵尸连接”问题类别

## TDD 记录

本轮先新增了 [078-fetch-abort-controller.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/078-fetch-abort-controller.test.mjs)。

第一次运行时，失败点是准确的：

- `src/core/fetch-with-timeout.js` 不存在
- `google-free.js` / `openai.js` / `gemini.js` / `deepseek.js` / `tts.js` 都还没有导入 helper
- 这些文件里仍然存在 raw `fetch(...)`

也就是说，红灯直接指向了 task 要求的缺失实现，而不是测试写错。

补上最小实现后，专项测试转绿；随后全量回归也直接保持通过，不需要再为 `078` 调整旧测试。

## 验证

本轮实际 fresh 跑过：

```bash
node --test tests/078-fetch-abort-controller.test.mjs
node --test tests/*.test.mjs
node --check src/core/fetch-with-timeout.js
node --check src/core/google-free.js
node --check src/core/openai.js
node --check src/core/gemini.js
node --check src/core/deepseek.js
node --check background/modules/tts.js
git diff --check
```

验证结果：

- [078-fetch-abort-controller.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/078-fetch-abort-controller.test.mjs)：`5/5` 通过
- `node --test tests/*.test.mjs`：`272/272` 通过
- `node --check src/core/fetch-with-timeout.js`：通过
- `node --check src/core/google-free.js`：通过
- `node --check src/core/openai.js`：通过
- `node --check src/core/gemini.js`：通过
- `node --check src/core/deepseek.js`：通过
- `node --check background/modules/tts.js`：通过
- `git diff --check`：无输出

## Residual Risk

这轮刻意没有承诺：

- 修改 [translator.js](/Users/xa/Desktop/projiect/zhiyi/src/core/translator.js) 的 batch 串行 fallback 结构
- 保证 `translateBatchIndividually(...)` 整批一定在客户端 `60s` 内完成
- 为 `offline.js` 增加任何 timeout 机制

因此 residual risk 仍然是：

- 当一个 batch 中多个 item 连续命中 primary timeout + Google timeout 时，串行总时长仍可能超过客户端 `60s`

这条风险已在 task/discussion 中明确接受，不属于本轮漏修。

## 手动验证

这轮仍未做真实 Chrome 手测。待人工确认的页面级行为包括：

- 主 provider 慢失败时，sidebar / float-window / popup 是否会比之前更快进入 fallback 或报错
- TTS provider 慢失败时，客户端是否在 `15s` 内收到可读超时，而不是 generic message timeout
- 沉浸式 batch 在外部接口挂起时，是否会在 `60s` 前进入失败路径，而不是永远卡住
