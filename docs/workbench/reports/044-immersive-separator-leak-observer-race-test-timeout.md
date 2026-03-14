# 044 — 沉浸式分隔符清理、Observer 竞态守卫与设置页测试超时报告

- 状态: done
- 对应任务: [tasks/044-immersive-separator-leak-observer-race-test-timeout.md](../tasks/044-immersive-separator-leak-observer-race-test-timeout.md)
- 来源讨论: [discussions/044-immersive-separator-leak-observer-race-test-timeout.md](../discussions/044-immersive-separator-leak-observer-race-test-timeout.md)
- 执行日期: 2026-03-13

## 结果概览

本轮完成了 `A/B/C`：

- `A` 关闭沉浸式翻译时现在会一并清掉 inline 路径残留的 `.st-translation-separator`
- `B` MutationObserver 回调现在会捕获 `observerRunId`，并在入口和 `await` 返回后都校验 run identity
- `C` 设置页的 API/TTS 测试现在都有超时保护，不会再因为上游挂死而无限 loading

## 已完成改动

### 44.1 A 取消路径补清理 `.st-translation-separator`

[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的关闭分支现在改成：

```javascript
document.querySelectorAll('.st-immersive-translation, .st-immersive-wrapper, .st-translation-separator').forEach(el => el.remove());
```

这样 inline 注入路径附加到原节点上的 `" → "` 分隔符也会随取消一起移除，避免 cancel → reopen 后累积多个分隔符。

本轮没有修改：

- inline 注入逻辑
- block 注入逻辑
- `injectTranslation()` 的重复注入守卫

### 44.2 B Observer callback 改为带 run identity 守卫

[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的 `startMutationObserver()` 现在会在创建 observer 前 capture：

```javascript
const observerRunId = ST.state.immersiveRunId;
```

observer callback 入口改成：

```javascript
if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== observerRunId) {
    ST.stopMutationObserver();
    return;
}
```

同时在 `await ST.sendMessage(...)` 返回后、注入译文前再次校验：

```javascript
if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== observerRunId) return;
```

这样即使出现 `cancel -> 立刻 reopen`：

- 旧 observer callback 在入口没看到 `false` 也没关系
- 一旦 `await` 返回后发现 run id 已变，就会直接跳过 stale 注入
- `finally` 里的 `pendingTranslations` 清理仍会照常执行

本轮没有改：

- `stopMutationObserver()` 的实现
- observer 的 `observe()` 配置
- `pendingTranslations` 的 `finally` 清理

### 44.3 C 设置页 API/TTS 测试加超时

[options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 顶部新增了通用 helper：

```javascript
function withTimeout(promise, ms, message = '请求超时') {
    let timeoutId;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(message)), ms);
        }),
    ]).finally(() => clearTimeout(timeoutId));
}
```

`testApiConnection()` 现在会：

- 创建 `AbortController`
- 用 `setTimeout(() => controller.abort(), 10000)` 触发 10 秒超时
- 给 `openai / gemini / deepseek` 三个 fetch 都加 `signal: controller.signal`
- 在 `AbortError` 时显示 `✗ 连接超时`
- 在 `finally` 里 `clearTimeout(timeoutId)`

`testTTS()` 现在对两段异步链都包了超时：

- `requestTtsTestAudio(...)` → `withTimeout(..., 15000, 'TTS 请求超时')`
- `chrome.runtime.sendMessage({ action: 'playAudioOffscreen', ... })` → `withTimeout(..., 15000, '播放超时')`

本轮没有改：

- `requestTtsTestAudio()` 内部 provider 逻辑
- `playSystemTtsTest()`
- `saveSettings()`、`loadSettings()`、`bindEvents()`

## TDD 记录

本轮按 test-first 执行，先新增了 [immersive-observer-test-timeout.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/immersive-observer-test-timeout.test.mjs)。

首次运行：

```bash
node --test tests/immersive-observer-test-timeout.test.mjs
```

时 4 个子测试全部失败，分别覆盖：

- 取消沉浸式翻译后分隔符没有被清理
- observer 没有 capture `observerRunId`，也没有在 `await` 后重校验
- API 连通性测试没有 `AbortController + timeout`
- TTS 测试没有同时覆盖“取音频”和“播放”两段超时

补丁完成后目标测试转绿。

## 验证

本轮实际跑过：

```bash
node --test tests/immersive-observer-test-timeout.test.mjs
node --test tests/*.test.mjs
node --check content/modules/immersive.js
node --check options/options.js
git diff --check
```

验证结果：

- [immersive-observer-test-timeout.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/immersive-observer-test-timeout.test.mjs)：4/4 通过
- `node --test tests/*.test.mjs`：160/160 通过
- [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) `node --check` 通过
- [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- 沉浸式翻译取消后，页面上不再残留 `" → "` 分隔符
- cancel → reopen 后，旧 observer callback 不会向新 run 注入 stale 译文
- 设置页 API 连通性测试在上游长时间无响应时会在 10 秒后恢复按钮状态并展示超时文案
- 设置页 TTS 测试在“取音频”或“播放”任一阶段挂住时都会在 15 秒后恢复按钮状态并展示超时文案
