---
task: "088"
status: done
priority: P2
created: 2026-03-15
scope: "detectLanguage 三修：codePointAt + CJK 范围扩展 + 日语 20% 门槛"
---

# 088 — `detectLanguage` 语言检测算法修复

## 范围

修复 `utils.js` 的 `detectLanguage` 函数三个结构性缺陷。不改消费方逻辑。

---

## 改动

**文件：`content/modules/utils.js` — `detectLanguage` 函数**

### A. `charCodeAt` → `codePointAt`

```javascript
// 改前（utils.js:74）
const code = char.charCodeAt(0);

// 改后
const code = char.codePointAt(0);
```

### B. CJK 范围扩展

```javascript
// 改前（utils.js:82-84）
if (code >= 0x4E00 && code <= 0x9FFF) {
    cjkCount++;
}

// 改后
if ((code >= 0x4E00 && code <= 0x9FFF) ||   // CJK Unified Ideographs
    (code >= 0x3400 && code <= 0x4DBF) ||    // CJK Extension A
    (code >= 0xF900 && code <= 0xFAFF) ||    // CJK Compatibility Ideographs
    (code >= 0x20000 && code <= 0x2A6DF)) {  // CJK Extension B
    cjkCount++;
}
```

不加中文标点（`0x3000-0x303F`）和全角 ASCII（`0xFF01-0xFF5E`）到 `cjkCount`。

### C. 日语检测加 20% 比例门槛

```javascript
// 改前（utils.js:106-108）
if (hiraganaCount > 0 || katakanaCount > 0) {
    return 'ja';
}

// 改后
const kanaCount = hiraganaCount + katakanaCount;
if (kanaCount / totalCount > 0.2) {
    return 'ja';
}
```

门槛 `> 0.2`（严格大于，Codex 二次审阅确认边界值 0.2 刚好使 `"Python basics コード"` 误判）。

---

## 约束

1. **不改** `detectLanguage` 的消费方（immersive.js 的过滤逻辑不变）
2. **不加** 新的语言支持（阿拉伯语、泰语、俄语等留后续）
3. **不改** 中文（30%）和韩语（30%）的检测门槛
4. **不碰** immersive.js、content.css、popup.js、options.*

---

## 测试

**文件：`tests/088-detectlanguage.test.mjs`**

### 静态断言

1. 源码使用 `codePointAt` 而非 `charCodeAt`
2. 源码包含 CJK Extension A 范围 `0x3400`
3. 源码包含 CJK Compatibility 范围 `0xF900`
4. 源码包含 CJK Extension B 范围 `0x20000`

### Runtime harness

5. **混合中日文本不误判**：`"动漫の世界很精彩"` → 不返回 `'ja'`（假名占比 < 20%，CJK 占比 > 30% → `'zh'`）
6. **混合英日文本不轻易误判**：`"Python basics コード"` → 不返回 `'ja'`（假名占比 < 20% → `'en'`）
7. **真实日语短语仍判 `'ja'`**：`"これは日本語のテストです"` → 返回 `'ja'`（假名占比 > 20%）
8. **CJK Extension A 字符被计入**：构造含 Extension A 字符（U+3400 区段）的文本 → `detectLanguage` 返回 `'zh'`
9. **CJK Extension B 字符被计入**：构造含 Extension B 字符（U+20000 区段，使用 `String.fromCodePoint`）的文本 → `detectLanguage` 返回 `'zh'`
10. **纯英文仍返回 `'en'`**：`"Hello world"` → `'en'`
11. **纯中文仍返回 `'zh'`**：`"你好世界"` → `'zh'`

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `content/modules/utils.js` | `detectLanguage` 三修 |
| `tests/088-detectlanguage.test.mjs` | 静态 + runtime 两层测试 |
