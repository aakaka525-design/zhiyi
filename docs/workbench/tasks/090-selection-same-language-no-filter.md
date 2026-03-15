---
task: "090"
status: done
priority: P2
created: 2026-03-15
scope: "showBubble 同语言守卫（直接 return，不弹气泡）"
---

# 090 — 划词翻译同语言过滤

## 范围

`showBubble()` 顶部添加同语言守卫。源语言 === 目标语言时直接 `return`，不创建气泡 DOM、不发翻译请求、不写历史。

---

## 改动

**文件：`content/modules/selection.js` — `showBubble` 函数**

在函数顶部、创建 bubble DOM **之前**添加守卫：

```javascript
ST.showBubble = async function (text) {
    // ← 新增：同语言守卫（在创建 DOM 之前）
    const sourceLang = ST.detectLanguage(text);
    const targetLang = ST.state.settings?.targetLang || 'zh';
    if (sourceLang === targetLang) return;

    if (ST.ui.bubble) ST.removeBubble();

    ST.ui.bubble = document.createElement('div');
    // ... 现有逻辑 ...
```

同时移除函数内部原有的 `sourceLang` / `targetLang` 声明（当前在 line 166-167），改为使用函数顶部的声明。

改后函数内部的翻译请求直接使用顶部已声明的 `sourceLang` / `targetLang`：

```javascript
    try {
        const response = await ST.sendMessage({
            action: 'translate',
            text: text,
            from: sourceLang,   // ← 使用顶部声明
            to: targetLang      // ← 使用顶部声明
        }, 30000, '翻译请求超时');
```

---

## 约束

1. **守卫放在 `showBubble()` 内部**：一次性覆盖三个入口（`handleMouseUp` / `showIcon` / `handleDoubleClick`）+ 后续新入口
2. **守卫在 DOM 创建之前**：同语言时不创建 bubble 元素、不 append 到 body
3. **同语言时不弹气泡、不发请求、不写历史**：直接 `return`
4. **不做** 请求取消 / AbortController（留后续）
5. **不改** `detectLanguage` 算法（088 已修复）
6. **不改** 沉浸式翻译的过滤逻辑
7. **不碰** immersive.js、popup.js、options.*、storage.js、tts.js

---

## 测试

**文件：`tests/090-selection-same-language.test.mjs`**

### 静态断言

1. **`showBubble` 包含同语言守卫**：断言源码在 `createElement` 之前包含 `sourceLang === targetLang` 检查

### Runtime harness

2. **同语言时 `showBubble` 不创建气泡**：mock `detectLanguage` 返回 `'zh'` + settings `targetLang = 'zh'` → 调用 `showBubble('中文文本')` → 断言 `ST.ui.bubble` 为 null
3. **不同语言时 `showBubble` 正常创建气泡**：mock `detectLanguage` 返回 `'en'` + settings `targetLang = 'zh'` → 调用 `showBubble('English text')` → 断言 `ST.ui.bubble` 不为 null

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `content/modules/selection.js` | `showBubble` 顶部同语言守卫 + 移除内部重复声明 |
| `tests/090-selection-same-language.test.mjs` | 静态 + runtime 测试 |
