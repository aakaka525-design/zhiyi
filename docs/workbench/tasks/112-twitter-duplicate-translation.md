---
task: "112"
status: done
priority: P1
created: 2026-03-16
scope: "run-scoped 翻译结果缓存（通用，非 Twitter 专用）"
---

# 112 — 翻译结果缓存：跨节点复用，防止重复翻译

## 范围

新增 run-scoped `translationCache`（`targetLang → sourceText → translation`）。成功拿到翻译结果时即存入缓存。三条路径统一 cache hit/miss 分流。通用机制，所有网站受益。

---

## 改动

**文件：`content/modules/immersive.js`**

### 1. 缓存数据结构

```javascript
// run-scoped 翻译缓存：targetLang → Map<sourceText, translation>
const translationCache = new Map();

function cacheTranslation(targetLang, sourceText, translation) {
    if (!translationCache.has(targetLang)) {
        translationCache.set(targetLang, new Map());
    }
    translationCache.get(targetLang).set(sourceText, translation);
}

function getCachedTranslation(targetLang, sourceText) {
    return translationCache.get(targetLang)?.get(sourceText) || null;
}
```

Key = `targetLang + sourceText`（完整源文本，不用 hash，避免 32 位碰撞风险）。

### 2. 缓存写入 — 翻译成功时即存

在三条路径的翻译成功回调中，**拿到结果就存**，在 `injectTranslation` 之前：

```javascript
batch.forEach((el, index) => {
    const translation = response.results[index];
    if (translation) {
        const sourceText = el.innerText.trim();
        cacheTranslation(targetLang, sourceText, translation);  // ← 成功即存
        clearTranslateFailed(el);
        ST.injectTranslation(el, translation);
        translatedSources.set(el, hashText(sourceText));
    } else {
        markTranslateFailed(el);
    }
});
```

即使 `injectTranslation` 因 `!document.contains(container)` 跳过注入，缓存已保存。

### 3. 三路径统一 cache hit/miss 分流

在三条路径的过滤完成后、batch 循环之前，先对候选元素做 cache hit/miss 分流：

```javascript
// 过滤完成后，分流 cache hit / miss
const cacheHits = [];
const cacheMisses = [];

for (const el of filtered) {
    const text = el.innerText.trim();
    const cached = getCachedTranslation(targetLang, text);
    if (cached) {
        cacheHits.push({ el, text, translation: cached });
    } else {
        cacheMisses.push(el);
    }
}

// 命中：直接注入，不发请求，不显示 loading
for (const { el, text, translation } of cacheHits) {
    ST.injectTranslation(el, translation);
    translatedSources.set(el, hashText(text));
}

// 未命中：继续走 pendingTranslations + loading + translateBatch
for (let i = 0; i < cacheMisses.length; i += IMMERSIVE_BATCH_SIZE) {
    // ... 现有 batch 翻译逻辑 ...
}
```

三条路径（初始扫描、Observer、rescan）统一此分流模式。

### 4. 缓存清理

`toggleImmersive` 关闭时：

```javascript
translationCache.clear();
```

### 5. cache hit 不显示 loading

缓存命中是即时的（无网络请求）。命中的元素直接 `injectTranslation`，不调用 `injectLoadingPlaceholder`。

---

## 约束

1. **缓存 key = `targetLang + sourceText`**（完整文本，不用 hash）
2. **成功即存**：在 `injectTranslation` 之前存缓存，不依赖注入成功
3. **cache hit/miss 分流在过滤之后、batch 循环之前**
4. **通用机制**：不限 Twitter，所有网站受益
5. **关闭时 `clear()`**
6. **不改** `injectTranslation` 的 `document.contains` 检查
7. **不碰** content.css、options.*、popup.js

---

## 测试

**文件：`tests/112-translation-cache.test.mjs`**

### 静态断言

1. JS 包含 `translationCache`
2. JS 包含 `cacheTranslation` 函数
3. JS 包含 `getCachedTranslation` 函数
4. `toggleImmersive` 关闭路径包含 `translationCache.clear()`

### Runtime harness

5. **cache hit 直接注入不发请求**：mock `sendMessage`，先调 `cacheTranslation` 存入缓存 → 模拟 observer 发现同文本新元素 → 断言 `sendMessage` 未被调用，但元素有 `.st-immersive-translation`
6. **cache miss 正常发请求**：不预存缓存 → 断言 `sendMessage` 被调用
7. **关闭时缓存清空**：存入缓存 → `toggleImmersive()` 关闭 → 断言 `getCachedTranslation` 返回 null

全量 `node --test tests/*.test.mjs` 必须通过。

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `content/modules/immersive.js` | 缓存结构 + 三路径写入/分流 + 关闭清理 |
| `tests/112-translation-cache.test.mjs` | 静态 + runtime 测试 |

## 完成情况

- [x] 新增 run-scoped `translationCache`
- [x] 三条路径统一 cache hit/miss 分流
- [x] 成功即存，不依赖注入成功
- [x] 关闭沉浸式翻译时清缓存
- [x] 专项测试与全量回归通过
