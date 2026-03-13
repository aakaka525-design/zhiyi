# 024 — TTS voice 拆分三字段 + Sidebar 键盘快捷键(IME 保护) + History 子视图状态统一报告

- 状态: done
- 对应任务: [tasks/024-tts-voice-field-sidebar-keyboard.md](../tasks/024-tts-voice-field-sidebar-keyboard.md)
- 来源讨论: [discussions/024-tts-voice-field-sidebar-keyboard.md](../discussions/024-tts-voice-field-sidebar-keyboard.md)
- 执行日期: 2026-03-13

## 结果概览

本轮一次性完成了 `A/B/C`：

- `A` 把 `ttsVoice` 单字段拆成了 `ttsVoiceOpenai` / `ttsVoiceGoogle` / `ttsVoiceGlm`，并覆盖存储层迁移、Options dirty snapshot、Service Worker 未就绪时的内容脚本 fallback defaults、以及 popup/sidebar/float-window 三个消费面
- `B` 给 sidebar 的 textarea 增加了 `Enter` 触发翻译，并带 `!e.isComposing` 的 IME 保护
- `C` 在 [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 抽出了统一的 `switchHistoryTab(type)` helper，把子标签 active 状态、搜索框清空和内容加载收进同一入口

## 已完成改动

### 24.1 A TTS voice 拆成三个独立字段

[storage.js](/Users/xa/Desktop/projiect/zhiyi/src/core/storage.js) 的默认设置现在已经从：

- `ttsVoice`

切成：

- `ttsVoiceOpenai`
- `ttsVoiceGoogle`
- `ttsVoiceGlm`

同时 `sanitizeSettings()` 会把旧的单字段值按当前 `ttsProvider` 迁移进对应的新字段，并删除旧键。这样用户此前在某个 provider 上保存过的 voice 偏好不会因为切换 provider 而被另一个 select 静默覆盖。

我没有把迁移只留在存储层。[options-ui-state.js](/Users/xa/Desktop/projiect/zhiyi/options/options-ui-state.js) 的 dirty snapshot 也同步改成了三个字段；否则 Options 页未保存检测会继续盯着旧 `ttsVoice`。另外 [content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) 的 `mergeDefaults()` 也补了旧字段迁移，因为 Service Worker 未就绪时，内容脚本会直接走本地存储 fallback，那条链路也必须认识旧数据。

消费端方面，以下位置都已经按 provider 分别读取对应字段：

- [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js)
- [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js)
- [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js)

Options 自身的保存路径也从 `getSelectedTtsVoice()` 改成了 `collectTtsVoices()`，不会再把三个 provider 的 voice 偏好压回一个共享字段。

### 24.2 B Sidebar 回车翻译加上 IME 保护

[sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 现在给输入框加了：

- `Enter` 发送
- `Shift+Enter` 换行
- `!e.isComposing` 保护

这样侧边栏和 float-window 一样能用回车快速翻译，但不会在中文/日文/韩文输入法还处于组合态时，把确认候选词的 Enter 误当成“发送翻译”。

这轮没有顺手去改 float-window 的现有 IME 缺口，按 task 保持范围隔离。

### 24.3 C Options 历史子视图状态收口到统一 helper

[options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 现在新增了 `switchHistoryTab(type)`，统一处理 3 件事：

- 历史子标签的 `.active` 状态
- `history-search` 输入框清空
- `loadHistoryList(type)` 内容加载

以下三条路径都已经改成走这个 helper：

- history tab click
- 清空历史后回到 `recent`
- `loadTab('history')`

所以之前分散在不同入口的状态漂移已经一起收住了。它不仅修掉了 `024-C` 的“清空历史后 active tab 不同步”，也一并消掉了 `025-C` 暴露出的“切换视图后搜索框残留查询词”。

## TDD 记录

本轮按 test-first 执行：

- 新增 [tts-voice-sidebar-history.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/tts-voice-sidebar-history.test.mjs)
- 同步更新 [options-ui-state.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/options-ui-state.test.mjs)
- 同步更新 [css-token-and-speak.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/css-token-and-speak.test.mjs)

首次运行：

```bash
node --test tests/tts-voice-sidebar-history.test.mjs tests/options-ui-state.test.mjs tests/css-token-and-speak.test.mjs
```

时，4 个断言失败，覆盖：

- `float-window` 仍然读取 `settings.ttsVoice`
- `options-ui-state` 仍然只快照单字段 `ttsVoice`
- storage 还没有把旧 `ttsVoice` 迁移到 provider-specific 字段
- sidebar 还没有 IME-safe 的 Enter handler，也没有统一的 history helper

补丁完成后，这组目标测试全部转绿。

## 验证

本批实际跑过：

```bash
node --test tests/tts-voice-sidebar-history.test.mjs tests/options-ui-state.test.mjs tests/css-token-and-speak.test.mjs
node --test tests/*.test.mjs
node --check src/core/storage.js
node --check options/options.js
node --check options/options-ui-state.js
node --check popup/popup.js
node --check content/content.js
git diff --check
rg -n "settings\.ttsVoice\b" popup/popup.js content/modules/sidebar.js content/modules/float-window.js options/options.js content/content.js
```

验证结果：

- 目标测试组：10/10 通过
- `node --test tests/*.test.mjs`：103/103 通过
- [storage.js](/Users/xa/Desktop/projiect/zhiyi/src/core/storage.js) `node --check` 通过
- [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) `node --check` 通过
- [options-ui-state.js](/Users/xa/Desktop/projiect/zhiyi/options/options-ui-state.js) `node --check` 通过
- [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) `node --check` 通过
- [content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) `node --check` 通过
- `git diff --check` 无输出
- `rg -n "settings\.ttsVoice\b" ...` 无输出

说明：

- task 原始写的 `grep -n 'settings\.ttsVoice' ...` 会把新的 `settings.ttsVoiceOpenai/Google/Glm` 也误报出来，所以执行时收紧成了带单词边界的 `rg` 模式；这不是代码残留，而是原始校验表达式过宽。

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- 用户在 OpenAI / Google / GLM 之间切换并保存后，各 provider 的 voice 偏好都能独立保留
- sidebar 输入中文/日文/韩文时，输入法组合态下的 Enter 不会误触翻译；普通 Enter 能触发翻译，Shift+Enter 能换行
- Options 历史页中，tab click、清空历史、重新进入 history 页时，active tab、内容视图和搜索框状态保持一致
