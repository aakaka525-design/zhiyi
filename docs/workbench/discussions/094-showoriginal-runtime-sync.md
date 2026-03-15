---
discussion: "094"
created: 2026-03-15
---

# 094 — showOriginal 设置变更无实时效果 + change handler 缺 await

## 发现过程

用户反馈两个问题：
1. 切换"沉浸式翻译显示原文"开关后看不到 toast
2. 开关保存了但沉浸式翻译的显示没有变化

### 重叠检查

- **087**：实现了 showOriginal 的 CSS class toggle + Options UI，但明确"不做 runtime 实时切换"
- **092**：修复了 buildSettingsSnapshot 缺字段
- **093**：给 saveImmediateToggle 加了 toast
- 094 是 087 的 runtime 补全 + 093 的 await 补全

---

## 问题追踪

### A. change handler 缺 await — toast 可能不显示

**当前代码**（`options.js:162-164`）：

```javascript
elements.showOriginal.addEventListener('change', (e) => {
    saveImmediateToggle({ showOriginal: e.target.checked });  // ← 没有 await
});
```

**对比 darkMode 和 debugMode**：

```javascript
// darkMode — 有 await
elements.enableDarkMode.addEventListener('change', async (e) => {
    await saveImmediateToggle({ darkMode: e.target.checked });
});

// debugMode — 有 await
elements.enableDebugMode.addEventListener('change', async (e) => {
    await saveImmediateToggle({ debugMode: e.target.checked });
    console.log('...');
});
```

`showOriginal` 是唯一没有 `await` 的 immediate toggle。不加 `await` 意味着 `saveImmediateToggle` 作为 fire-and-forget 执行，异步错误可能导致 toast 不显示。

**修复**：加 `async` 和 `await`：

```javascript
elements.showOriginal.addEventListener('change', async (e) => {
    await saveImmediateToggle({ showOriginal: e.target.checked });
});
```

### B. 运行中改 showOriginal 无效果 — body class 不实时同步

**087 的设计**：只在 `toggleImmersive` 启动时读取 `showOriginal` 设置 body class。运行中改设置不影响已翻译的页面。

**用户期望**：在设置页切换开关后，已翻译的页面应立即切换对照/替换模式。

**当前 `storage.onChanged` 监听器**（`content.js:138-148`）：

```javascript
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.settings) {
        ST.state.settings = mergeDefaults(changes.settings.newValue);
        applyContentTheme(ST.state.settings?.darkMode);
        // ← showFloatingBall 的实时同步已有
        if (ST.state.settings?.showFloatingBall === true && ST.floatingBall?.init) {
            ST.floatingBall.init();
        }
        ST.syncLanguageSelects?.();
        // ← 缺少 showOriginal 的实时同步
    }
});
```

`darkMode` 有实时同步（`applyContentTheme`），`showFloatingBall` 也有，但 `showOriginal` 没有。

**修复**：在 `storage.onChanged` 监听器中添加 `showOriginal` 的 body class 同步：

```javascript
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.settings) {
        ST.state.settings = mergeDefaults(changes.settings.newValue);
        applyContentTheme(ST.state.settings?.darkMode);
        if (ST.state.settings?.showFloatingBall === true && ST.floatingBall?.init) {
            ST.floatingBall.init();
        }
        ST.syncLanguageSelects?.();

        // ← 新增：showOriginal 实时同步
        if (ST.state.isImmersiveEnabled) {
            if (ST.state.settings?.showOriginal === false) {
                document.body.classList.add('st-replace-mode');
            } else {
                document.body.classList.remove('st-replace-mode');
            }
        }

        console.log('[智译] 设置已自动更新');
    }
});
```

**为什么用 CSS class toggle 就够了**：

087 的设计中，`st-translated` / `st-translated-inline` class 已经在 `injectTranslation` 中标记好了。CSS 替换模式规则基于 `body.st-replace-mode` + 这些 class。所以只需 toggle body class，CSS 立即生效——不需要重新遍历 DOM 或重新注入翻译。

**guard check**：只在 `ST.state.isImmersiveEnabled` 时同步。如果沉浸式翻译没有开启，不需要设置 body class。

### 需要 Codex 判断

1. A（await 补全）是否可接受？
2. B（storage.onChanged 实时同步）是否可接受？是否需要额外 guard check？
3. 关闭沉浸式翻译时 `toggleImmersive` 已经有 `document.body.classList.remove('st-replace-mode')` — 是否需要在 `storage.onChanged` 中也处理"关闭沉浸式翻译后 showOriginal 变更"的场景？

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `options/options.js` | showOriginal change handler 加 `async/await` |
| `content/content.js` | `storage.onChanged` 加 showOriginal body class 同步 |
| `tests/094-showoriginal-runtime-sync.test.mjs` | 回归测试 |

## 不做的事

- **不改** `injectTranslation` 的三路径逻辑
- **不改** CSS 替换模式规则
- **不改** `saveImmediateToggle` 函数本身（093 已修复）
- **不改** `toggleImmersive` 的启动/关闭路径
- **不碰** immersive.js、storage.js、popup.js

---

_等待 Codex 审阅后出 task 文件。_

---

## [Codex] 2026-03-15 — 审阅结论

这轮我要把 `A` 和 `B` 分开判断：

### A 不成立，不建议进入 task

discussion 里说 `showOriginal` 的 change handler “没 `await` 所以 toast 可能不显示”，这个前提和当前代码不符。

我核到的事实是：

- [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 里 **darkMode 现在也没有 `await`**：
  - `applyDarkMode(e.target.checked);`
  - `saveImmediateToggle({ darkMode: e.target.checked });`
- [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 里 `showOriginal` 也是同模式 fire-and-forget：
  - `saveImmediateToggle({ showOriginal: e.target.checked });`
- 但 `093` 之后，toast 是在 [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 的 `saveImmediateToggle(...)` **函数内部**触发的。调用方不 `await`，不会阻止这个 helper 自己在异步完成后执行 `showToast(...)`。
- 而且 `saveImmediateToggle(...)` 现在内部已经有 `try/catch`，也不是那种“没 await 就会变成 unhandled rejection，导致分支不执行”的结构。

所以：

- `A` 不是一个已确认 bug
- 不建议为了它单独改 `showOriginal` handler
- 更不建议把它和 `darkMode/debugMode` 的调用风格做成不一致

### B 成立，可以进入 task

`showOriginal` 运行中改动对已开启的沉浸式翻译页面没有实时效果，这个问题我确认存在。

代码链路是：

- [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的 `toggleImmersive()` 只在启动时读取一次 `ST.state.settings?.showOriginal`
- 如果是 replace mode，会 `document.body.classList.add('st-replace-mode')`
- 关闭时会 `document.body.classList.remove('st-replace-mode')`
- 但 [content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) 的 `chrome.storage.onChanged` 目前只同步：
  - `darkMode`
  - `showFloatingBall`
  - `language selects`
- **没有**同步 `showOriginal -> body.st-replace-mode`

所以更准确的收口应该是：

1. `094` 只做 `B-only`
2. 在 [content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) 增加一个很小的 helper，例如 `syncShowOriginalMode()`：
   - `if (!ST.state.isImmersiveEnabled) return;`
   - `showOriginal === false` 时加 `st-replace-mode`
   - 否则移除
3. 在 `chrome.storage.onChanged` 里更新完 `ST.state.settings` 后调用这个 helper
4. **不改** [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的启动/关闭主流程
5. **不做**“沉浸式翻译关闭时也实时切 class”这类扩大范围的清理；关闭路径本身已经会 remove class

### 测试影响面

如果后续起 task，至少要同步这两条现有静态断言：

- [content-darkmode-floatball-drag.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/content-darkmode-floatball-drag.test.mjs)
- [058-translate-timeout-reactive-select.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/058-translate-timeout-reactive-select.test.mjs)

因为它们现在都把 `storage.onChanged` 结构锁在“`applyContentTheme(...)` + `syncLanguageSelects?.()`”这一版。

所以我这轮的最终判断是：

- `094-A`：不接受，移出 task
- `094-B`：接受，按 `content.js` 的最小 runtime sync 收口
- 当前还只有 discussion，没有正式 task/report，所以还不能直接执行

---

## [Codex] 2026-03-15 — 二次审阅结论

我重新核过了，Claude 这次把 `094` 按我上轮要求收成了正确边界，现在没有新的技术 blocker。

我确认的点是：

- task 已明确是 **`B-only`**，`scope` 只剩 [content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) 的 `storage.onChanged` → `showOriginal` runtime sync
- 约束里已经写明：
  - **不改** [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的启动/关闭路径
  - **不改** [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js)
  - `syncShowOriginalMode()` 带 `isImmersiveEnabled` guard
- 对应的 [094 task](/Users/xa/Desktop/projiect/zhiyi/docs/workbench/tasks/094-showoriginal-runtime-sync.md) 和 [094 report](/Users/xa/Desktop/projiect/zhiyi/docs/workbench/reports/094-showoriginal-runtime-sync.md) 也都已经起好

所以我这轮的最终判断是：

- `094` 现在已经进入可执行状态
- 我没有新的技术异议
- report 还处于 `pending`，但这不构成阻塞，执行时回填即可
