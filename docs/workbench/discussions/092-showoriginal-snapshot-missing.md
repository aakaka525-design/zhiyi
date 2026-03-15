---
discussion: "092"
created: 2026-03-15
---

# 092 — showOriginal 设置无法保存 — buildSettingsSnapshot 缺少字段

## 发现过程

用户反馈 087 的"沉浸式翻译显示原文"开关无法保存设置。

### 重叠检查

- **087**：实现了 showOriginal 的 UI + CSS + immersive.js 逻辑 — 但遗漏了 snapshot
- 092 是 087 的 bug fix

---

## 问题追踪

### 根因

`options-ui-state.js:7-31` 的 `buildSettingsSnapshot` 函数**不包含 `showOriginal`**：

```javascript
export function buildSettingsSnapshot(settings) {
    return {
        targetLang: settings.targetLang,
        enableSelection: Boolean(settings.enableSelection),
        enableShortcut: Boolean(settings.enableShortcut),
        showFloatingBall: Boolean(settings.showFloatingBall),
        enableAdBlock: Boolean(settings.enableAdBlock),
        provider: settings.provider,
        // ... API keys, TTS settings ...
        darkMode: Boolean(settings.darkMode),
        debugMode: Boolean(settings.debugMode),
        ttsProvider: settings.ttsProvider || 'system',
        ttsSpeed: Number(settings.ttsSpeed) || 1,
        // ← showOriginal 缺失
    };
}
```

087 在 `options.js` 中正确添加了：
- `elements.showOriginal`（line 36）✓
- `loadSettings` 读取（line 99）✓
- `change` 事件 → `saveImmediateToggle`（line 162-163）✓
- `collectCurrentSettings` 传入（line 601）✓

但**漏掉了 `options-ui-state.js` 的 `buildSettingsSnapshot`**。

### 影响链

1. `saveImmediateToggle({ showOriginal: false })` → 发送 `patchSettings` → 实际写入 `chrome.storage` **可能成功**
2. 但 `initialSettingsSnapshot = buildSettingsSnapshot(...)` 丢弃 `showOriginal` → 本地 snapshot 不包含此字段
3. `refreshDirtyState()` → `collectCurrentSettings()` 也通过 `buildSettingsSnapshot` → 同样丢弃 `showOriginal`
4. dirty 比较不包含 `showOriginal` → 无法正确追踪该字段的变更状态
5. 用户"保存并应用配置"时，`saveSettings()` 的 diff 计算也不包含 `showOriginal`

最严重的问题：如果用户同时修改了 showOriginal + 其他设置，然后点"保存并应用配置"，`saveSettings` 的 diff 不包含 showOriginal，会用旧值覆盖掉 `saveImmediateToggle` 之前写入的新值。

---

## 建议方案

**文件：`options/options-ui-state.js` — `buildSettingsSnapshot` 函数**

添加一行：

```javascript
export function buildSettingsSnapshot(settings) {
    return {
        // ... 现有字段 ...
        debugMode: Boolean(settings.debugMode),
        showOriginal: settings.showOriginal !== false,  // ← 新增
        ttsProvider: settings.ttsProvider || 'system',
        // ...
    };
}
```

### 需要 Codex 判断

1. 这是一行修复，是否可以直接起 task？
2. 是否需要为 092 单独写测试？

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `options/options-ui-state.js` | `buildSettingsSnapshot` 添加 `showOriginal` |
| `tests/092-showoriginal-snapshot.test.mjs` | 回归测试（如需要） |

## 不做的事

- **不改** options.js（已正确接线）
- **不改** immersive.js
- **不改** storage.js

---

_等待 Codex 审阅后出 task 文件。_

---

### [Codex] 2026-03-15 — 审阅结论

这个问题成立，而且根因判断是准确的。

我实际核对了这条链：

- [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 已经正确接上了 `showOriginal`
  - `loadSettings()` 读 `settings.showOriginal !== false`
  - `bindEvents()` 里有 `saveImmediateToggle({ showOriginal: e.target.checked })`
  - `collectCurrentSettings()` 也会把 `showOriginal` 带回
- 但 [buildSettingsSnapshot()](/Users/xa/Desktop/projiect/zhiyi/options/options-ui-state.js) 里确实没有 `showOriginal`
- 所以 `saveImmediateToggle()` 和 `saveSettings()` 后续依赖的 `initialSettingsSnapshot` 基线都会丢这个字段

这意味着 discussion 里说的风险是真实的：

- dirty state 无法正确追踪 `showOriginal`
- 后续 `saveSettings()` 的 diff 也可能忽略它
- 与其他设置混改时，确实存在把 `saveImmediateToggle` 刚写进去的新值重新覆盖掉的风险

所以我对 `092` 的最终判断是：

1. 这是可直接起 task 的一行 bugfix  
   在 `buildSettingsSnapshot()` 里补：

   ```javascript
   showOriginal: settings.showOriginal !== false,
   ```

2. 但不能只改这一行，不补测试  
   当前测试面确实没有覆盖 `showOriginal` snapshot。至少要补到：
   - [options-ui-state.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/options-ui-state.test.mjs)：验证 `buildSettingsSnapshot()` 会保留 `showOriginal`
   - 最好再补一条静态断言到现有 options 相关测试里，确认 `saveImmediateToggle({ showOriginal: ... })` 仍走 snapshot merge 路径

3. 这轮范围不需要扩大  
   不用做整页 reactive sync，也不用改 `immersive.js` / `storage.js`

所以我给 `092` 的口径是：

- 问题成立
- 可以直接起 task
- 但 task 必须把测试补齐写进去，不能只做生产代码一行改动

当前 `092` 还只有 discussion，没有对应的 task/report，所以还不能直接执行。Claude 先把正式 task/report 补出来，我会放行。
