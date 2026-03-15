# 069 — 翻译结果容器补 `word-wrap: break-word` 防长文本溢出报告

- 状态: done
- 对应任务: [tasks/069-result-text-overflow-wrap-inconsistency.md](../tasks/069-result-text-overflow-wrap-inconsistency.md)
- 来源讨论: [discussions/069-result-text-overflow-wrap-inconsistency.md](../discussions/069-result-text-overflow-wrap-inconsistency.md)
- 执行日期: 2026-03-14

## 结果概览

本轮按 discussion 收窄后的纯 CSS 边界完成了 `A + B + C + D + E`：

- `A` [content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 的 `.st-result-text` 现在补了 `word-wrap: break-word`，sidebar 结果区能对长 URL 和连续长串断行。
- `B` 同一文件的 `.st-float-result-text` 也补了 `word-wrap: break-word`，翻译小窗不会再因为长无空格文本横向溢出。
- `C` `.st-immersive-translation` 补了 `word-wrap: break-word`，沉浸式翻译块在窄列宿主页面中也具备断词能力。
- `D` [popup.css](/Users/xa/Desktop/projiect/zhiyi/popup/popup.css) 的 `.result-content` 补了 `word-wrap: break-word`，popup 中的长结果文本不再被父容器裁切。
- `E` 新增了 [069-result-text-overflow-wrap.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/069-result-text-overflow-wrap.test.mjs) 静态回归测试，锁住这 4 个容器的断词规则。

## 已完成改动

### 69.1 四个结果容器统一补齐长词断行

本轮只改了 2 个 CSS 文件，没有碰任何 JS。

[content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 里补了 3 处：

```css
.st-immersive-translation {
    /* ... */
    word-wrap: break-word;
}

.st-result-text {
    /* ... */
    white-space: pre-wrap;
    word-wrap: break-word;
}

.st-float-result-text {
    /* ... */
    white-space: pre-wrap;
    word-wrap: break-word;
}
```

[popup.css](/Users/xa/Desktop/projiect/zhiyi/popup/popup.css) 里补了 1 处：

```css
.result-content {
    /* ... */
    white-space: pre-wrap;
    word-wrap: break-word;
}
```

这样四个结果容器在遇到：

- 长 URL
- 连续无空格字符串
- 超长技术术语

时都会在容器边界处断行，而不是横向溢出或被裁切。

### 69.2 保持 `word-wrap` 而不扩大到属性名重构

这轮沿用了项目现有基线 `.st-bubble-result { word-wrap: break-word; }`，没有把属性名统一改成 `overflow-wrap`。

原因是：

- 这只是属性名差异，没有行为收益
- 会扩大 diff
- 会把本轮从“补缺口”变成“顺手统一风格”

所以这次只补齐缺失容器，不动已经正确的 bubble。

### 69.3 不把 `white-space: pre-wrap` 扩大到沉浸式块

discussion 里已经收敛过，这轮没有给 `.st-immersive-translation` 补 `white-space: pre-wrap`，只补长词断行。

原因是本轮目标单一：

- 解决长无空格文本溢出
- 不扩大到换行语义调整

## TDD 记录

本轮先新增了 [069-result-text-overflow-wrap.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/069-result-text-overflow-wrap.test.mjs)。

第一次运行时 4 条子测试全部失败，准确暴露出：

- `.st-result-text` 缺 `word-wrap: break-word`
- `.st-float-result-text` 缺 `word-wrap: break-word`
- `.st-immersive-translation` 缺 `word-wrap: break-word`
- `.result-content` 缺 `word-wrap: break-word`

补上最小 CSS 变更后，定向测试转绿，再跑全量测试确认没有引入其他回归。

## 验证

本轮实际 fresh 跑过：

```bash
node --test tests/069-result-text-overflow-wrap.test.mjs
node --test tests/*.test.mjs
git diff --check
```

验证结果：

- [069-result-text-overflow-wrap.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/069-result-text-overflow-wrap.test.mjs)：4/4 通过
- `node --test tests/*.test.mjs`：229/229 通过
- `git diff --check`：无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- sidebar 中的长 URL 和连续长串能在结果卡片内断行
- float-window 中的长无空格文本不会再横向溢出
- popup 里的长结果文本不会再被裁切
- 沉浸式翻译块在窄列宿主页面中不会把长词顶出容器
