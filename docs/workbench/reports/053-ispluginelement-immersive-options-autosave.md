# 053 — 沉浸式翻译文本排除划词触发 & options 开关只保存自身字段报告

- 状态: done
- 对应任务: [tasks/053-ispluginelement-immersive-options-autosave.md](../tasks/053-ispluginelement-immersive-options-autosave.md)
- 来源讨论: [discussions/053-ispluginelement-immersive-options-autosave.md](../discussions/053-ispluginelement-immersive-options-autosave.md)
- 执行日期: 2026-03-13

## 结果概览

本轮完成了 `A/B`：

- `A` 沉浸式译文和分隔符不再触发 selection 模块的二次划词翻译，但没有扩大共享 `isPluginElement()` 的语义范围。
- `B` options 页的深色模式和调试模式现在只立即保存自身字段，不再把未确认的整页表单值静默写入 storage。

## 已完成改动

### 53.1 A 沉浸式译文局部排除 selection 触发

[selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) 在模块顶部新增了局部 helper：

```javascript
function isImmersiveElement(el) {
    return el.closest('.st-immersive-wrapper') ||
        el.classList?.contains('st-immersive-translation') ||
        el.classList?.contains('st-translation-separator');
}
```

随后在两个入口各加了一行守卫：

- `handleMouseUp()`：`ST.isPluginElement(e.target)` 之后直接 `if (isImmersiveElement(e.target)) return;`
- `handleDoubleClick()`：保留原有 `ST.removeIcon()` 和插件元素判断，再额外 `if (isImmersiveElement(e.target)) return;`

这次修复刻意没有去改 [utils.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/utils.js) 的共享 `ST.isPluginElement()`。这样可以保证：

- 选中或双击沉浸式译文时，不会再触发二次翻译
- 点击沉浸式译文时，[handleMouseDown()](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) 仍然会按原语义关闭 bubble / icon
- 不会顺手影响 immersive 观察器或其他共享调用方

### 53.2 B options 开关即时保存只更新自身字段

[options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 在 [saveSettings()](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 后新增了：

```javascript
async function saveImmediateToggle(partialSettings) {
    try {
        await StorageManager.updateSettings(partialSettings);
        await chrome.runtime.sendMessage({ action: 'updateSettings' });
        initialSettingsSnapshot = buildSettingsSnapshot({ ...initialSettingsSnapshot, ...partialSettings });
        refreshDirtyState();
    } catch (err) {
        console.error('[智译] 保存开关设置失败:', err);
    }
}
```

然后把两个 change handler 改成走这个 helper：

- 深色模式：先 `applyDarkMode(...)`，再 `saveImmediateToggle({ darkMode: e.target.checked })`
- 调试模式：改为 `await saveImmediateToggle({ debugMode: e.target.checked })`

这样现在的行为是：

- 切换深色模式 / 调试模式时，只 merge 保存该字段
- `updateSettings` 消息不再传整份表单数据，background 自己从 storage 读最新设置
- `initialSettingsSnapshot` 用不可变方式只更新对应字段基线
- 其他未保存输入仍然保留 dirty state，保存按钮语义不变

本轮没有改：

- [saveSettings()](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 的整页保存逻辑
- [buildSettingsSnapshot()](/Users/xa/Desktop/projiect/zhiyi/options/options-ui-state.js)
- [collectCurrentSettings()](/Users/xa/Desktop/projiect/zhiyi/options/options.js)

## TDD 记录

本轮按 test-first 执行，先新增了 [immersive-selection-options-toggle.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/immersive-selection-options-toggle.test.mjs)。

首次运行：

```bash
node --test tests/immersive-selection-options-toggle.test.mjs
```

时 2 个子测试全部失败，分别暴露出：

- `selection.js` 还没有局部 `isImmersiveElement` helper，也没有在 `handleMouseUp` / `handleDoubleClick` 加守卫
- `options.js` 还没有 `saveImmediateToggle`，深色模式和调试模式仍然直接调用 `saveSettings()`

补丁完成后，该新增测试转绿。

## 验证

本轮实际跑过：

```bash
node --test tests/immersive-selection-options-toggle.test.mjs
node --test tests/*.test.mjs
node --check content/modules/selection.js
node --check options/options.js
git diff --check
```

验证结果：

- [immersive-selection-options-toggle.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/immersive-selection-options-toggle.test.mjs)：2/2 通过
- `node --test tests/*.test.mjs`：185/185 通过
- [selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) `node --check` 通过
- [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- 沉浸式模式下选中或双击译文，不再弹出划词 icon / bubble
- 点击沉浸式译文时，已有 bubble / icon 仍会像以前一样关闭
- options 页存在未保存 API Key 修改时，切换深色模式 / 调试模式不会把这些字段静默保存
- 深色模式和调试模式切换后，保存按钮的 dirty state 能正确保留其他未保存修改
