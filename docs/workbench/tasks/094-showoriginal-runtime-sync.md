---
task: "094"
status: done
priority: P2
created: 2026-03-15
scope: "content.js storage.onChanged 添加 showOriginal → body.st-replace-mode 实时同步"
---

# 094 — showOriginal 运行中设置变更实时同步

## 范围

只做 B（runtime sync）。A（await 补全）已被 Codex 否决。

---

## 改动

**文件：`content/content.js`**

### 1. 新增 helper 函数

在 `applyContentTheme` 函数附近添加：

```javascript
function syncShowOriginalMode() {
    if (!ST.state.isImmersiveEnabled) return;
    if (ST.state.settings?.showOriginal === false) {
        document.body.classList.add('st-replace-mode');
    } else {
        document.body.classList.remove('st-replace-mode');
    }
}
```

### 2. 在 `storage.onChanged` 监听器中调用

```javascript
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.settings) {
        ST.state.settings = mergeDefaults(changes.settings.newValue);
        applyContentTheme(ST.state.settings?.darkMode);
        if (ST.state.settings?.showFloatingBall === true && ST.floatingBall?.init) {
            ST.floatingBall.init();
        }
        ST.syncLanguageSelects?.();
        syncShowOriginalMode();              // ← 新增
        console.log('[智译] 设置已自动更新');
    }
});
```

---

## 约束

1. **只改 `content/content.js`**
2. `syncShowOriginalMode` 有 `isImmersiveEnabled` guard — 沉浸式未开启时不操作 body class
3. **不改** `immersive.js` 的启动/关闭路径（`toggleImmersive` 已有 add/remove class 逻辑）
4. **不改** `options.js`（A 已被否决）
5. **不改** CSS 替换模式规则
6. **不碰** immersive.js、storage.js、popup.js

---

## 测试

**文件：`tests/094-showoriginal-runtime-sync.test.mjs`**

### 静态断言

1. `content.js` 包含 `syncShowOriginalMode` 函数定义
2. `content.js` 的 `storage.onChanged` 监听器中包含 `syncShowOriginalMode` 调用

### 旧测试基线同步

以下测试断言了 `storage.onChanged` 的旧结构，需同步更新：

- `tests/content-darkmode-floatball-drag.test.mjs`
- `tests/058-translate-timeout-reactive-select.test.mjs`

全量 `node --test tests/*.test.mjs` 必须通过。

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `content/content.js` | `syncShowOriginalMode` helper + onChanged 调用 |
| `tests/094-showoriginal-runtime-sync.test.mjs` | 新增测试 |
| `tests/content-darkmode-floatball-drag.test.mjs` | 旧测试基线同步 |
| `tests/058-translate-timeout-reactive-select.test.mjs` | 旧测试基线同步 |

## 验证

- `/opt/homebrew/bin/node --test tests/094-showoriginal-runtime-sync.test.mjs`
- `/opt/homebrew/bin/node --test tests/*.test.mjs`
- `/opt/homebrew/bin/node --check content/content.js`
- `git diff --check`
