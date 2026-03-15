---
status: done
task: 084-immersive-ux-layout-loading-replace
date: 2026-03-15
---

# 084 — 沉浸式翻译 UX：inline 路径排版修复 + 翻译加载动画

## 完成结果

本轮按收窄后的边界完成了 `A + B`：

- [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的 inline/flex/grid 路径现在直接 `appendChild(transEl)`，不再创建 `st-translation-separator`，也不再对 `transEl` 写 inline `style.cssText`。
- 同文件新增了 `injectLoadingPlaceholder(...)` / `removeLoadingPlaceholder(...)`，并把它们接到初始扫描、observer、`083` 的 scroll rescan 三条批量翻译路径。
- [content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 新增了 `.st-immersive-loading` 的三点弹跳样式，复用现有 `st-bounce` 动画。
- 关闭沉浸式翻译时，cleanup 现在会同时移除 `.st-immersive-loading`。
- 新增了 [084-immersive-ux.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/084-immersive-ux.test.mjs)。

## 实际修改文件

- [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js)
- [content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css)
- [084-immersive-ux.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/084-immersive-ux.test.mjs)

## 测试基线同步

`084` 改的是合法结构，不是回归。为让全量回归重新反映当前真实行为，本轮同步更新了受影响的旧沉浸式测试：

- [066-immersive-inline-style-heading-fontsize.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/066-immersive-inline-style-heading-fontsize.test.mjs)
- [074-observer-containment-dedup.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/074-observer-containment-dedup.test.mjs)
- [075-cell-css-selector-coverage.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/075-cell-css-selector-coverage.test.mjs)
- [076-observer-node-self-match.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/076-observer-node-self-match.test.mjs)
- [079-observer-batch.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/079-observer-batch.test.mjs)
- [immersive-batch-error-count.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/immersive-batch-error-count.test.mjs)
- [immersive-color-misc.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/immersive-color-misc.test.mjs)
- [immersive-menu-drag.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/immersive-menu-drag.test.mjs)
- [immersive-observer-test-timeout.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/immersive-observer-test-timeout.test.mjs)
- [observer-toast.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/observer-toast.test.mjs)

这些修改都只是在测试层接受 `084` 的合法新结构，没有扩大生产范围。

## 验证

本轮实际 fresh 跑过：

```bash
node --test tests/084-immersive-ux.test.mjs
node --test tests/*.test.mjs
node --check content/modules/immersive.js
git diff --check
```

结果：

- `084` 专项测试：`5/5`
- 全量测试：`293/293`
- 语法检查通过
- `git diff --check` 无输出

## 残留风险

- `C`（替换/对照模式）仍然拆在后续任务，没有并进本轮。
- `h1-h6` 在 inline/flex/grid 路径下仍不会像 block wrapper 路径那样同步 `fontSize/fontWeight`；这是 task 明确接受的 residual risk，不是 084 新引入的问题。
- 还没做真实 Chrome 页面手测。
