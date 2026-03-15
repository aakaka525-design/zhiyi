# 068 — 沉浸式翻译 `td`/`th` cell 内注入 + Observer 选择器/去重补齐报告

- 状态: done
- 对应任务: [tasks/068-immersive-td-li-invalid-html-injection.md](../tasks/068-immersive-td-li-invalid-html-injection.md)
- 来源讨论: [discussions/068-immersive-td-li-invalid-html-injection.md](../discussions/068-immersive-td-li-invalid-html-injection.md)
- 执行日期: 2026-03-14

## 结果概览

本轮按收窄后的 `td/th-only` 边界完成了 `A1 + B1 + B2 + C`：

- `A1` [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的 block 路径现在对 `td/th` 走 cell 内注入，不再把 wrapper 作为 `<tr>` 的非法子元素插进去。
- `B1` 同一个文件里的 MutationObserver 选择器现在补齐了 `td, th`，动态表格内容会进入观察范围。
- `B2` observer 过滤现在同时保留 `nextElementSibling` wrapper 检查和 `el.querySelector('.st-immersive-translation')` 检查，能覆盖 cell 内注入的新结构。
- `C` 新增了 [068-immersive-td-th-injection.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/068-immersive-td-th-injection.test.mjs) 回归测试，锁住 `td/th` 分支、普通 block 分支和 observer 对齐。

## 已完成改动

### 68.1 `td/th` 改为 cell 内注入

[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 之前对所有非 inline/flex/grid 元素统一走 wrapper sibling 路径：

```javascript
} else {
    const wrapper = document.createElement('div');
    wrapper.className = 'st-immersive-wrapper';
    // ...
    if (container.parentNode) {
        container.parentNode.insertBefore(wrapper, container.nextSibling);
    }
}
```

现在补成：

```javascript
} else if (container.matches('td, th')) {
    const blockTransEl = document.createElement('div');
    blockTransEl.className = 'st-immersive-translation';
    blockTransEl.innerText = translation;
    container.appendChild(blockTransEl);
} else {
    const wrapper = document.createElement('div');
    wrapper.className = 'st-immersive-wrapper';
    // ...
    if (container.parentNode) {
        container.parentNode.insertBefore(wrapper, container.nextSibling);
    }
}
```

结果是：

- `td/th` 的翻译明确留在原 cell 内
- `p/blockquote/h1-h6` 仍然保持原有 wrapper sibling 模型
- `li` 没有被顺手改掉，保持在 discussion 收敛后的边界内

### 68.2 Observer 选择器和去重与新结构对齐

[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的 observer 选择器原先缺少 `td, th`：

```javascript
node.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote')
```

现在补成：

```javascript
node.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote')
```

同时，observer 过滤原先只有 wrapper sibling 检查：

```javascript
if (el.nextElementSibling?.classList.contains('st-immersive-wrapper')) return false;
if (ST.pendingTranslations.has(el)) return false;
```

现在改成：

```javascript
if (el.nextElementSibling?.classList.contains('st-immersive-wrapper')) return false;
if (el.querySelector('.st-immersive-translation')) return false;
if (ST.pendingTranslations.has(el)) return false;
```

这样：

- 对 `p/h1-h6/blockquote`，原有 wrapper sibling 去重仍然有效
- 对 `td/th`，新加的 `querySelector` 去重会拦住已经翻译过的 cell

## TDD 记录

本轮先新增了 [068-immersive-td-th-injection.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/068-immersive-td-th-injection.test.mjs)。

初次运行时，4 条子测试里有 3 条失败，准确暴露出：

- `td/th` 仍在走 wrapper sibling 路径
- observer 选择器还没包含 `td, th`
- observer 过滤还没补 `querySelector('.st-immersive-translation')`

只有“普通 block 元素仍走 wrapper sibling”这条一开始就是绿的，说明测试对准了真实缺口而不是把现有正确行为也一起打碎。

补上最小实现后，定向测试转绿，再跑全量回归。

## 验证

本轮实际 fresh 跑过：

```bash
node --test tests/068-immersive-td-th-injection.test.mjs
node --test tests/*.test.mjs
git diff --check
```

验证结果：

- [068-immersive-td-th-injection.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/068-immersive-td-th-injection.test.mjs)：4/4 通过
- `node --test tests/*.test.mjs`：225/225 通过
- `git diff --check`：无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- 表格单元格中的沉浸式翻译在真实页面里稳定显示在原 cell 内
- 动态加载的表格内容也会进入 observer 翻译路径
