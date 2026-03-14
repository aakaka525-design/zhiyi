# 062 — 沉浸式 SPA DOM 脱离注入 & Options 保存覆盖并发修改报告

- 状态: done
- 对应任务: [tasks/062-immersive-detach-options-stale.md](../tasks/062-immersive-detach-options-stale.md)
- 来源讨论: [discussions/062-immersive-detach-options-stale.md](../discussions/062-immersive-detach-options-stale.md)
- 执行日期: 2026-03-14

## 结果概览

本轮完成了 `A + B + C`：

- `A` [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的 `injectTranslation()` 现在会在注入前确认目标节点仍在文档中，SPA 路由切换后的脱离节点不会再触发 stale 注入。
- `B` [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 的 `saveSettings()` 现在只发送相对 `initialSettingsSnapshot` 的 diff，并在保存成功后用 merge 方式更新 snapshot 基线，不再把整份陈旧 DOM 快照写回。
- `C` 新增了 [062-immersive-detach-options-stale.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/062-immersive-detach-options-stale.test.mjs) 回归测试；全量验证阶段还同步更新了 [059-storage-race-popup-timeout.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/059-storage-race-popup-timeout.test.mjs) 的旧静态断言，使其与 `062` 的 diff-only 保存模型对齐。

## 已完成改动

### 62.1 `injectTranslation()` 脱离 DOM 守卫

[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的 `ST.injectTranslation` 现在从：

```javascript
ST.injectTranslation = function (container, translation) {
    const nextSibling = container.nextElementSibling;
```

变成：

```javascript
ST.injectTranslation = function (container, translation) {
    if (!document.contains(container)) return;
    const nextSibling = container.nextElementSibling;
```

这条守卫同时覆盖：

- inline 路径的 `container.appendChild(...)`
- block 路径的 `parentNode.insertBefore(...)`

因此 SPA 路由切换后已经脱离文档的旧节点，不会再被后续异步翻译结果回写。

### 62.2 `saveSettings()` 改为 diff-only 保存

[options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 的 `saveSettings()` 现在会先计算：

```javascript
const current = collectCurrentSettings();
const diff = {};
for (const key of Object.keys(current)) {
    if (current[key] !== initialSettingsSnapshot[key]) {
        diff[key] = current[key];
    }
}
```

当 `diff` 为空时直接：

```javascript
setDirtyState(false);
return;
```

真正发给 background 的消息也从整份 settings 改成了：

```javascript
chrome.runtime.sendMessage({ action: 'patchSettings', updates: diff });
```

保存成功后，snapshot 基线现在通过 merge 更新：

```javascript
initialSettingsSnapshot = buildSettingsSnapshot({ ...initialSettingsSnapshot, ...diff });
```

这保证了：

- 只落盘用户当前真正修改的字段
- 其他上下文并发写入的 settings 字段不会被 options 页的陈旧 DOM 快照覆盖
- 不会回退 `053` 已经收敛的 `saveImmediateToggle()` 模型

### 62.3 回归测试与旧断言对齐

本轮新增了 [062-immersive-detach-options-stale.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/062-immersive-detach-options-stale.test.mjs)，覆盖了：

1. `injectTranslation()` 的 `document.contains(container)` 守卫
2. `saveSettings()` 发送 `patchSettings` 时只传 `diff`
3. `initialSettingsSnapshot` 通过 merge 而不是整份赋值更新

全量验证阶段还同步调整了 [059-storage-race-popup-timeout.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/059-storage-race-popup-timeout.test.mjs)。它之前锁定的是 `059` 时期的整份 settings 保存模型；`062` 合法改变了 `saveSettings()` 的实现，所以这条旧静态断言必须更新，否则会把已经确认的更正当成回归。

## TDD 记录

本轮先新增了 [062-immersive-detach-options-stale.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/062-immersive-detach-options-stale.test.mjs)。

首次运行时，3 条子测试全部失败，分别精确暴露出：

- `injectTranslation()` 还没有对脱离文档的容器做保护
- `saveSettings()` 还在发送整份 `settings`
- 保存成功后仍然是整份 snapshot 赋值，而不是 merge 更新基线

补上最小实现后，新增测试转绿。  
全量跑测时，旧的 [059-storage-race-popup-timeout.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/059-storage-race-popup-timeout.test.mjs) 还锁定着 pre-062 的实现，因此一并更新到了新的合法结构。

## 验证

本轮实际跑过：

```bash
node --test tests/062-immersive-detach-options-stale.test.mjs
node --test tests/*.test.mjs
node --check content/modules/immersive.js
node --check options/options.js
git diff --check
```

验证结果：

- [062-immersive-detach-options-stale.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/062-immersive-detach-options-stale.test.mjs)：3/3 通过
- `node --test tests/*.test.mjs`：206/206 通过
- [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) `node --check` 通过
- [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- 沉浸式翻译过程中，如果页面节点被 SPA 路由切换移除，不会再向脱离文档的旧节点注入译文
- Options 页存在未保存表单值时，保存某些字段不会覆盖其他上下文刚写入的新 settings
- `saveSettings()` 在“无实际变化”场景下会直接清掉 dirty 状态而不发网络请求
