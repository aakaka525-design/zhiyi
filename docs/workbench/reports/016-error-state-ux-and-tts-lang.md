# 016 — 错误态交互空转 & TTS 语言参数修复报告

- 状态: done
- 对应任务: [tasks/016-error-state-ux-and-tts-lang.md](../tasks/016-error-state-ux-and-tts-lang.md)
- 来源讨论: [discussions/016-error-state-ux-and-tts-lang.md](../discussions/016-error-state-ux-and-tts-lang.md)
- 执行日期: 2026-03-13

## 第一批结果概览

按 `executing-plans` 默认批次，这一轮先完成了 `A/B/C`：

- `A` Popup 错误态隐藏无效操作按钮
- `B` Sidebar / Bubble / Float-window 错误颜色 token 化
- `C` Sidebar / Float-window 系统 TTS 语言兜底修复

第二批已补完 `D/E`，本任务现已完成。

## 已完成改动

### 16.1 A Popup 错误态改为显式状态类

[popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 现在把错误态收口为 `resultSection` 的状态类，而不是内联显示控制：

- `showError()` 改为 `classList.add('active', 'error-state')`
- `showResult()` 会移除 `error-state`
- `clearResult()` 会同时移除 `active` 和 `error-state`

[popup.css](/Users/xa/Desktop/projiect/zhiyi/popup/popup.css) 增加了：

- `.result-section.error-state .result-actions { display: none; }`

这样翻译失败时，错误内容仍然可见，但“朗读 / 复制 / 收藏”不会继续空转。

### 16.2 B Content 侧错误颜色统一到 token

这轮把 3 处错误展示统一收口到 `var(--error)`：

- [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js)：catch 路径从 `#ff5252` 改为 `var(--error)`
- [selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js)：`renderBubbleMessage()` 错误色从硬编码红色改为 `var(--error)`
- [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js)：补上 catch 路径错误色，并在成功路径显式重置 `resultText.style.color = ''`

### 16.3 C 系统 TTS 对 auto / undefined 语言做统一兜底

[sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 的 `speakSystem()` 现在会：

- 对 `!lang || lang === 'auto'` 时调用 `ST.detectLanguage(text)`
- 再映射到 `zh-CN / en-US / ja-JP / ko-KR`

[float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) 的系统 TTS fallback 也做了同样处理。

这样修掉了两条原有问题路径：

- Sidebar 朗读原文把 `'auto'` 直接传给系统语音
- Float-window 朗读原文完全不传语言参数

## TDD 记录

本批按 test-first 执行，新增了 [error-state-tts-lang.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/error-state-tts-lang.test.mjs)。

首次运行 `node --test tests/error-state-tts-lang.test.mjs` 时，3 个断言全部失败，分别覆盖：

- Popup 结果区还没有 `error-state` 状态类和对应 CSS 隐藏规则
- Content 侧仍有硬编码错误色，float-window 也没有错误色与成功重置
- Sidebar / Float-window 的系统 TTS 还没有对 `'auto'` 和 `undefined` 做语言兜底

补丁完成后，目标测试转绿。第二批再把 `D/E` 的断言补进同一测试文件，并再次从失败转绿。

## 验证

本批实际跑过：

```bash
node --test tests/error-state-tts-lang.test.mjs
node --test tests/*.test.mjs
node --check popup/popup.js
node --check content/modules/sidebar.js
node --check content/modules/float-window.js
node --check content/modules/selection.js
node --check content/modules/utils.js
git diff --check
```

验证结果：

- `tests/error-state-tts-lang.test.mjs`：5/5 通过
- `node --test tests/*.test.mjs`：77/77 通过
- [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) `node --check` 通过
- [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) `node --check` 通过
- [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) `node --check` 通过
- [selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) `node --check` 通过
- [utils.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/utils.js) `node --check` 通过
- `git diff --check` 无输出

## 第二批补完

### 16.4 D isPluginElement 补齐浮球容器

[utils.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/utils.js) 的 `ST.isPluginElement()` 现在把 `#st-floating-ball-container` 也视为扩展自有 UI。

这样 [selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) 的 `handleMouseDown()` 在用户点击或拖拽悬浮球时，不会再把浮球自身动作误判成页面点击去清掉翻译气泡或图标。

这次只补了单项 selector，没有顺手做数组驱动重构。

### 16.5 E Content CSS 重复注释块清理

[content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 删除了重复的一组“侧边栏 (Sidebar) 样式”注释块，只保留首个标题注释。

这是纯清理项，没有改任何运行时样式逻辑。

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- Popup 翻译失败时，结果区只显示错误内容，不再显示可点击但无反应的操作按钮
- Sidebar / Bubble / Float-window 的错误文本在真实主题下使用一致的错误色
- Sidebar 原文朗读在源语言为“自动检测”时会按检测结果发音
- Float-window 原文朗读在未显式传语言时不会再退回系统默认语言
