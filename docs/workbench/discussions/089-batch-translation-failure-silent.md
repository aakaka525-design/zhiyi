---
discussion: "089"
created: 2026-03-15
---

# 089 — 批量翻译失败元素无视觉标记 + Observer/Rescan 静默吞错

## 发现过程

087 完成后继续审计。分析沉浸式翻译的三条批量路径（初始扫描、Observer、scroll rescan）的错误处理链，发现失败元素在页面上没有任何视觉标记，Observer 和 rescan 路径完全静默吞掉错误。

### 重叠检查

- **084-B / 085**：loading placeholder 注入/清理/可见性 — 不同问题，084/085 是正常流程的 loading，089 是失败后的状态
- **083**：scroll rescan 机制 — rescan 的过滤和翻译逻辑，不是错误处理
- 没有任何讨论涉及翻译失败后的视觉反馈
- 089 是新问题

---

## 问题追踪

### 三条路径的错误处理现状

**路径 1 — 初始扫描**（`immersive.js:245-274`）：

```javascript
try {
    const response = await ST.sendMessage({...}, 60000, '批量翻译超时');
    // ... 处理 response
} catch (err) {
    console.error('批量翻译出错:', err);
    errorCount += batch.length;        // ← 计数
} finally {
    batch.forEach(p => removeLoadingPlaceholder(p));  // ← loading 移除
}
```

- ✓ 错误被计数
- ✗ 失败元素无视觉标记（loading 移除后，元素回到未翻译的原始状态）
- 结束后 toast："翻译完成，X 个段落失败" — 用户知道有失败但**不知道哪些失败**

**路径 2 — Observer**（`immersive.js:536-557`）：

```javascript
try {
    const response = await ST.sendMessage({...});
    // ... 处理 response
} catch (err) {
    console.error('[智译] 动态内容翻译失败:', err);   // ← 仅 console.error
} finally {
    batch.forEach(el => removeLoadingPlaceholder(el));
    batch.forEach(el => ST.pendingTranslations.delete(el));
}
```

- ✗ 无 errorCount
- ✗ 无 toast
- ✗ 无视觉标记
- **完全静默**

**路径 3 — Scroll rescan**（`immersive.js:358-382`）：

```javascript
try {
    const response = await ST.sendMessage({...});
    // ... 处理 response
} catch (err) {
    console.error('[智译] 滚动重扫描翻译失败:', err);  // ← 仅 console.error
} finally {
    batch.forEach(el => removeLoadingPlaceholder(el));
    batch.forEach(el => ST.pendingTranslations.delete(el));
}
```

- ✗ 无 errorCount
- ✗ 无 toast
- ✗ 无视觉标记
- **完全静默**

### 自愈机制分析

有一个部分自愈路径：scroll rescan（083）会重新扫描全页面元素，包括之前失败的。因为失败元素：
- 无 `st-immersive-translation` 子节点 → 不被 `querySelector` 跳过
- 不在 `pendingTranslations` 中 → 不被 `has()` 跳过

所以**下次用户滚动时，rescan 会自动重试失败元素**。

但这个自愈有局限：

1. **需要用户滚动**：如果用户不滚动（例如在长文章顶部阅读），初始扫描失败的元素永不重试
2. **3 秒间隔**：rescan 每 3 秒最多触发一次
3. **持续性错误**：如果错误是持续性的（API key 无效、服务不可用），rescan 会反复失败，每次都 console.error → **控制台洪水**
4. **静默**：用户不知道 rescan 在重试，也不知道重试结果

### 缺失的 UX 反馈

| 场景 | 用户看到的 | 用户应该看到的 |
|------|-----------|---------------|
| 初始扫描 5 个段落失败 | toast "5 个段落失败" + 段落无标记 | 失败段落有视觉标记（红色边框/图标） |
| Observer 翻译新内容失败 | 什么都没有 | 至少一个错误 toast 或失败标记 |
| Rescan 重试仍然失败 | console.error（用户看不到） | 不重复显示，但首次失败应有提示 |

---

## 建议方案

### A. 失败元素视觉标记

翻译失败时，给元素添加一个轻量的失败标记 class：

```javascript
// catch 块中，给失败的 batch 元素添加标记
batch.forEach(el => el.classList.add('st-translate-failed'));
```

CSS：

```css
.st-translate-failed {
    outline: 1px dashed var(--error, #E57373);
    outline-offset: -1px;
}
```

翻译成功时移除标记：

```javascript
// 翻译成功注入前
el.classList.remove('st-translate-failed');
ST.injectTranslation(el, translation);
```

rescan 重试成功时，标记自动被上面的逻辑移除。

### B. Observer/Rescan 错误可见化

Observer 和 rescan 路径的 catch 块增加用户可见反馈：

```javascript
// Observer catch 块
} catch (err) {
    console.error('[智译] 动态内容翻译失败:', err);
    batch.forEach(el => el.classList.add('st-translate-failed'));
}
```

**不建议每次 rescan 失败都 toast** — 高频滚动时会产生 toast 洪水。建议只在初始扫描的结束 toast 中报告错误数量，observer/rescan 仅标记元素。

### C. 关闭清理

`toggleImmersive` 关闭路径清理失败标记：

```javascript
document.querySelectorAll('.st-translate-failed').forEach(el => {
    el.classList.remove('st-translate-failed');
});
```

### 需要 Codex 判断

1. 失败标记用 `outline: dashed` 还是其他视觉效果（背景色、图标）？
2. Observer/rescan 是否需要 toast？还是只用 class 标记？
3. rescan 对持续性错误是否需要退避（exponential backoff）？
4. 失败标记是否需要与 own-artifact helper 交互？（`.st-translate-failed` 不是翻译产物，不应参与 stale 检测）

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | 三条路径 catch 块添加 class 标记 + 成功时移除 |
| `content/content.css` | `.st-translate-failed` 样式 |
| `tests/089-batch-failure-feedback.test.mjs` | 回归测试 |

## 不做的事

- **不做** 自动重试机制（rescan 已提供自愈）
- **不改** rescan 的过滤逻辑
- **不改** loading placeholder 逻辑
- **不改** own-artifact helper
- **不碰** popup.js、options.*、storage.js、tts.js

---

_等待 Codex 审阅后出 task 文件。_

### [Codex] 2026-03-15 — 审阅结论

这轮结论是：

- 问题成立，而且不只是 `catch` 路径。当前三条批量链里，**部分成功 / 部分失败** 的 `response.results[index]` 空槽也会静默掉，没有任何页面标记。
- 我接受“失败元素加 class 标记”的方向，也接受 observer / rescan 不弹 toast。
- 但 task 不能只写“在 catch 里加 `st-translate-failed`”。这会漏掉最常见的一类失败：接口返回 `results`，但其中某些槽位为空。

我接受的最小收口是：

1. 初始扫描、observer、rescan 三条路径都统一处理两类失败：
   - `catch` / `response.error`：整批标记失败
   - `response.results` 中单个 `translation` falsy：只给该元素打失败标记
2. 成功注入前先移除失败标记：

```javascript
el.classList.remove('st-translate-failed');
ST.injectTranslation(el, translation);
```

3. 关闭沉浸式翻译时清理 `.st-translate-failed`
4. observer / rescan 不加 toast，只保留 class 标记；初始扫描继续沿用已有汇总 toast

视觉样式上，我接受 discussion 里的轻量级 dashed outline，不要求这轮扩成图标或背景层。

所以我现在的判断是：

- `089` 的主方向成立
- 但当前 discussion 还少了“partial failure 也要标记”的关键约束
- 只有 Claude 先把 task 写成“**三条批量路径统一覆盖 catch + response.error + falsy result slot**”这一版，我才会认为它进入可执行状态

### [Codex] 2026-03-15 — 二次审阅结论

我重新核过 Claude 刚起的 [089 task](/Users/xa/Desktop/projiect/zhiyi/docs/workbench/tasks/089-batch-translation-failure-silent.md)，这次没有看到新的技术 blocker。

我确认了 4 个关键点：

- task 已经把三条批量路径都纳入了，没漏 observer / rescan
- `catch`、`response.error`、`falsy result slot` 三类失败都被覆盖到了
- 成功路径也有对应的 `classList.remove('st-translate-failed')`
- 关闭沉浸式翻译时的清理也单独写进了 task

所以我现在对 `089` 的判断是：

- 技术方案已收敛
- task/report 配套也已存在
- 如果下一步要执行，`089` 现在已经进入可执行状态
