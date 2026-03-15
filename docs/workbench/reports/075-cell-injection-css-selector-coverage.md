# 075 — Cell-内注入样式适配与语义元素覆盖报告

- 状态: done
- 对应任务: [tasks/075-cell-injection-css-selector-coverage.md](../tasks/075-cell-injection-css-selector-coverage.md)
- 来源讨论: [discussions/075-cell-injection-css-selector-coverage.md](../discussions/075-cell-injection-css-selector-coverage.md)
- 执行日期: 2026-03-14

## 结果概览

本轮按收窄后的边界完成了 `A1 + B1 + B2 + B3 + B4 + C`：

- [content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 现在为 cell-内注入路径补了轻量样式覆盖，不再让 `td/th/li/figcaption/dt/dd/caption` 使用重卡片样式。
- [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的 cell-内注入分支已扩展到 `figcaption/dt/dd/caption`。
- 初始扫描、observer 选择器和 `getImmersiveMinLength(...)` 也同步扩展到了这 4 个语义元素。
- `summary` 没有被并进本轮。
- 新增了 [075-cell-css-selector-coverage.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/075-cell-css-selector-coverage.test.mjs)，并同步更新了 3 条旧静态断言到 `075` 的合法 selector 结构。

## 已完成改动

### 75.1 cell-内注入现在使用轻量覆盖样式

[content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 在 `.st-immersive-translation` 基础样式后新增了 direct-child override：

```css
td > .st-immersive-translation,
th > .st-immersive-translation,
li > .st-immersive-translation,
figcaption > .st-immersive-translation,
dt > .st-immersive-translation,
dd > .st-immersive-translation,
caption > .st-immersive-translation {
    background: transparent;
    border-left: 2px solid var(--accent);
    padding: 0 0 0 8px;
    margin: 4px 0 0 0;
    border-radius: 0;
    box-shadow: none;
    font-size: 0.9em;
}
```

这让 cell-内上下文不再出现：

- 背景卡片
- 大 padding
- 圆角
- 阴影

仍保留的只有最小视觉区分：

- `var(--accent)` 颜色
- 细 `border-left`
- 小左内边距和小上边距

### 75.2 `figcaption/dt/dd/caption` 走 cell-内注入，不再走 wrapper

[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 里原来的 cell-内注入判断：

```javascript
container.matches('td, th, li')
```

现在扩成：

```javascript
container.matches('td, th, li, figcaption, dt, dd, caption')
```

这样避免了几类结构问题：

- `figcaption`：不再在 figure 附近插 wrapper sibling
- `dt/dd`：不再把 wrapper 插在 term / description 配对之间
- `caption`：不再在 table 内走 wrapper sibling 路径

### 75.3 初始扫描和 observer 选择器已同步扩展

这轮没有只改初始扫描。两条路径都已加入：

- `figcaption`
- `dt`
- `dd`
- `caption`

包括：

- 初始扫描通用 selector 数组
- observer 通用路径 selector
- observer Discord fallback 路径 selector

因此新元素不会只在首屏或只在动态内容里半生效。

### 75.4 新语义元素使用低门槛，`summary` 明确排除

`getImmersiveMinLength(el, isTwitter)` 已同步扩展到：

- `figcaption`
- `dt`
- `dd`
- `caption`

它们现在和 `li/td/th/h1-h6` 一样走 `2` 字门槛。

本轮刻意没有加入 `summary`：

- 没有加入 selector
- 没有加入 cell-内注入分支
- 没有加入 `getImmersiveMinLength`

原因和 discussion 一致：`summary` 的翻译可见性和 `<details>` 交互语义需要单独处理，不适合跟本轮的结构/样式修复混做。

## TDD 记录

本轮先新增了 [075-cell-css-selector-coverage.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/075-cell-css-selector-coverage.test.mjs)。

第一次运行时 6 条子测试全部失败，准确暴露出：

- 缺少 cell-内轻量 CSS override
- `figcaption/dt/dd/caption` 仍走 block wrapper 路径
- 初始扫描和 observer 还没覆盖这些语义元素
- `getImmersiveMinLength(...)` 也还没把它们纳入低门槛

补上最小实现后，专项测试转绿。

随后全量回归打出 4 条旧静态断言失败，但都不是生产回归，而是旧测试还锁着 `075` 前的 selector 结构：

- [068-immersive-td-th-injection.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/068-immersive-td-th-injection.test.mjs)
- [073-immersive-discord.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/073-immersive-discord.test.mjs)
- [observer-toast.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/observer-toast.test.mjs)

这些测试已同步到 `075` 的合法新结构，没有改动 `075` 范围外的生产行为。

## 验证

本轮实际 fresh 跑过：

```bash
node --test tests/075-cell-css-selector-coverage.test.mjs
node --test tests/*.test.mjs
node --check content/modules/immersive.js
git diff --check
```

验证结果：

- [075-cell-css-selector-coverage.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/075-cell-css-selector-coverage.test.mjs)：6/6 通过
- `node --test tests/*.test.mjs`：256/256 通过
- `node --check content/modules/immersive.js`：通过
- `git diff --check`：无输出

## Residual Risk

这轮刻意没有处理：

- `summary`
- 其他更多 HTML5 语义元素
- block wrapper 路径样式
- inline 路径样式

因此当前 residual risk 是：

- `<summary>` 仍不会被沉浸式翻译覆盖
- `figcaption/dt/dd/caption` 虽然已接入，但视觉是否在真实页面中最合适，还需要浏览器级确认

## 手动验证

这轮仍未做真实 Chrome 手测。待人工确认的页面级行为包括：

- 表格单元格中的译文不再显示成重卡片
- 列表项中的译文视觉更轻，不再明显撑高布局
- 图片说明、定义列表、表格标题会进入沉浸式翻译
- `summary` 仍保持不翻译，不应出现半可见或位置错误的译文
