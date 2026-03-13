# 015 — 错误反馈不可见 & CSS/文案清理报告

- 状态: done
- 对应任务: [tasks/015-error-visibility-and-css-cleanup.md](../tasks/015-error-visibility-and-css-cleanup.md)
- 来源讨论: [discussions/015-error-visibility-and-css-cleanup.md](../discussions/015-error-visibility-and-css-cleanup.md)
- 执行日期: 2026-03-13

## 第一批结果概览

按 `executing-plans` 默认批次，这一轮先完成了 `A/B/C`：

- `A` Popup 翻译错误不可见修复
- `B` Options `.history-target` CSS 规则重复修复
- `C` GLM TTS 测试错误消息文案清理

- `D` 关于页面引擎列表文案更新

## 已完成改动

### 15.1 A Popup 错误状态可见且会清掉旧结果

[popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 现在做了两处收口：

- `showError()` 会先执行 `elements.resultSection.classList.add('active')`
- `handleTranslate()` 的 `MAX_CHARS` 早返回路径会先 `clearResult()` 再 `showError(...)`

这样同时修掉了两个问题：

- 翻译失败时，错误内容不再被写进隐藏的 `result-section`
- 超长文本错误出现时，旧的 `currentResult` 和收藏按钮状态会先被清空，不会继续作用在上一条成功译文上

### 15.2 B Options 历史记录译文恢复多行截断

[options.css](/Users/xa/Desktop/projiect/zhiyi/options/options.css) 删除了第二条重复的 `.history-target` 规则，只保留原来的 3 行 clamp 样式：

- `display: -webkit-box`
- `-webkit-line-clamp: 3`
- `-webkit-box-orient: vertical`

`.history-source` 没有改，因为它原本只有一条规则，并不存在同类覆盖冲突。

### 15.3 C GLM TTS 缺 key 报错改成用户向文案

[options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 中 GLM TTS 测试缺少 key 时的报错已从：

- `请先填写 ppinfra API Key`

改为：

- `请先填写 DeepSeek API Key（用于 GLM TTS）`

这一轮只改运行时报错文案，没有扩大到 `options.html` 里其他此前有意保留的 `ppinfra` 平台说明。

## TDD 记录

本批按 test-first 执行，新增了 [error-visibility-css-cleanup.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/error-visibility-css-cleanup.test.mjs)。

首次运行 `node --test tests/error-visibility-css-cleanup.test.mjs` 时，3 个断言全部失败，分别覆盖：

- popup 的超长文本早返回路径没有先清旧状态，`showError()` 也没有显式展示结果区
- `options.css` 里 `.history-target` 仍存在重复规则
- `options.js` 里 GLM TTS 缺 key 仍提示 `ppinfra API Key`

随后补最小实现，再回跑目标测试转绿。

## 验证

本批实际跑过：

```bash
node --test tests/error-visibility-css-cleanup.test.mjs
node --test tests/*.test.mjs
node --check popup/popup.js
node --check options/options.js
git diff --check
```

验证结果：

- `tests/error-visibility-css-cleanup.test.mjs`：3/3 通过
- `node --test tests/*.test.mjs`：71/71 通过
- [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) `node --check` 通过
- [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) `node --check` 通过
- `git diff --check` 无输出

## 第二批补完

### 15.4 D 关于页引擎列表补齐真实能力范围

[options.html](/Users/xa/Desktop/projiect/zhiyi/options/options.html) 的关于页“多引擎驱动”文案已从：

- `支持 Google, OpenAI, Gemini 多种服务。`

改为：

- `支持 Google、OpenAI、Gemini、DeepSeek 等多种翻译引擎，并提供离线英译中能力。`

这次补齐了两个关键信息：

- 当前产品面已经存在的 `DeepSeek`
- 已被前序任务收窄后的离线能力边界：**仅英译中**

## 最终验证补充

在第一批验证基础上，又补跑并确认：

```bash
node --test tests/error-visibility-css-cleanup.test.mjs
node --test tests/*.test.mjs
node --check popup/popup.js
node --check options/options.js
git diff --check
```

最终结果：

- `tests/error-visibility-css-cleanup.test.mjs`：4/4 通过
- `node --test tests/*.test.mjs`：72/72 通过
- [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) `node --check` 通过
- [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- Popup 在翻译失败或超长文本时，会直接显示错误内容，而不是空白收起
- Popup 先前译文存在时，超长文本错误不会再让朗读/复制/收藏继续作用在旧结果上
- Options 历史记录中的译文区域恢复为最多 3 行截断，而不是单行省略
- 关于页“多引擎驱动”文案在真实页面布局下没有换行异常
