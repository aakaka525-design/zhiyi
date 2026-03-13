# 022 — Observer pendingTranslations 泄漏修复 & Toast 样式入 CSS & Observer 阈值对齐报告

- 状态: done
- 对应任务: [tasks/022-observer-leak-and-toast.md](../tasks/022-observer-leak-and-toast.md)
- 来源讨论: [discussions/022-observer-leak-and-toast.md](../discussions/022-observer-leak-and-toast.md)
- 执行日期: 2026-03-13

## 结果概览

本轮一次性完成了 `A/B/C`：

- `A` observer 动态翻译分支改成 `finally` 统一释放 `pendingTranslations`
- `B` content toast 样式从 JS 内联移入 `content.css`
- `C` observer 最小文本长度阈值与初始扫描对齐

## 已完成改动

### 22.1 A `pendingTranslations` 统一在 finally 清理

[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的 observer 动态翻译链路现在把：

- success 分支里的 `ST.pendingTranslations.delete(el)`
- catch 分支里的 `newElements.forEach(el => ST.pendingTranslations.delete(el))`

都删掉了，统一收进：

- `finally { newElements.forEach(el => ST.pendingTranslations.delete(el)); }`

这样不管后台返回：

- `response.results`
- `{ error }`
- 或 `ST.sendMessage()` 直接 reject

这些进入 `pendingTranslations` 的元素都会被释放，不会再因为一次暂时性的 API 错误而永久卡在 observer 的跳过集合里。

这轮没有改初始扫描那条 `translateBatch` 路径，因为它本来就不依赖 `pendingTranslations`。

### 22.2 B content toast 样式收回 CSS token 体系

[utils.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/utils.js) 的 `ST.showToast()` 现在不再写整段 `style.cssText`。JS 只保留：

- 创建 `#st-toast`
- 插入 DOM
- 3 秒后用最小内联 `opacity` / `transition` 做 fade-out

对应的静态视觉样式已经移到 [content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 的新 `#st-toast` 规则里，背景也从原来的：

- `rgba(141, 163, 153, 0.95)`

统一成了：

- `background: var(--accent)`

这样 content-side toast 终于真正接入了现有 token 体系，而不是只挂着 `#st-toast` 的 token scope 却完全被内联样式覆盖。

### 22.3 C observer 阈值与初始扫描对齐

[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的 observer 过滤现在改成：

- `const minLength = isTwitter ? 5 : 20;`
- `if (text.length < minLength) return false;`

这样：

- Twitter 仍保留 5 字符阈值
- 通用网站回到和初始扫描一致的 20 字符阈值

修掉了“同一页面初始内容不翻、动态插入内容却会翻”的覆盖不一致。

## TDD 记录

本批按 test-first 执行，新增了 [observer-toast.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/observer-toast.test.mjs)。

首次运行 `node --test tests/observer-toast.test.mjs` 时，2 个断言都失败，分别覆盖：

- observer 还没有 `finally` 清理，也仍然使用统一的 `< 5` 阈值
- content toast 仍然依赖 `utils.js` 里的 `style.cssText`，且 `content.css` 还没有 `#st-toast` 实体样式

补丁完成后，目标测试转绿。

## 验证

本批实际跑过：

```bash
node --test tests/observer-toast.test.mjs
node --test tests/*.test.mjs
node --check content/modules/immersive.js
node --check content/modules/utils.js
git diff --check
```

验证结果：

- `tests/observer-toast.test.mjs`：2/2 通过
- `node --test tests/*.test.mjs`：95/95 通过
- [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) `node --check` 通过
- [utils.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/utils.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- 沉浸式翻译在 API 暂时失败后，后续动态加载内容仍能在服务恢复后重新参与翻译，不会永久失活
- content 页面 toast 的实际视觉现在与 `var(--accent)` 保持一致
- 通用网站上 5 到 19 字符的动态段落不再被 observer 单独翻译
