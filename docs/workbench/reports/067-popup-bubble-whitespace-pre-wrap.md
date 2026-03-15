# 067 — Popup 和 Bubble 翻译结果丢失换行符报告

- 状态: done
- 对应任务: [tasks/067-popup-bubble-whitespace-pre-wrap.md](../tasks/067-popup-bubble-whitespace-pre-wrap.md)
- 来源讨论: [discussions/067-popup-bubble-whitespace-pre-wrap.md](../discussions/067-popup-bubble-whitespace-pre-wrap.md)
- 执行日期: 2026-03-14

## 结果概览

本轮按 discussion 收窄后的 CSS-only 边界完成了 `A + B + C`：

- `A` [popup.css](/Users/xa/Desktop/projiect/zhiyi/popup/popup.css) 的 `.result-content` 现在补了 `white-space: pre-wrap`，popup 结果区和错误区都会保留多行文本换行。
- `B` [content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 的 `.st-bubble-result` 现在补了 `white-space: pre-wrap`，划词气泡中的多段落结果会按原始换行展示。
- `C` 新增了 [067-popup-bubble-whitespace.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/067-popup-bubble-whitespace.test.mjs) 回归测试，并把断言收紧到“只匹配本规则块”，避免假阳性。

## 已完成改动

### 67.1 Popup 结果区保留换行

[popup.css](/Users/xa/Desktop/projiect/zhiyi/popup/popup.css) 的 `.result-content` 原先只有：

```css
.result-content {
    padding: 16px;
    max-height: 200px;
    overflow-y: auto;
    font-size: 15px;
    color: var(--text-primary);
    line-height: 1.7;
}
```

现在补成：

```css
.result-content {
    padding: 16px;
    max-height: 200px;
    overflow-y: auto;
    font-size: 15px;
    color: var(--text-primary);
    line-height: 1.7;
    white-space: pre-wrap;
}
```

这意味着：

- `showResult()` 里 `escapeHtml(text)` 保留下来的 `\n` 现在会被渲染成真实换行
- `showError()` 复用同一结果容器，因此多行错误信息也会正确换行
- 不需要改 [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 的渲染 API，更不用把 `innerHTML` 改成 `innerText`

### 67.2 Bubble 结果区保留换行

[content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 的 `.st-bubble-result` 原先缺少 `white-space`：

```css
.st-bubble-result {
    max-height: 280px;
    overflow-y: auto;
    word-wrap: break-word;
    color: var(--text-primary);
    font-size: 15px;
}
```

现在补成：

```css
.st-bubble-result {
    max-height: 280px;
    overflow-y: auto;
    word-wrap: break-word;
    color: var(--text-primary);
    font-size: 15px;
    white-space: pre-wrap;
}
```

这样 [selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) 里 bubble 结果使用的 `textContent` 就能直接展示多行文本，不需要继续扩大到 JS 结构改造。

## TDD 记录

本轮先新增了 [067-popup-bubble-whitespace.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/067-popup-bubble-whitespace.test.mjs)。

初次运行时：

- popup `.result-content` 的断言正确失败，暴露出 `white-space: pre-wrap` 缺失
- bubble 断言一开始因为正则过宽出现了假阳性，后续已收紧为只匹配 `.st-bubble-result` 自身规则块

在确认测试真正对准缺口后，再补上两处最小 CSS 变更，定向测试转绿。

## 验证

本轮实际 fresh 跑过：

```bash
node --test tests/067-popup-bubble-whitespace.test.mjs
node --test tests/*.test.mjs
git diff --check
```

验证结果：

- [067-popup-bubble-whitespace.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/067-popup-bubble-whitespace.test.mjs)：2/2 通过
- `node --test tests/*.test.mjs`：221/221 通过
- `git diff --check`：无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- popup 多段落翻译结果和多行错误文案在真实 UI 中按换行显示
- 划词气泡中的多段落翻译结果在真实页面中按换行显示
