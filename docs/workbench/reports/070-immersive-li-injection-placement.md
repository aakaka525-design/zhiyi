# 070 — 沉浸式翻译 `li` 改为元素内部注入报告

- 状态: done
- 对应任务: [tasks/070-immersive-li-injection-placement.md](../tasks/070-immersive-li-injection-placement.md)
- 来源讨论: [discussions/070-immersive-li-injection-placement.md](../discussions/070-immersive-li-injection-placement.md)
- 执行日期: 2026-03-14

## 结果概览

本轮按 discussion 收窄后的边界完成了 `A1 + A2`：

- `A1` [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的内部注入分支现在从 `td/th` 扩展到了 `li`，列表项翻译会直接 append 到对应 `<li>` 内部。
- `A2` 新增了 [070-immersive-li-injection.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/070-immersive-li-injection.test.mjs)，锁住 `li` 内部注入、`td/th` 兼容保持、以及普通 block 元素继续走 wrapper sibling 这三条行为。

## 已完成改动

### 70.1 `li` 与 `td/th` 统一走元素内部注入

[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 原先只对 `td/th` 走内部注入：

```javascript
} else if (container.matches('td, th')) {
```

现在改成：

```javascript
} else if (container.matches('td, th, li')) {
```

这意味着：

- `li` 的翻译块会附着在对应列表项内部
- bullet/编号和译文保持同一语义范围
- 不再在两个列表项之间插入独立 wrapper 块
- `td/th` 原有的 cell 内注入行为保持不变
- `p/blockquote/h1-h6` 等普通 block 元素仍然保留原有 wrapper sibling 路径

### 70.2 不扩大到 observer 或其它结构整理

这轮没有改 observer，也没有扩大到 `li` 选取粒度修复。

原因是 070 的目标只是修正“列表项注入位置”，不是重做沉浸式翻译的元素筛选模型。`li` 已经在现有 observer 选择器里，068 也已经补齐了 `querySelector('.st-immersive-translation')` 去重，所以本轮保持最小改动。

## TDD 记录

本轮先新增了 [070-immersive-li-injection.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/070-immersive-li-injection.test.mjs)。

第一次运行时：

- `li` 走元素内部注入 失败
- `td/th` 仍走内部注入 通过
- 普通 block 元素仍走 wrapper sibling 通过

失败点准确暴露出：`li` 还在落入最后的 wrapper sibling 分支。

补上最小实现后，定向测试转绿；随后全量测试再次通过，说明没有把 068 的 `td/th` 修复和普通 block 路径一起打坏。

## Residual Risk

这轮**没有**解决 nested list 的选取粒度问题。

已知残留是：

- 父 `li` 包含子 `ul`/`ol` 时，父 `li` 的翻译仍会 append 在子列表之后
- 当前初选去重会保留父 `li`、过滤子 `li`
- 父 `li` 的翻译可能覆盖“父项文本 + 子列表文本”的组合内容

这属于 `li` 的选取粒度问题，不是 070 这次“注入位置从 wrapper sibling 改成元素内部 append”能解决的范围。因此 070 不能被描述成“列表场景全部解决”。

## 验证

本轮实际 fresh 跑过：

```bash
node --test tests/070-immersive-li-injection.test.mjs
node --test tests/*.test.mjs
git diff --check
```

验证结果：

- [070-immersive-li-injection.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/070-immersive-li-injection.test.mjs)：3/3 通过
- `node --test tests/*.test.mjs`：232/232 通过
- `git diff --check`：无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- 普通列表项的沉浸式译文显示在对应 bullet/编号范围内
- 表格单元格的 `td/th` 注入行为没有回归
- 普通 block 元素依旧走 wrapper sibling 路径
