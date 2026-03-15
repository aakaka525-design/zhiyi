---
task: "089"
status: done
priority: P2
created: 2026-03-15
scope: "三条批量路径统一覆盖 catch + response.error + falsy result slot 失败标记"
---

# 089 — 批量翻译失败元素视觉标记

## 范围

三条批量翻译路径（初始扫描、Observer、scroll rescan）统一处理两类失败，给失败元素添加 `st-translate-failed` class 标记。

---

## 改动

### 1. 失败标记逻辑

**文件：`content/modules/immersive.js`**

三条路径统一处理两类失败：

**类型 1 — 整批失败（`catch` / `response.error`）**：

```javascript
// catch 块中
batch.forEach(el => el.classList.add('st-translate-failed'));
```

```javascript
// response.error 分支中
if (response && response.error) {
    errorCount += batch.length;  // 初始扫描已有
    batch.forEach(el => el.classList.add('st-translate-failed'));  // ← 新增
}
```

**类型 2 — 部分失败（`results[index]` falsy）**：

```javascript
batch.forEach((el, index) => {
    const translation = response.results[index];
    if (translation) {
        el.classList.remove('st-translate-failed');  // ← 新增：成功时移除标记
        const sourceText = el.innerText.trim();
        ST.injectTranslation(el, translation);
        translatedSources.set(el, hashText(sourceText));
    } else {
        errorCount++;  // 初始扫描已有
        el.classList.add('st-translate-failed');  // ← 新增：单元素标记
    }
});
```

### 2. 三条路径具体改动

**路径 1 — 初始扫描**（`toggleImmersive` 批量循环）：

- `response.results` 循环：falsy slot 加 `st-translate-failed`，truthy slot 移除 `st-translate-failed`
- `response.error` 分支：整批加 `st-translate-failed`
- `catch` 块：整批加 `st-translate-failed`

**路径 2 — Observer**（`startMutationObserver` 批量循环）：

- 同路径 1 模式。Observer 当前无 `errorCount`，不新增 — 只加 class 标记
- `catch` 块：整批加 `st-translate-failed`
- `response.results` 循环中 falsy slot：加 `st-translate-failed`

**路径 3 — Scroll rescan**（`rescanUntranslatedElements` 批量循环）：

- 同路径 2 模式

### 3. 关闭清理

**文件：`content/modules/immersive.js` — `toggleImmersive` 关闭路径**

在现有的 `querySelectorAll(...).forEach(el => el.remove())` 之后添加：

```javascript
document.querySelectorAll('.st-translate-failed').forEach(el => {
    el.classList.remove('st-translate-failed');
});
```

### 4. CSS

**文件：`content/content.css`**

```css
.st-translate-failed {
    outline: 1px dashed var(--error, #E57373);
    outline-offset: -1px;
}
```

轻量级虚线轮廓，不影响布局。使用 `--error` CSS 变量（已定义在 `content.css:29`），降级到 `#E57373`。

---

## 约束

1. **observer / rescan 不加 toast**：只用 class 标记
2. **初始扫描保留现有汇总 toast**（"翻译完成，X 个段落失败"）
3. **不做** 自动重试机制（scroll rescan 已提供自愈）
4. **`st-translate-failed` 不参与 own-artifact helper**：不影响 `hasOwnTranslationArtifacts` / `getOwnCleanSourceText` / `removeOwnTranslationArtifacts` / stale hash 检测
5. **不改** rescan 过滤逻辑
6. **不改** loading placeholder 逻辑
7. **不碰** popup.js、options.*、storage.js、tts.js

---

## 测试

**文件：`tests/089-batch-failure-feedback.test.mjs`**

### 静态断言

1. CSS 存在 `.st-translate-failed` 规则
2. JS 源码中三条路径都包含 `st-translate-failed`
3. `toggleImmersive` 关闭路径包含 `st-translate-failed` 清理

### Runtime harness

4. **整批失败（catch）**：mock `sendMessage` 抛出错误 → 断言 batch 中每个元素有 `st-translate-failed` class
5. **部分失败（falsy slot）**：mock `sendMessage` 返回 `{ results: ['译文', null, '译文'] }` → 断言 index 1 的元素有 `st-translate-failed`，index 0/2 没有
6. **成功时移除失败标记**：给元素预设 `st-translate-failed` class → mock 成功翻译 → 断言 class 被移除
7. **关闭清理**：构造含 `st-translate-failed` 的元素 → `toggleImmersive()` 关闭 → 断言 class 已移除

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `content/modules/immersive.js` | 三条路径 catch/error/falsy 标记 + 成功移除 + 关闭清理 |
| `content/content.css` | `.st-translate-failed` 样式 |
| `tests/089-batch-failure-feedback.test.mjs` | 静态 + runtime 两层测试 |
