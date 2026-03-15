# 079 — Observer 翻译请求不分批修复报告

- 状态: done
- 对应任务: [tasks/079-observer-unbatched-scroll-rescan.md](../tasks/079-observer-unbatched-scroll-rescan.md)
- 来源讨论: [discussions/079-observer-unbatched-scroll-rescan.md](../discussions/079-observer-unbatched-scroll-rescan.md)
- 执行日期: 2026-03-14

## 结果概览

本轮按收窄后的 `A-only` 范围完成了 observer 分批修复：

- [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 新增了共享常量 `IMMERSIVE_BATCH_SIZE = 10`。
- 初始扫描和 observer 路径现在都复用这个常量，不再各自漂移。
- observer 的翻译请求已从“整包发送 + 整包 pending 清理”改成“按批发送 + 按批 finally 清理”。
- 新增专项回归测试 [079-observer-batch.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/079-observer-batch.test.mjs)。
- 为对齐 `079` 的合法新结构，同步更新了两条旧静态断言：
  - [immersive-observer-test-timeout.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/immersive-observer-test-timeout.test.mjs)
  - [observer-toast.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/observer-toast.test.mjs)

scroll rescan 没有进入本轮。

## 已完成改动

### 79.1 初始扫描和 observer 现在共享同一批次常量

[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 现在在模块级定义：

```javascript
const IMMERSIVE_BATCH_SIZE = 10;
```

随后两条路径都统一改成引用这个常量：

- 初始扫描 `for (let i = 0; i < paragraphs.length; i += IMMERSIVE_BATCH_SIZE)`
- observer `for (let i = 0; i < newElements.length; i += IMMERSIVE_BATCH_SIZE)`

这修掉的是讨论里指出的结构漂移风险：以后如果需要调批次大小，不会再只改一条路径。

### 79.2 observer 不再把整批新元素一次性送进 translateBatch

改前 observer 是：

```javascript
newElements.forEach(el => ST.pendingTranslations.add(el));
const texts = newElements.map(el => el.innerText.trim());
const response = await ST.sendMessage({ action: 'translateBatch', texts, to: targetLang }, 60000, '批量翻译超时');
...
finally {
    newElements.forEach(el => ST.pendingTranslations.delete(el));
}
```

现在已经改成：

```javascript
for (let i = 0; i < newElements.length; i += IMMERSIVE_BATCH_SIZE) {
    const batch = newElements.slice(i, i + IMMERSIVE_BATCH_SIZE);
    batch.forEach(el => ST.pendingTranslations.add(el));
    const texts = batch.map(el => el.innerText.trim());

    try {
        const response = await ST.sendMessage({ action: 'translateBatch', texts, to: targetLang }, 60000, '批量翻译超时');
        ...
    } finally {
        batch.forEach(el => ST.pendingTranslations.delete(el));
    }

    if (i + IMMERSIVE_BATCH_SIZE < newElements.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}
```

行为变化是：

- 一次滚动加载 30-50 个节点时，不再整包命中 `translateBatch`
- 每批最多 10 个，和初始扫描同构
- 单批失败只影响本批，不会把整批都卡死

### 79.3 pendingTranslations 现在按批次 finally 清理

这条是本轮另一个关键点。

旧逻辑里，observer 会先把全部 `newElements` 加进 `pendingTranslations`，然后整包在最后统一删掉。如果中间某批超时、取消或 runId 改变，后续元素会长时间占着 pending，继续干扰 dedupe。

现在已经改成：

- 每一批开始前 `batch.forEach(add)`
- 每一批 `finally` 里 `batch.forEach(delete)`

这样：

- 批次之间互不污染
- 中途取消时，已完成批次和当前批次都能正常释放 pending
- 后续 observer 不会因为历史遗留 pending 错过元素

## TDD 记录

本轮先新增了 [079-observer-batch.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/079-observer-batch.test.mjs)。

第一次运行时，4 个断言全部按预期失败，失败点是准确的：

- `IMMERSIVE_BATCH_SIZE` 不存在
- 初始扫描仍是局部 `const batchSize = 10`
- observer 仍然整包 `newElements.map(...)`
- `pendingTranslations` 仍然是整包 add / delete

也就是说，红灯直接证明问题还在，不是测试写错。

补上最小实现后，专项测试转绿。随后全量测试里有 2 条旧静态断言失败，但失败原因是它们还假设 observer 仍是“整包发送/整包清理”。我只把这两条测试放宽到新结构，不改它们原本的意图：

- 仍然验证 observer 有 `runId` 守卫
- 仍然验证 observer 使用 `finally` 清理 pending
- 仍然验证沿用同一 `getImmersiveMinLength(...)`

## 验证

本轮实际 fresh 跑过：

```bash
node --test tests/079-observer-batch.test.mjs
node --test tests/*.test.mjs
node --check content/modules/immersive.js
git diff --check
```

验证结果：

- [079-observer-batch.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/079-observer-batch.test.mjs)：`4/4` 通过
- `node --test tests/*.test.mjs`：`276/276` 通过
- `node --check content/modules/immersive.js`：通过
- `git diff --check`：无输出

## Residual Risk

这轮刻意没有做：

- scroll rescan
- 可见性变化导致的二次补扫
- observer 选择器/过滤逻辑调整
- MutationObserver 配置调整

因此 residual risk 仍然是：

- 某些“元素不是因为批量超时丢失，而是因为显示状态变化后才可见”的页面，仍可能需要后续单独任务处理

这是 discussion 中明确接受的后续项，不属于本轮漏修。

## 手动验证

这轮还没做真实 Chrome 手测。待人工确认的页面级行为包括：

- 无限滚动页面一次加载大量新内容时，沉浸式翻译不再整包超时全丢
- 关闭沉浸式翻译或切 run 时，observer 中途批次会及时停下
- 大批量新增元素后，后续 observer 不会因为遗留 pendingTranslations 而持续漏翻
