# 028 — Options API 测试防重复 + 历史去重加 targetLang + Sidebar 复制 await 报告

- 状态: done
- 对应任务: [tasks/028-api-test-disable-history-dedup-copy-await.md](../tasks/028-api-test-disable-history-dedup-copy-await.md)
- 来源讨论: [discussions/028-api-test-disable-history-dedup-copy-await.md](../discussions/028-api-test-disable-history-dedup-copy-await.md)
- 执行日期: 2026-03-13

## 结果概览

本轮一次性完成了 `A/B/C`：

- `A` options 页的 API 测试按钮现在在请求期间会 `disabled`，不会再被快速重复点击
- `B` 历史记录去重从“只按 source”改成“按 source + targetLang”，同文本不同目标语言可并存
- `C` sidebar 的复制按钮现在会等待剪贴板写入成功后再显示“已复制”，失败时不再给假成功反馈

## 已完成改动

### 28.1 A Options API 测试按钮增加 disable 守卫

[options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 的 `testApiConnection()` 现在在进入加载态时会：

- `btn.classList.add('loading')`
- `btn.disabled = true`

并在 `finally` 中恢复：

- `btn.classList.remove('loading')`
- `btn.disabled = false`

这让 OpenAI / Gemini / DeepSeek 三个“测试连接”按钮的行为与同文件里的 `testTTS()` 对齐。  
本轮没有再额外加前置 `if (btn.disabled) return`，保持为最小补丁。

### 28.2 B 历史记录去重加入 targetLang

[storage.js](/Users/xa/Desktop/projiect/zhiyi/src/core/storage.js) 的 `addHistory()` 去重条件现在从：

- `h.source !== item.source`

改成：

- `!(h.source === item.source && h.targetLang === item.targetLang)`

语义变化是：

- 同 `source` + 同 `targetLang`：仍然去重，只保留最新一条
- 同 `source` + 不同 `targetLang`：允许并存

这修复了：

- `hello -> zh`
- `hello -> ja`

会互相覆盖的问题，同时保留现有的 `MAX_HISTORY` 限制和其它历史记录行为不变。

### 28.3 C Sidebar 复制反馈等待真实成功

[sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 的 copy handler 现在改为 `async`，并在成功路径上：

- `await navigator.clipboard.writeText(resultContent.innerText)`

之后才把按钮改成“已复制”，再定时恢复原图标。

失败路径只保留：

- `console.error('复制失败:', err)`

没有新增 toast，也没有改变 popup 的复制交互模型。这让 sidebar 和 popup 至少在“不会显示虚假成功反馈”这点上对齐。

## TDD 记录

本轮按 test-first 执行，新增了 [api-test-dedup-copy.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/api-test-dedup-copy.test.mjs)，并同步先修改了两组既有测试基线：

- [storage.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/storage.test.mjs)
- [translate-error-feedback.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/translate-error-feedback.test.mjs)

首次运行：

```bash
node --test tests/api-test-dedup-copy.test.mjs tests/storage.test.mjs tests/translate-error-feedback.test.mjs
```

时红灯，覆盖了 3 类缺口：

- `testApiConnection()` 还没有 `btn.disabled = true/false`
- `addHistory()` 仍然只按 `source` 去重
- sidebar copy handler 还没有 `await navigator.clipboard.writeText(...)`

随后补最小实现，目标测试转绿。

## 验证

本轮实际跑过：

```bash
node --test tests/api-test-dedup-copy.test.mjs tests/storage.test.mjs tests/translate-error-feedback.test.mjs
node --test tests/*.test.mjs
node --check options/options.js
node --check src/core/storage.js
node --check content/modules/sidebar.js
git diff --check
```

验证结果：

- 目标测试组：16/16 通过
- `node --test tests/*.test.mjs`：113/113 通过
- [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) `node --check` 通过
- [storage.js](/Users/xa/Desktop/projiect/zhiyi/src/core/storage.js) `node --check` 通过
- [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- options 页连续快速点击 OpenAI / Gemini / DeepSeek “测试连接”按钮时，只会发起一轮请求
- 同一源文本翻译到不同目标语言后，历史页和 sidebar 最近记录会保留多条记录
- sidebar 在剪贴板权限失败或页面上下文限制下，不再先显示“已复制”后实际复制失败
