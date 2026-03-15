# 071 — 沉浸式翻译短文本过滤：共享门槛 helper + 初始/Observer 同步报告

- 状态: done
- 对应任务: [tasks/071-immersive-coverage-short-text-hidden-elements.md](../tasks/071-immersive-coverage-short-text-hidden-elements.md)
- 来源讨论: [discussions/071-immersive-coverage-short-text-hidden-elements.md](../discussions/071-immersive-coverage-short-text-hidden-elements.md)
- 执行日期: 2026-03-14

## 结果概览

本轮按收窄后的 `A-only` 边界完成了 `A1 + A2 + A3 + A4 + A5`：

- `A1` [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 新增了 `getImmersiveMinLength(el, isTwitter)`，把短文本门槛统一收口到一个 helper。
- `A2` Twitter 初始扫描现在也走 helper，但行为保持不变，仍然是 `5`。
- `A3` 通用初始扫描对 `h1-h6/li/td/th` 降到 `2`，`p/blockquote` 继续保持 `20`，短标题和短列表项不再被静默跳过。
- `A4` observer 路径改成复用同一个 helper，动态内容过滤与初始扫描不再出现两套门槛。
- `A5` 新增了 [071-immersive-coverage.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/071-immersive-coverage.test.mjs)，并同步更新了两条旧静态断言以接受 helper 结构。

## 已完成改动

### 71.1 共享 `getImmersiveMinLength` helper

[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 现在新增了模块级 helper：

```javascript
function getImmersiveMinLength(el, isTwitter) {
    if (isTwitter) return 5;
    if (el.matches('h1, h2, h3, h4, h5, h6, li, td, th')) return 2;
    return 20;
}
```

这样分层后的门槛是：

- Twitter：`5`
- `h1-h6/li/td/th`：`2`
- `p/blockquote`：`20`

没有去动 `EXCLUDE_SELECTORS`、纯符号正则和语言检测逻辑，因此这轮仍然保持“先排除 UI 元素，再给有意义的短标题/短列表项放行”的结构。

### 71.2 初始扫描和 observer 统一复用 helper

本轮把三处硬编码都替换成了 helper 调用：

- Twitter 初始扫描：`getImmersiveMinLength(el, true)`
- 通用初始扫描：`getImmersiveMinLength(p, false)`
- observer 过滤：`getImmersiveMinLength(el, isTwitter)`

结果是：

- `FAQ`
- `Summary`
- 短表格单元格

这类内容在初始扫描和动态内容翻译里都会被一致放行，不再出现“页面首次开启有空洞 / 动态进入时又是另一套门槛”的分裂行为。

### 71.3 不扩大到隐藏元素可见性追踪

discussion 里的 `B` 没有进入本轮。

没有新增：

- `IntersectionObserver`
- `attributes` 级 MutationObserver
- 手动 rescan UI

这次只修“短文本门槛导致的覆盖空洞”，不把“隐藏元素变可见后不翻译”混进同一轮。

## TDD 记录

本轮先新增了 [071-immersive-coverage.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/071-immersive-coverage.test.mjs)。

第一次运行时 3 条子测试全部失败，准确暴露出：

- `getImmersiveMinLength` 尚不存在
- 初始扫描仍然只会保留长段落，`FAQ` 和 `Summary` 继续被 `20` 门槛过滤
- observer 路径也还没有复用新的分层门槛

补上 helper 和 3 个调用点后，定向测试转绿。随后全量测试里又打出了 2 条旧静态断言回归：

- [observer-toast.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/observer-toast.test.mjs)
- [polish-consistency.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/polish-consistency.test.mjs)

这两条原本都锁死了旧的 `5/20` 硬编码；本轮已把它们更新成接受 helper 结构的版本。

## 验证

本轮实际 fresh 跑过：

```bash
node --test tests/071-immersive-coverage.test.mjs
node --test tests/*.test.mjs
node --check content/modules/immersive.js
git diff --check
```

验证结果：

- [071-immersive-coverage.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/071-immersive-coverage.test.mjs)：3/3 通过
- `node --test tests/*.test.mjs`：235/235 通过
- `node --check content/modules/immersive.js`：通过
- `git diff --check`：无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- 短标题（如 `FAQ`）在沉浸式翻译中会显示译文
- 短列表项（如 `Summary`）在沉浸式翻译中不再留下空洞
- 短段落和短碎片文本不会因为本轮调整而被大面积误翻
- 动态新增的短标题/短列表项会和初始扫描保持同一门槛行为
