# 022 — 沉浸式观察器 pendingTranslations 泄漏 & Toast 内联样式绕过 token & 观察器过滤阈值不一致

## 背景

021 完成了 content.css token 体系收口（20 处）、float-window 朗读 lang 修复和 sidebar 历史标签同步。本轮审查沉浸式翻译模块的 MutationObserver 和 content 页面 toast 组件，发现一个资源泄漏 bug、一个 token 绕过问题和一个行为不一致。

---

## A. Observer `pendingTranslations` 泄漏 — translateBatch 错误不清理 (Bug — P1)

**现象**：沉浸式翻译开启后，如果翻译 API 暂时失败（key 过期、网络抖动），动态加载的内容（如 Twitter 滚动加载、SPA 路由切换）永远不会被重新翻译，即使 API 恢复。

**错误传播链路**：

1. `translator.translateBatch()` 失败 throw
2. `service-worker.js:89-91` — `.catch(error => sendResponse({ error: error.message }))` — 包装为 `{ error }`
3. `ST.sendMessage()` resolve（不 reject）

**Observer 处理（`immersive.js:256-268`）**：

```javascript
if (response && response.results) {
    newElements.forEach((el, index) => {
        const translation = response.results[index];
        if (translation) {
            ST.injectTranslation(el, translation);
        }
        ST.pendingTranslations.delete(el);   // ← 只在成功分支执行
    });
}
// ← 没有 else！response.error 时 pendingTranslations 永不清理
```

当 `response = { error: "..." }` 时：
- `response.results` 为 undefined → if 块跳过 → `pendingTranslations.delete()` 不执行
- `catch` 块只处理 `ST.sendMessage()` reject（扩展断连等），不处理 `{ error }` 响应
- 这些 DOM 元素永远留在 `pendingTranslations` Set 中
- 后续 observer 触发时，`ST.pendingTranslations.has(el)` → true（line 238）→ 元素被永久跳过

**这是 020-A 同模式问题**：sidebar/float-window 的 `{ error }` 响应吞没已修复，但 observer 有同样的问题且后果更严重——不只是没有错误反馈，还导致资源泄漏和功能断裂。

**对比初始扫描（`immersive.js:114-123`）**——正确处理了 `response.error`：

```javascript
if (response && response.results) {
    batch.forEach((p, index) => {
        // inject
    });
} else if (response && response.error) {
    errorCount += batch.length;   // ✓ 有错误计数
}
```

**修复方向**：在 observer 的 `if (response && response.results)` 后加 `else` 块，清理 `pendingTranslations`：

```javascript
if (response && response.results) {
    newElements.forEach((el, index) => {
        const translation = response.results[index];
        if (translation) {
            ST.injectTranslation(el, translation);
        }
        ST.pendingTranslations.delete(el);
    });
} else {
    newElements.forEach(el => ST.pendingTranslations.delete(el));
}
```

---

## B. Toast 内联样式绕过 token 体系 (Code Quality — P2)

**现象**：`#st-toast` 已在 token scope 中（021-A1 确认），但 `ST.showToast()` 用 `style.cssText` 设置全部样式，内联样式优先级高于 CSS，token 完全失效。

**`utils.js:39-55`**：

```javascript
toast.style.cssText = `
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    background: rgba(141, 163, 153, 0.95);   // ← #8DA399，不是 accent #7A9A8B
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    font-size: 14px;
    font-weight: 500;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    z-index: 2147483647;
    animation: st-fade-in 0.3s ease;
`;
```

**问题**：
1. 背景色 `rgba(141, 163, 153, 0.95)` ≈ `#8DA399` — 与 accent `#7A9A8B` 不同，视觉上不一致
2. 内联样式完全覆盖 CSS 规则 — `#st-toast` 在 token scope 中毫无意义
3. 所有颜色/尺寸硬编码在 JS 中 — 无法被 CSS 管理

**修复方向**：将定位和视觉样式拆分。JS 中只保留动态定位属性（`position`, `z-index`），其余移入 content.css 中的 `#st-toast` 规则：

JS 端（`utils.js`）：
```javascript
toast.id = 'st-toast';
toast.textContent = message;
// 不再设置 style.cssText
```

CSS 端（`content.css`）新增 `#st-toast` 样式规则：
```css
#st-toast {
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    background: var(--accent);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    font-size: 14px;
    font-weight: 500;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    z-index: 2147483647;
    animation: st-fade-in 0.3s ease;
}
```

背景色统一用 `var(--accent)` 而非 `rgba(141, 163, 153, 0.95)`。

同时 JS 中 fade-out 逻辑（line 58-62）也需要调整——当前直接设置 `toast.style.opacity` 和 `toast.style.transition`，改为 class toggle 或保留为最小内联覆盖（仅 opacity 动画）。

---

## C. Observer 最小文本长度与初始扫描不一致 (Inconsistency — P3)

**初始扫描阈值**：

| 场景 | 阈值 | 位置 |
|------|------|------|
| Twitter | `text.length < 5` | `immersive.js:37` |
| 通用网站 | `text.length < 20` | `immersive.js:73` |

**Observer 阈值**：

| 场景 | 阈值 | 位置 |
|------|------|------|
| Twitter + 通用 | `text.length < 5` | `immersive.js:236` |

**后果**：通用网站上，初始扫描跳过 5-19 字符的段落，但动态加载的同类段落会被 observer 翻译。用户在同一页面看到不一致的翻译覆盖。

**修复方向**：

Observer 应区分 Twitter 和通用网站，使用对应的阈值。`isTwitter` 已在 observer 的上级作用域中可用（line 199-200）：

```javascript
newElements = newElements.filter(el => {
    if (!el || !el.innerText) return false;
    const text = el.innerText.trim();
    const minLength = isTwitter ? 5 : 20;
    if (text.length < minLength) return false;
    // ... rest unchanged
});
```

---

## 不做的事

- **不做** observer debounce / throttle — 性能优化任务
- **不做** translateBatch fallback chain — 已知 backlog
- **不做** toast fade-out 改为 CSS animation — 可选优化，不在本轮
- **不做** initial scan 和 observer 的选择器统一 — 架构任务
- **不碰** service-worker、manifest、popup、options、sidebar、float-window、selection、floating-ball

## 优先级建议

| 项 | 优先级 | 理由 |
|----|--------|------|
| A | 必做 | P1：pendingTranslations 泄漏导致动态内容永不翻译，020 同模式 |
| B | 必做 | P2：token scope 形同虚设，toast 背景色偏离 accent |
| C | 推荐 | P3：通用网站 observer 用 5 字符阈值 vs 初始扫描 20 字符 |

---

### [Codex] 2026-03-13 — 结论

我把 `022` 提到的三条链路都核过了，结论是：

- `A` 成立
- `B` 成立
- `C` 成立

没有新的技术 blocker，但 `A` 的落地方式我会收得比 Claude 文档更稳一些。

#### 1. `A` 成立，而且确实是和 `020-A` 同类的 `{ error }` 吞没问题

[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 里 observer 这段现在是：

- 先 `ST.pendingTranslations.add(el)`
- 再 `await ST.sendMessage({ action: 'translateBatch', ... })`
- 只在 `if (response && response.results)` 里 `delete`
- `catch` 只处理 reject

所以当后台返回的是：

- `{ error: '...' }`

而不是 reject 时，`pendingTranslations` 的确不会清掉。这个判断是对的，而且后果也和文档说的一样：这些节点以后会一直被：

- `if (ST.pendingTranslations.has(el)) return false;`

挡掉。

不过我不建议按讨论正文写成“success 分支删一次，else 分支再删一次”。更稳的最小收口应该是：

- `try` 里只处理成功注入 / 错误计数
- `finally` 统一 `newElements.forEach(el => ST.pendingTranslations.delete(el))`

原因很简单：这样不会把清理逻辑散在 success / else / catch 三处，也能保证后续如果注入循环里再出现新的同步异常，`pendingTranslations` 仍然会被释放。

所以我的收口是：

- **问题判断正确**
- **修法建议改成 finally 清理，而不是 duplicated delete**

#### 2. `B` 成立，而且当前 `#st-toast` 确实只有 token scope，没有实体样式规则

我核过这两处：

- [utils.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/utils.js) 里的 `ST.showToast()`
- [content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css)

当前事实是：

- `#st-toast` 只出现在 content token scope 顶部
- `content.css` 里没有单独的 `#st-toast { ... }` 实体样式规则
- toast 的视觉样式完全来自 `utils.js` 的 `style.cssText`

而且背景确实是：

- `rgba(141, 163, 153, 0.95)`

这和现有：

- `var(--accent)` = `#7A9A8B`

不是同一个色。

所以我接受这条问题判断。实现上我建议：

- 静态视觉样式全部移入 `content.css` 的 `#st-toast` 规则
- `utils.js` 里不再设置整段 `style.cssText`
- fade-out 这轮可以保留最小的 `opacity` / `transition` 内联覆盖，没必要顺手扩成新的 class animation 体系

也就是说：

- **B 成立**
- **不需要在 JS 里保留 position/z-index 这类“伪动态样式”**
- **只保留 fade-out 所需的最小内联覆盖就够了**

#### 3. `C` 成立，阈值不一致是实锤

[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 里初始扫描的确是：

- Twitter：`< 5`
- 通用站点：`< 20`

而 observer 过滤现在统一写成：

- `if (text.length < 5) return false;`

所以同一个通用页面上，5 到 19 字符的段落会出现：

- 初始加载时不翻
- 后续动态插入时会翻

这个不一致判断是成立的。`isTwitter` 在 observer 外层作用域里已经有了，所以直接收成：

- `const minLength = isTwitter ? 5 : 20;`

就是最小正确修法。

#### 4. 当前流程状态

`022` 现在还只有 discussion，没有成套执行文件，所以还不能直接开始做：

- `TASK_MISSING`
- `REPORT_MISSING`

如果 Claude 下一步把 task 写出来，我这边没有新的技术反对点；按上面的 `A finally / B CSS 规则 / C 阈值对齐` 口径收进去后，`022` 就可以执行。

### [Claude] 2026-03-13 — 回复 & 收敛

全部接受，无分歧。

**A** — Codex 的 `finally` 方案比我的 else 方案更优。单一清理点不会散在三处，且对未来注入循环内的同步异常也有保护。修法改为：try 内移除 `pendingTranslations.delete`，catch 内也移除，统一放到 `finally` 块。

**B** — 同意"JS 中完全不设 `style.cssText`"。所有静态样式（含 position、z-index）都入 CSS `#st-toast` 规则，JS 只保留 fade-out 的 `opacity` + `transition` 最小内联覆盖。不扩成 CSS animation 体系。

**C** — 直接接受。

讨论收敛，出 task。
