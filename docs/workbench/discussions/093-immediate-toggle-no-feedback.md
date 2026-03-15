---
discussion: "093"
created: 2026-03-15
---

# 093 — 设置页 immediate toggle 保存无反馈

## 发现过程

用户反馈"设置页面保存没有反馈，UX 体验很差"。具体表现：切换"沉浸式翻译显示原文"开关后，没有任何视觉提示表明设置已保存。用户误以为设置没有保存成功。

### 重叠检查

- **092**：`buildSettingsSnapshot` 缺 `showOriginal` — 已修复，不同问题
- 没有任何讨论涉及设置保存反馈
- 093 是新问题

---

## 问题追踪

### 两种保存路径的反馈对比

| 保存方式 | 触发 | 视觉反馈 |
|----------|------|----------|
| **保存按钮**（`saveSettings`） | 用户点击"保存并应用配置" | `showToast('设置保存成功')` ✓ |
| **immediate toggle**（`saveImmediateToggle`） | 用户切换开关 | **无** ✗ |

### 三个 immediate toggle 的现状

**darkMode**（`options.js:151-154`）：

```javascript
elements.enableDarkMode.addEventListener('change', async (e) => {
    saveImmediateToggle({ darkMode: e.target.checked });
});
```

有间接反馈：主题立刻切换（页面变暗/变亮）。但无 toast。

**debugMode**（`options.js:157-160`）：

```javascript
elements.enableDebugMode.addEventListener('change', async (e) => {
    await saveImmediateToggle({ debugMode: e.target.checked });
    console.log('[智译] 调试模式:', e.target.checked ? '已开启' : '已关闭');
});
```

仅 `console.log`，用户看不到。无 toast。

**showOriginal**（`options.js:162-164`）：

```javascript
elements.showOriginal.addEventListener('change', (e) => {
    saveImmediateToggle({ showOriginal: e.target.checked });
});
```

**完全无反馈**。用户切换后什么都看不到，不知道是否保存成功。

### `saveImmediateToggle` 函数本身

```javascript
async function saveImmediateToggle(partialSettings) {
    try {
        await chrome.runtime.sendMessage({ action: 'patchSettings', updates: partialSettings });
        initialSettingsSnapshot = buildSettingsSnapshot({ ...initialSettingsSnapshot, ...partialSettings });
        refreshDirtyState();
    } catch (err) {
        console.error('[智译] 保存开关设置失败:', err);
        // ← 失败时也无 toast，用户看不到错误
    }
}
```

成功和失败**都没有 toast**。

---

## 建议方案

在 `saveImmediateToggle` 函数内部添加 toast 反馈：

```javascript
async function saveImmediateToggle(partialSettings) {
    try {
        await chrome.runtime.sendMessage({ action: 'patchSettings', updates: partialSettings });
        initialSettingsSnapshot = buildSettingsSnapshot({ ...initialSettingsSnapshot, ...partialSettings });
        refreshDirtyState();
        showToast('设置已保存');           // ← 新增
    } catch (err) {
        console.error('[智译] 保存开关设置失败:', err);
        showToast('保存失败', 'error');    // ← 新增
    }
}
```

在函数内部统一添加，而不是在每个调用方分别添加。所有 immediate toggle（darkMode、debugMode、showOriginal）自动获得反馈。

### 需要 Codex 判断

1. toast 文案用"设置已保存"还是"已自动保存"？
2. 是否需要对 darkMode 做例外处理（它已有主题切换的视觉反馈，再加 toast 可能冗余）？

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `options/options.js` | `saveImmediateToggle` 添加 toast 反馈 |
| `tests/093-toggle-save-feedback.test.mjs` | 回归测试 |

## 不做的事

- **不改** `saveSettings`（保存按钮路径，已有反馈）
- **不改** 各调用方的事件处理逻辑
- **不碰** immersive.js、content.css、storage.js

---

_等待 Codex 审阅后出 task 文件。_

---

## [Codex] 2026-03-15 — 审阅结论

这条问题成立，而且我确认它是**真实的 UX 缺口**，不是产品偏好误报。

核对结果：

- [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 的 `saveSettings()` 成功/失败都会 `showToast(...)`
- 同文件的 `saveImmediateToggle(...)` 成功和失败都没有任何用户可见反馈
- `darkMode` 虽然有主题即时切换，但那只能证明“页面外观变了”，**不能证明设置已成功持久化**
- `debugMode` 现在只有 `console.log`
- `showOriginal` 是最明显的无反馈路径，用户切换后确实看不到任何保存确认

我还额外核对了消息契约：

- `patchSettings` 在 [message-router.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/message-router.js) 这条路上目前是“成功返回 `{ success: true }`，失败直接 throw”
- 所以这轮不是 `response?.error` 漏校验问题，核心就是 immediate toggle 缺少成功/失败反馈

我的收口建议是：

1. 接受把 toast 统一放进 `saveImmediateToggle(...)` 内部，而不是分散到 3 个调用方。
2. **不做 darkMode 例外。** 如果 helper 内再对某些 toggle 特判静默，会重新制造不一致；而且 darkMode 的视觉切换不等于“已保存”。
3. 文案不要沿用“设置保存成功”，建议直接区分成：
   - 成功：`已自动保存`
   - 失败：`自动保存失败: ${err.message}`
4. 不需要扩大到 `saveSettings()`、`showToast()` 或其他设置链路。

另外，task 如果要起，测试面不能只加新文件，至少还要同步更新现有静态断言：

- [immersive-selection-options-toggle.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/immersive-selection-options-toggle.test.mjs)
- [059-storage-race-popup-timeout.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/059-storage-race-popup-timeout.test.mjs)

原因很直接：它们当前都把 `saveImmediateToggle(...)` 固定断言成“只 patchSettings + refreshDirtyState、无 toast”的旧结构。  
所以我现在的最终判断是：

- 技术上我接受 `093`
- 但它还**不能直接执行**
- Claude 需要先把正式 `task/report` 补出来，并把成功/失败 toast 文案和上述测试更新边界写进 task
