# 025 — Theme.css 硬编码残留色值 + Popup charCount 颜色未重置报告

- 状态: done
- 对应任务: [tasks/025-theme-hardcode-charcount.md](../tasks/025-theme-hardcode-charcount.md)
- 来源讨论: [discussions/025-theme-hardcode-charcount-search-reset.md](../discussions/025-theme-hardcode-charcount-search-reset.md)
- 执行日期: 2026-03-13

## 结果概览

本轮完成了 `A/B`：

- `A` [theme.css](/Users/xa/Desktop/projiect/zhiyi/options/theme.css) 中 3 处旧版蓝/青色硬编码已统一收回到 `var(--accent-glow)`
- `B` [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 的字符计数颜色逻辑已收口到 `updateCharCount()`，程序化赋值路径不再残留错误的红色状态

`025-C` 没有执行，继续按 discussion 收口并入 `024-C` 同一条 history 子视图状态修复链。

## 已完成改动

### 25.1 A 共享主题层去掉旧版蓝/青色硬编码

[theme.css](/Users/xa/Desktop/projiect/zhiyi/options/theme.css) 这 3 处共享样式现在都改成了现有 token：

- `.btn-primary:hover`
  - 从 `rgba(102, 126, 234, 0.4)` 改成 `var(--accent-glow)`
- `.input:focus`
  - 从 `rgba(102, 126, 234, 0.2)` 改成 `var(--accent-glow)`
- `.tag-accent`
  - 从 `rgba(0, 217, 255, 0.15)` 改成 `var(--accent-glow)`

这样 popup 和 options 共享主题层不再夹带旧设计的蓝/青色残留，也自动保持亮暗模式的一致性，因为 `--accent-glow` 已经在 `:root` 和 `body.dark-mode` 里分别定义好了。

### 25.2 B Popup 字符计数颜色逻辑统一收口

[popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 之前有两套字符计数逻辑：

- `input` 事件 handler 里一套，负责文本和颜色
- `updateCharCount()` 里一套，只负责文本

程序化赋值不会触发 `input` 事件，所以：

- 清空
- 粘贴
- 语言互换
- popup 打开时自动填入选中文本

这些路径都会只更新文本，不重置颜色。

现在这套逻辑已经收成一处：

- `elements.sourceText.addEventListener('input', updateCharCount);`
- `updateCharCount()` 同时负责：
  - 更新 `${len} / ${MAX_CHARS}`
  - 在超限时设为 `var(--error)`
  - 正常时恢复为 `var(--text-muted)`

这样所有调用 `updateCharCount()` 的路径都会保持同一套视觉状态，不再残留“文本已恢复正常但仍然是红色”的错误印象。

## TDD 记录

本轮按 test-first 执行，新增了 [theme-charcount.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/theme-charcount.test.mjs)。

首次运行：

```bash
node --test tests/theme-charcount.test.mjs
```

时，2 个子测试全部失败，分别覆盖：

- `theme.css` 仍然保留 3 处旧版蓝/青色硬编码
- popup 的 `input` handler 仍然内联字符计数颜色逻辑，而 `updateCharCount()` 还没有负责颜色恢复

补丁完成后，目标测试转绿。

## 验证

本批实际跑过：

```bash
node --test tests/theme-charcount.test.mjs
node --test tests/*.test.mjs
node --check popup/popup.js
git diff --check
grep -n 'rgba(102, 126, 234' options/theme.css
grep -n 'rgba(0, 217, 255' options/theme.css
```

验证结果：

- [theme-charcount.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/theme-charcount.test.mjs)：2/2 通过
- `node --test tests/*.test.mjs`：100/100 通过
- [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) `node --check` 通过
- `git diff --check` 无输出
- `grep -n 'rgba(102, 126, 234' options/theme.css` 无输出
- `grep -n 'rgba(0, 217, 255' options/theme.css` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- popup 输入超长文本后再清空、粘贴短文本、交换语言或打开时自动带入选中文本，字符计数颜色都能恢复为正常 muted 状态
- popup / options 中使用共享主题样式的按钮 hover、输入框 focus、语言 tag 都不再出现旧版蓝/青色视觉残留

## 阻塞说明

`024` 本轮没有执行。当前仓库里仍然只有 discussion：

- [024-tts-voice-field-sidebar-keyboard.md](/Users/xa/Desktop/projiect/zhiyi/docs/workbench/discussions/024-tts-voice-field-sidebar-keyboard.md)

还缺：

- `tasks/024-tts-voice-field-sidebar-keyboard.md`
- `reports/024-tts-voice-field-sidebar-keyboard.md`

所以它继续保持文档阻塞态。
