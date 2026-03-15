---
task: "092"
status: done
priority: P1
created: 2026-03-15
scope: "buildSettingsSnapshot 补 showOriginal 字段 + 测试"
---

# 092 — showOriginal 设置无法保存 — buildSettingsSnapshot 缺少字段

## 范围

`buildSettingsSnapshot` 补 `showOriginal` 字段，修复 087 的设置持久化 bug。

---

## 改动

**文件：`options/options-ui-state.js` — `buildSettingsSnapshot` 函数**

在 `debugMode` 之后添加一行：

```javascript
export function buildSettingsSnapshot(settings) {
    return {
        // ... 现有字段 ...
        debugMode: Boolean(settings.debugMode),
        showOriginal: settings.showOriginal !== false,  // ← 新增
        ttsProvider: settings.ttsProvider || 'system',
        // ... 其余不变 ...
    };
}
```

---

## 约束

1. 只改 `options-ui-state.js` 一个文件的一行
2. **不改** `options.js`（已正确接线）
3. **不改** `immersive.js`、`storage.js`

---

## 测试

### 现有测试文件补充

**如果存在 `tests/options-ui-state.test.mjs`**，在其中添加：

1. **`buildSettingsSnapshot` 保留 `showOriginal: true`**：调用 `buildSettingsSnapshot({ showOriginal: true, ...其他必要字段 })` → 断言结果包含 `showOriginal: true`
2. **`buildSettingsSnapshot` 保留 `showOriginal: false`**：调用 `buildSettingsSnapshot({ showOriginal: false, ...其他必要字段 })` → 断言结果包含 `showOriginal: false`
3. **`buildSettingsSnapshot` 默认 `showOriginal` 为 true**：调用 `buildSettingsSnapshot({ ...其他字段，不传 showOriginal })` → 断言结果包含 `showOriginal: true`

**如果不存在**，创建 `tests/092-showoriginal-snapshot.test.mjs` 包含上述 3 条测试。

### 静态断言

4. **`options-ui-state.js` 包含 `showOriginal`**：读取源码，断言包含 `showOriginal`

全量 `node --test tests/*.test.mjs` 必须通过。

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `options/options-ui-state.js` | `buildSettingsSnapshot` 添加 `showOriginal` |
| `tests/092-showoriginal-snapshot.test.mjs`（或现有测试文件） | 回归测试 |
