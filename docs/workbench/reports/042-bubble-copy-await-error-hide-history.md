# 042 — Selection bubble 复制 await + 错误态隐藏 + 历史保存报告

- 状态: done
- 对应任务: [tasks/042-bubble-copy-await-error-hide-history.md](../tasks/042-bubble-copy-await-error-hide-history.md)
- 来源讨论: [discussions/042-bubble-copy-await-error-hide-history.md](../discussions/042-bubble-copy-await-error-hide-history.md)
- 执行日期: 2026-03-13

## 结果概览

本轮完成了 `A/B/C`：

- `A` selection bubble 的复制按钮现在会 `await navigator.clipboard.writeText(...)`，不再提前给假成功反馈
- `B` bubble 在翻译失败和请求异常时会隐藏 `.st-bubble-actions`，成功时会恢复可见
- `C` bubble 翻译成功后现在会 fire-and-forget 写入历史记录，与 float-window 的历史保存模式对齐

## 已完成改动

### 42.1 前置重构：sourceLang / targetLang 变量抽出

[selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) 的 `showBubble()` 现在会在发起翻译请求前先提取：

- `const sourceLang = ST.detectLanguage(text);`
- `const targetLang = ST.state.settings?.targetLang || 'zh';`

随后：

- translate 请求复用 `from: sourceLang` 和 `to: targetLang`
- 历史写入也复用同一组 `sourceLang/targetLang`

这避免了同一条翻译链路里出现“请求一套语言值、落历史另一套语言值”的分裂。

### 42.2 A Bubble 复制按钮改为 await

[selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) 的 copy handler 现在改成了：

- `copyBtn.onclick = async () => { ... }`
- `await navigator.clipboard.writeText(response.text)`

只有在剪贴板写入成功后，才会：

- `copyBtn.style.color = 'var(--accent)'`
- `setTimeout(() => copyBtn.style.color = '', 1000)`

失败路径只保留：

- `console.error('复制失败:', err)`

没有加 toast，也没有把 SVG 图标反馈模型改成 `innerHTML` 替换，保持 bubble 当前的轻量交互。

### 42.3 B Bubble 错误态隐藏复制按钮

本轮没有给 bubble 加 `error-state` class，也没有改 [content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css)。  
因为 bubble 是瞬态 DOM，每次 `showBubble()` 都会重建，所以这里直接在 JS 控制 `.st-bubble-actions` 的显隐更便宜。

具体行为现在是：

- 成功路径：
  - `renderBubbleMessage(resultDiv, response.text)`
  - `actionsEl.style.display = ''`
- 翻译失败路径：
  - `renderBubbleMessage(..., true)`
  - `actionsEl.style.display = 'none'`
- `catch` 路径：
  - `renderBubbleMessage(..., true)`
  - `actionsEl.style.display = 'none'`

这样错误态下不再留下一个没有 handler 的死 copy 按钮。

### 42.4 C Bubble 翻译结果保存历史

成功路径现在新增了 fire-and-forget 的历史保存：

```javascript
ST.sendMessage({
    action: 'addHistory',
    item: {
        source: text,
        target: response.text,
        sourceLang,
        targetLang,
        provider: response.provider || '',
    }
});
```

这里刻意没有 `await`，保持与 float-window 一致：

- bubble 是瞬态 UI，不需要等待历史写入完成
- 也不会在 bubble 中尝试刷新 sidebar 历史

同时，028 已经把历史去重键改成了 `source + targetLang`，所以 bubble 高频重复翻同一段文本时也不会无限堆积重复记录。

## TDD 记录

本轮按 test-first 执行，新增了 [bubble-copy-error-history.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/bubble-copy-error-history.test.mjs)。

首次运行：

```bash
node --test tests/bubble-copy-error-history.test.mjs
```

时 3 个子测试全部失败，分别覆盖了：

- `sourceLang/targetLang` 还没有提取并复用
- bubble copy handler 还没有 `await navigator.clipboard.writeText(...)`
- 错误态按钮隐藏和成功写历史都还不存在

补丁完成后目标测试转绿。

## 验证

本轮实际跑过：

```bash
node --test tests/bubble-copy-error-history.test.mjs
node --test tests/*.test.mjs
node --check content/modules/selection.js
git diff --check
```

验证结果：

- [bubble-copy-error-history.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/bubble-copy-error-history.test.mjs)：3/3 通过
- `node --test tests/*.test.mjs`：153/153 通过
- [selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- selection bubble 在剪贴板权限失败时，不再先把 copy 图标染成成功色
- selection bubble 在翻译失败或请求异常时，复制按钮会隐藏
- selection bubble 成功翻译后的记录能出现在 sidebar / options 历史中
