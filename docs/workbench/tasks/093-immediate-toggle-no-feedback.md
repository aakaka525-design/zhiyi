---
task: "093"
status: done
priority: P2
created: 2026-03-15
scope: "saveImmediateToggle 添加成功/失败 toast 反馈"
---

# 093 — 设置页 immediate toggle 保存无反馈

## 范围

`saveImmediateToggle` 函数内部添加 toast 反馈。所有 immediate toggle（darkMode、debugMode、showOriginal）统一获得保存确认。

---

## 改动

**文件：`options/options.js` — `saveImmediateToggle` 函数**

改前：

```javascript
async function saveImmediateToggle(partialSettings) {
    try {
        await chrome.runtime.sendMessage({ action: 'patchSettings', updates: partialSettings });
        initialSettingsSnapshot = buildSettingsSnapshot({ ...initialSettingsSnapshot, ...partialSettings });
        refreshDirtyState();
    } catch (err) {
        console.error('[智译] 保存开关设置失败:', err);
    }
}
```

改后：

```javascript
async function saveImmediateToggle(partialSettings) {
    try {
        await chrome.runtime.sendMessage({ action: 'patchSettings', updates: partialSettings });
        initialSettingsSnapshot = buildSettingsSnapshot({ ...initialSettingsSnapshot, ...partialSettings });
        refreshDirtyState();
        showToast('已自动保存');
    } catch (err) {
        console.error('[智译] 保存开关设置失败:', err);
        showToast('自动保存失败: ' + err.message, 'error');
    }
}
```

**toast 文案**（Codex 审阅确定）：
- 成功：`已自动保存`
- 失败：`自动保存失败: ${err.message}`

**不做 darkMode 例外**：darkMode 的视觉切换不等于"已保存"，统一显示 toast。

---

## 约束

1. toast 放在 `saveImmediateToggle` 内部，不分散到调用方
2. 不做任何 toggle 的静默例外
3. **不改** `saveSettings()`（保存按钮路径）
4. **不改** 各调用方的事件处理逻辑
5. **不碰** immersive.js、content.css、storage.js

---

## 测试

### 新增测试

**文件：`tests/093-toggle-save-feedback.test.mjs`**

1. **静态断言**：`saveImmediateToggle` 函数体中包含 `showToast`
2. **静态断言**：`saveImmediateToggle` 的 catch 块中包含 `showToast` + `'error'`

### 旧测试基线同步

以下测试当前断言 `saveImmediateToggle` 的旧结构（无 toast），需要同步更新：

- `tests/immersive-selection-options-toggle.test.mjs`
- `tests/059-storage-race-popup-timeout.test.mjs`

更新内容：将断言中的 `saveImmediateToggle` 结构正则/快照匹配更新为包含 `showToast` 的新结构。

全量 `node --test tests/*.test.mjs` 必须通过。

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `options/options.js` | `saveImmediateToggle` 添加 toast |
| `tests/093-toggle-save-feedback.test.mjs` | 新增测试 |
| `tests/immersive-selection-options-toggle.test.mjs` | 旧测试基线同步 |
| `tests/059-storage-race-popup-timeout.test.mjs` | 旧测试基线同步 |
