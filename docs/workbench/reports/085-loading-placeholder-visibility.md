---
status: done
task: 085-loading-placeholder-visibility
date: 2026-03-15
---

# 085 — 沉浸式翻译加载动画不可见

## 完成结果

本轮按收窄后的边界完成了 `085`：

- [content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 的 `.st-immersive-loading` 从 `inline-flex` 改成了 block 级 `flex`，并同步增大 gap、dot 尺寸和 opacity。
- [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的初始扫描在 batch 循环前新增了 `paragraphs.forEach(p => injectLoadingPlaceholder(p))`，用户现在会先看到所有候选段落出现 loading，再按批消失。
- batch 内原有的 `injectLoadingPlaceholder(...)` 保留不删，依赖既有去重检查变成 no-op；Observer / rescan 路径保持不变。
- 新增了 [085-loading-visibility.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/085-loading-visibility.test.mjs)。

## 改动文件

| 文件 | 改动 |
|------|------|
| `content/content.css` | `.st-immersive-loading` 样式调整 |
| `content/modules/immersive.js` | `toggleImmersive` batch 循环前全量预注入 |
| `tests/085-loading-visibility.test.mjs` | 静态 + runtime harness 两层测试 |

## 测试

本轮实际 fresh 跑过：

```bash
node --test tests/085-loading-visibility.test.mjs
node --test tests/*.test.mjs
node --check content/modules/immersive.js
git diff --check
```

结果：

- `085` 专项测试：`4/4`
- 全量测试：`297/297`
- 语法检查通过
- `git diff --check` 无输出

## 未做 / 保持不动

- 不改 loading helper 函数逻辑
- 不改 Observer / rescan 的 loading 注入方式
- 不改 084-A inline path 修复

## 残留风险

- 还没做真实 Chrome 手测，所以“视觉可见性”仍缺浏览器内人工确认。
- 当前只提升了初始扫描场景的 loading 可见性；Observer / rescan 仍保持 per-batch 语义，这是 task 明确接受的边界。
