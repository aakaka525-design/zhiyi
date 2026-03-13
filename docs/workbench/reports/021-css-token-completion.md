# 021 — content.css 残余硬编码颜色 token 化 & Float-window 朗读 lang & 历史回填标签报告

- 状态: done
- 对应任务: [tasks/021-css-token-completion.md](../tasks/021-css-token-completion.md)
- 来源讨论: [discussions/021-css-token-completion.md](../discussions/021-css-token-completion.md)
- 执行日期: 2026-03-13

## 结果概览

本轮一次性完成了 `A/B/C`：

- `A` `content.css` 现有 token 体系补齐到剩余的精确等值颜色位
- `B` Float-window 原文朗读语言传播修复
- `C` Sidebar 历史点击时回填 target language UI

## 已完成改动

### 21.1 A `content.css` token scope 与 20 处等值替换

[content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 顶部的 token scope 现在补入了：

- `#smart-translator-icon`

这样划词触发图标也能读到现有的 content-side design tokens。

在此基础上，这轮把 task 里列出的 20 处硬编码 hex 全部收口成现有 token，对应关系保持 1:1 等值替换：

- `#333333` → `var(--text-primary)`
- `#999999` → `var(--text-tertiary)`
- `#F4F4F4` → `var(--bg-secondary)`
- `#7A9A8B` → `var(--accent)`
- `#9CBAB0` → `var(--accent-light)`

覆盖范围包括：

- 划词翻译气泡
- 划词触发图标
- Sidebar 标题区 / 输入区 / 按钮
- Float-window 标题区
- 悬浮球与扇形菜单

这次按计划没有动：

- `rgba(122, 154, 139, ...)` 透明色
- `.st-float-header` 的 `background: #F9F9F9`
- token 定义本身

### 21.2 B Float-window 原文朗读语言修复

[float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) 现在把：

- `speakSourceBtn.onclick = () => speak(input.value);`

改成了：

- `speakSourceBtn.onclick = () => speak(input.value, 'auto');`

同时 `speak()` 顶部新增统一的：

- `resolvedLang = !lang || lang === 'auto' ? ST.detectLanguage(text) : lang`

并让两条路径都复用它：

- Google TTS 默认 voice 选择
- system TTS 的 `utterance.lang`

这样 Float-window 朗读英文或日文原文时，不会再因为 `lang` 缺失而把 Google 默认 voice 退回中文。

### 21.3 C Sidebar 历史点击回填 target language

[sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 在构造历史项时，新增了：

- `historyItem.dataset.targetLang = item.targetLang || ''`

历史点击时现在会：

- 回填 `targetLangSelect.value`
- 把结果标签更新成 `翻译结果 (${targetLang})`
- 如果历史项没有 `targetLang`，再回退到通用 `翻译结果`

这次没有改 storage schema，因为历史记录里本来就已经有 `targetLang`；修复点只是把现有字段重新同步回 UI。

## TDD 记录

本批按 test-first 执行，新增了 [css-token-and-speak.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/css-token-and-speak.test.mjs)。

首次运行 `node --test tests/css-token-and-speak.test.mjs` 时，3 个断言全部失败，分别覆盖：

- `content.css` token scope 还没有 `#smart-translator-icon`，且 20 处等值颜色仍是硬编码
- `float-window.js` 还没有把 source speak 传成 `'auto'`，Google 分支仍直接使用 `lang`
- `sidebar.js` 历史点击还没有存取 `targetLang`

补丁完成后，目标测试转绿。

在全量回归阶段，我还同步放宽了 3 条既有静态断言，使它们接受这次合法的新结构：

- [content-ux-static.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/content-ux-static.test.mjs)
- [error-state-tts-lang.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/error-state-tts-lang.test.mjs)
- [immersive-color-misc.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/immersive-color-misc.test.mjs)

这些修改没有扩大生产代码范围，只是让旧测试接受：

- token scope 中新增 `#smart-translator-icon`
- `resolvedLang` 从 Float-window 的系统回退分支提升到 `speak()` 顶部

## 验证

本批实际跑过：

```bash
node --test tests/css-token-and-speak.test.mjs
node --test tests/*.test.mjs
node --check content/modules/float-window.js
node --check content/modules/sidebar.js
git diff --check
```

验证结果：

- `tests/css-token-and-speak.test.mjs`：3/3 通过
- `node --test tests/*.test.mjs`：93/93 通过
- [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) `node --check` 通过
- [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- 划词气泡、Sidebar、Float-window、悬浮球与扇形菜单在未来改 token 时都会同步响应，不再残留旧 hex 颜色
- Float-window 使用 Google TTS 朗读英文 / 日文 / 韩文原文时，会选择正确的默认 voice，而不是回退到中文
- Sidebar 点击历史记录项后，顶部结果标签和结果朗读语言会跟随历史项自己的 `targetLang` 更新
