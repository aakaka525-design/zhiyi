# 072 — 沉浸式翻译 EXCLUDE_SELECTORS 上下文感知 + contenteditable 排除报告

- 状态: done
- 对应任务: [tasks/072-immersive-exclude-selectors-overreach-contenteditable.md](../tasks/072-immersive-exclude-selectors-overreach-contenteditable.md)
- 来源讨论: [discussions/072-immersive-exclude-selectors-overreach-contenteditable.md](../discussions/072-immersive-exclude-selectors-overreach-contenteditable.md)
- 执行日期: 2026-03-14

## 结果概览

本轮按收窄后的边界完成了 `A1 + A2 + B1 + B2 + C`：

- `B1/B2` [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 现在会在初始扫描和 observer 两条路径里优先排除 `isContentEditable` 内容，沉浸式翻译不再注入可编辑区域。
- `A1/A2` 同一文件新增了共享的 `isExcludedByImmersiveContext(el)`，只对 `header/footer` 做 `article/section` 上下文放行；`aside` 继续保持排除。
- `C` 新增了 [072-immersive-exclude-selectors.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/072-immersive-exclude-selectors.test.mjs)，并同步更新了 [addhistory-error-observer-exclude.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/addhistory-error-observer-exclude.test.mjs) 的旧静态断言以接受共享 helper 结构。

## 已完成改动

### 72.1 contenteditable 现在会在两条路径中被优先排除

[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 之前没有任何 `contenteditable` 守卫，因此可编辑区域内的 `<p>` 也会进入沉浸式翻译流程。

现在两条路径都补上了早返回：

- 初始扫描：`if (p.isContentEditable) return false;`
- observer：`if (el.isContentEditable) return false;`

而且这条检查都放在 EXCLUDE 循环之前，避免无意义的 `closest(...)` 遍历。

### 72.2 只放宽 `header/footer`，不放宽 `aside`

这轮没有直接修改 `EXCLUDE_SELECTORS` 数组，而是新增了共享 helper：

```javascript
function isExcludedByImmersiveContext(el) {
    for (const selector of EXCLUDE_SELECTORS) {
        if (el.matches(selector)) return true;

        const ancestor = el.closest(selector);
        if (!ancestor) continue;

        if ((ancestor.tagName === 'HEADER' || ancestor.tagName === 'FOOTER') &&
            ancestor.closest('article, section')) {
            continue;
        }

        return true;
    }

    return false;
}
```

这样行为变成：

- 站点级 `<header>` / `<footer>`：仍排除
- `article/section` 内的 `<header>` / `<footer>`：放行
- `<aside>`：继续无条件排除
- `nav/button/a/...`：继续按原逻辑排除

这满足了 discussion 的收口要求：不把 `main` 当作放行条件，也不在这一轮顺手放开 `aside`。

### 72.3 初始扫描和 observer 保持同一套排除语义

`072` 没有像之前某些问题那样只修初始路径。初始扫描和 observer 现在都共享：

- `isContentEditable` 早返回
- `isExcludedByImmersiveContext(el)`

因此：

- 页面初次开启沉浸式翻译
- 动态新增内容进入 observer

这两条路径对 `header/footer/contenteditable` 的处理保持一致。

## TDD 记录

本轮先新增了 [072-immersive-exclude-selectors.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/072-immersive-exclude-selectors.test.mjs)。

第一次运行时 3 条子测试全部失败，准确暴露出：

- `contenteditable` 内容没有被排除
- 文章级 `header/footer` 仍然和站点级一起被粗暴排除
- observer 路径也没有同步这两条修复

补上最小实现后，定向测试转绿。随后全量回归里又打出 1 条旧静态断言回归：

- [addhistory-error-observer-exclude.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/addhistory-error-observer-exclude.test.mjs)

这条原本锁定的是旧的内联 `EXCLUDE_SELECTORS` 循环。本轮已将它收口为检查共享 `isExcludedByImmersiveContext(el)` helper 和两条调用点。

## 验证

本轮实际 fresh 跑过：

```bash
node --test tests/072-immersive-exclude-selectors.test.mjs
node --test tests/*.test.mjs
node --check content/modules/immersive.js
git diff --check
```

验证结果：

- [072-immersive-exclude-selectors.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/072-immersive-exclude-selectors.test.mjs)：3/3 通过
- `node --test tests/*.test.mjs`：238/238 通过
- `node --check content/modules/immersive.js`：通过
- `git diff --check`：无输出

## Residual Risk

这轮刻意**没有**放开 `<aside>`。

原因是很多站点会用：

```html
<main>
  <aside>目录 / TOC / 侧栏导航</aside>
  <article>正文</article>
</main>
```

如果把 `main` 当作 `aside` 的放行条件，会把站点级 TOC/侧栏重新带入翻译面。`aside` 需要更窄的语义信号，后续应单独讨论，而不是在本轮和 `header/footer` 一起放宽。

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- CMS / 编辑器页面中的 `contenteditable` 区域不会再被注入沉浸式翻译
- 文章级 `<header>` 标题和 `<footer>` 来源在真实页面中能正常翻译
- 站点级 `<header>` / `<footer>` 仍不会被带进沉浸式翻译
- 文档站和博客中的 `<aside>` 注释/侧栏当前仍保持排除
