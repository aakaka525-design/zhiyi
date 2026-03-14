# 058 — ST.sendMessage 可选超时 & 翻译调用点 opt-in & 语言 Select 响应 Storage 变更报告

- 状态: done
- 对应任务: [tasks/058-translate-timeout-and-reactive-select.md](../tasks/058-translate-timeout-and-reactive-select.md)
- 来源讨论: [discussions/058-translate-timeout-speak-cancel-reactive-select.md](../discussions/058-translate-timeout-speak-cancel-reactive-select.md)
- 执行日期: 2026-03-13

## 结果概览

本轮完成了 `A + C`：

- `A` 内容脚本侧的 `ST.sendMessage` 现在支持可选 timeout；sidebar 和 float-window 的翻译调用已显式 opt-in `30000ms`，翻译挂起时不再把 UI 永久锁死。
- `C` content 脚本的 `storage.onChanged` 现在会同步 sidebar / float-window 的语言 select，多 tab 下设置对象和 DOM 不再漂移。

## 已完成改动

### 58.1 A `ST.sendMessage` 可选超时

[utils.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/utils.js) 的 `ST.sendMessage` 现在支持：

```javascript
ST.sendMessage(message, timeoutMs = 0, timeoutMessage = '请求超时')
```

实现保持默认兼容：

- `timeoutMs <= 0` 时直接返回原始 request Promise
- 只有显式传 timeout 的调用才进入 `Promise.race(...)`
- `finally(() => clearTimeout(timeoutId))` 会清理 timer

这次没有改 background / translator / fetch 层，也没有引入 AbortController。

[sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 的翻译主调用现在是：

```javascript
await ST.sendMessage({ action: 'translate', ... }, 30000, '翻译请求超时');
```

[float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) 也同步加了同样的 `30000ms` 超时和错误消息。

这样一旦 service worker 无响应或翻译请求悬挂：

- `catch` 会拿到 `翻译请求超时`
- `finally` 会恢复被禁用的输入和按钮

这轮只给翻译调用做了 opt-in，没有把 `addHistory`、TTS 请求或 `playAudioOffscreen` 一起改动。

### 58.2 C 语言 Select 响应 storage 变更

[content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) 的 `chrome.storage.onChanged` handler 现在在更新 `ST.state.settings`、主题和悬浮球之后，会调用：

```javascript
ST.syncLanguageSelects?.();
```

同时新增了 `ST.syncLanguageSelects()`：

- 如果页面上存在 `#st-sidebar`
  - 同步 `#st-sidebar-source-lang`
  - 同步 `#st-sidebar-target-lang`
- 如果页面上存在 `#st-float-window`
  - 同步 `#st-float-target-lang`

它只读取最新的 `ST.state.settings`，不会改已有的初始化路径，也不区分“本 tab 写入”还是“其他 tab 写入”；同 tab 冗余同步一次是无害的。

## TDD 记录

本轮先新增了 [058-translate-timeout-reactive-select.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/058-translate-timeout-reactive-select.test.mjs)。

首次运行时，两条子测试都失败，分别暴露出：

- `utils.js` 还没有可选 timeout 的 `ST.sendMessage`
- `content.js` 还没有 `ST.syncLanguageSelects()` 和 `storage.onChanged` 的 DOM 同步

实现补丁后，这条新增测试转绿。  
全量验证阶段没有新增实现改动，只保留了任务范围内的补丁。

## 验证

本轮实际跑过：

```bash
node --test tests/058-translate-timeout-reactive-select.test.mjs
node --test tests/*.test.mjs
node --check content/modules/utils.js
node --check content/modules/sidebar.js
node --check content/modules/float-window.js
node --check content/content.js
git diff --check
```

验证结果：

- [058-translate-timeout-reactive-select.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/058-translate-timeout-reactive-select.test.mjs)：2/2 通过
- `node --test tests/*.test.mjs`：195/195 通过
- [utils.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/utils.js) `node --check` 通过
- [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) `node --check` 通过
- [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) `node --check` 通过
- [content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- sidebar / float-window 翻译请求在超时后会恢复控件并显示错误
- 两个 tab 同时打开 sidebar 或小窗时，一边修改语言后另一边的 select 会同步刷新
- 同 tab 自己修改语言后，不会因为 `storage.onChanged` 二次同步导致异常闪动
