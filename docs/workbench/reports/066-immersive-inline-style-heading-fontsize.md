# 066 — 沉浸式翻译 inline 路径样式冲突 & 标题翻译字号不匹配报告

- 状态: done
- 对应任务: [tasks/066-immersive-inline-style-heading-fontsize.md](../tasks/066-immersive-inline-style-heading-fontsize.md)
- 来源讨论: [discussions/066-immersive-inline-style-conflict-heading-fontsize.md](../discussions/066-immersive-inline-style-conflict-heading-fontsize.md)
- 执行日期: 2026-03-14

## 结果概览

本轮完成了 `A + B + C`：

- `A` [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的 inline 路径现在彻底退回轻量文本标注样式，不再让 block 卡片装饰落到 inline 翻译节点上。
- `B` 同一个文件的 block 路径现在会对 `h1-h6` 标题翻译同步 `fontSize` 和 `fontWeight`，保持标题层级。
- `C` 新增了 [066-immersive-inline-style-heading-fontsize.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/066-immersive-inline-style-heading-fontsize.test.mjs)，并同步更新了 1 条旧静态断言，让它接受 `066` 的合法结构变化。

## 已完成改动

### 66.1 inline 路径退回轻量文本标注

[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的 inline 路径原先只覆盖了：

```javascript
transEl.style.cssText = 'display: inline; font-style: normal; color: var(--accent); margin-left: 4px;';
```

这意味着 [content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 里 `.st-immersive-translation` 的 block-oriented 属性仍然会落到 inline 元素上，包括：

- `background`
- `border-left`
- `padding`
- `border-radius`
- `box-shadow`
- `font-size: 0.95em`
- `line-height: 1.7`

现在已经改成：

```javascript
transEl.style.cssText = 'display: inline; font-style: normal; color: var(--accent); margin-left: 4px; background: transparent; border-left: none; padding: 0; border-radius: 0; box-shadow: none; margin-top: 0; margin-bottom: 0; font-size: inherit; line-height: inherit;';
```

结果是 inline 路径只保留：

- `color`
- `margin-left`
- 基本的 inline 文本形态

而不会再出现：

- 多行背景碎片
- 每行单独左边框
- 碎片化圆角/阴影
- 被 paragraph CSS 强制压成 `0.95em`

这轮按 discussion 收窄后的结论，没有新增专门 CSS class，也没有去改 separator 样式。

### 66.2 标题翻译同步字号和字重

[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的 block 路径原先无论什么元素都只创建：

```javascript
const blockTransEl = document.createElement('div');
blockTransEl.className = 'st-immersive-translation';
blockTransEl.innerText = translation;
```

所以 `h1-h6` 的翻译块会退回 parent 的正文字号，而不是跟随标题层级。

现在补上了标题分支：

```javascript
if (container.matches('h1, h2, h3, h4, h5, h6')) {
    const headingStyle = window.getComputedStyle(container);
    blockTransEl.style.fontSize = `calc(${headingStyle.fontSize} * 0.85)`;
    blockTransEl.style.fontWeight = headingStyle.fontWeight;
}
```

这样：

- `p/li/blockquote` 等普通 block 元素完全不受影响
- `h1-h6` 翻译会按原始标题字号的 `0.85` 缩放，并保留同样的字重

这轮刻意没有继续扩大到：

- `lineHeight`
- `letterSpacing`
- `fontFamily`

保持在 task 限定的“字号 + 字重”边界内。

## TDD 记录

本轮先新增了 [066-immersive-inline-style-heading-fontsize.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/066-immersive-inline-style-heading-fontsize.test.mjs)。

初次运行时，2 条子测试都失败，准确暴露出：

- inline 路径仍然只写了旧的最小 `style.cssText`
- 标题翻译还没有 `fontSize + fontWeight` 同步逻辑

补上最小实现后，新测试转绿。

全量验证阶段还同步更新了 1 条旧静态断言：

- [immersive-color-misc.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/immersive-color-misc.test.mjs)

它原本锁定的是 pre-066 的 inline 路径字符串；这次只是对齐 `066` 的合法结构变化，不是额外扩 scope。

## 验证

本轮实际 fresh 跑过：

```bash
node --test tests/066-immersive-inline-style-heading-fontsize.test.mjs
node --test tests/*.test.mjs
node --check content/modules/immersive.js
git diff --check
```

验证结果：

- [066-immersive-inline-style-heading-fontsize.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/066-immersive-inline-style-heading-fontsize.test.mjs)：2/2 通过
- `node --test tests/*.test.mjs`：219/219 通过
- [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- flex / grid / inline 容器里的沉浸式译文不再出现多行背景碎片、逐行左边框和阴影断裂
- `h1-h6` 标题翻译在真实页面上保持清晰的层级字号与字重，而不是退回正文大小
