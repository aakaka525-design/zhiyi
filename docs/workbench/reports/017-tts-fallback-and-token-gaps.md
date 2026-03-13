# 017 — Sidebar TTS 回退参数修复 & 残留硬编码颜色报告

- 状态: done
- 对应任务: [tasks/017-tts-fallback-and-token-gaps.md](../tasks/017-tts-fallback-and-token-gaps.md)
- 来源讨论: [discussions/017-tts-fallback-and-token-gaps.md](../discussions/017-tts-fallback-and-token-gaps.md)
- 执行日期: 2026-03-13

## 第一批结果概览

按 `executing-plans` 默认批次，这一轮先完成了 `A/B/C`：

- `A` Sidebar TTS provider fallback lang/speed 统一
- `B` Bubble 复制成功颜色 token 化
- `C` Sidebar 底部信息文字颜色 token 化

第二批已补完 `D`，本任务现已完成。

## 已完成改动

### 17.1 A Sidebar provider fallback 统一到 lang + speed

[sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 现在把 provider 内部 fallback 全部收口到：

- `speakSystem(text, lang, settings.ttsSpeed || 1.0)`

这轮具体做了 4 件事：

- `speak()` 调用 `openai / glm` provider 时补传 `lang`
- `speakOpenAI(text, lang, settings)` 的 no-key fallback 不再写死 `'zh'` 和 `1.0`
- `speakGLM(text, lang, settings)` 的 no-key / no-audioData fallback 不再写死 `'zh'`
- `speakGoogle(text, lang, settings)` 的 no-key fallback 现在也保留用户配置的语速

这样修掉了 Claude 在讨论里指出的真实断裂：当用户选择非系统 TTS，但 key 缺失或 provider 不能返回音频时，sidebar 回退到系统 TTS 不会再错误地强制中文朗读，语速也不会退回默认 `1.0`。

### 17.2 B Bubble 复制成功反馈对齐 content token

[selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) 的 bubble 复制成功色已从：

- `#00c853`

改为：

- `var(--accent)`

这样和 sidebar 的正向反馈颜色保持一致，也不再引入新的硬编码色值。

### 17.3 C Sidebar 底部信息文字对齐 token

[sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 底部信息块原本还残留：

- `color: #666`

现在已改成：

- `color: var(--text-secondary)`

这次只做 token 对齐，没有顺手改该块的其它内联样式。

## TDD 记录

本批按 test-first 执行，新增了 [tts-fallback-token-gaps.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/tts-fallback-token-gaps.test.mjs)。

首次运行 `node --test tests/tts-fallback-token-gaps.test.mjs` 时，2 个断言都失败，分别覆盖：

- sidebar provider fallback 还没把 `lang/speed` 传通
- bubble 复制成功色和 sidebar 底部信息块仍保留硬编码颜色

补丁完成后，目标测试转绿。第二批再把 popup 状态点的断言补进同一测试文件，并再次从失败转绿。

## 验证

本批实际跑过：

```bash
node --test tests/tts-fallback-token-gaps.test.mjs
node --test tests/*.test.mjs
node --check content/modules/sidebar.js
node --check content/modules/selection.js
git diff --check
```

验证结果：

- `tests/tts-fallback-token-gaps.test.mjs`：3/3 通过
- `node --test tests/*.test.mjs`：80/80 通过
- [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) `node --check` 通过
- [selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) `node --check` 通过
- `git diff --check` 无输出

## 第二批补完

### 17.4 D Popup 状态点颜色对齐主题 token

[popup.css](/Users/xa/Desktop/projiect/zhiyi/popup/popup.css) 的状态点现在不再使用硬编码灰色和绿色：

- `.status-dot` 从 `#D1D1D1` 改为 `var(--text-tertiary)`
- `.status-dot.active` 从 `#A5D6A7` 改为 `var(--success)`

同时按讨论约束，这轮没有引入新的 `theme` token，也直接删除了原来的绿色 glow `box-shadow`。

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- Sidebar 在 `openai/google/glm` provider 缺 key 或返回空音频时，会按原始文本语言回退到系统语音
- Sidebar 在上述 fallback 情况下，仍保留用户配置的 TTS 语速
- Bubble 复制成功后的颜色反馈与 sidebar 保持一致
