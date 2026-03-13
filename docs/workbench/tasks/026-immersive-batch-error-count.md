---
status: done
priority: P2
created: 2026-03-13
discussion: 025-history-gap-and-batch-error
---

# 026 — 沉浸式批量翻译部分失败计数修正

## 背景

025 讨论确认：`openai.js:151` 和 `gemini.js:184` 的 `translateBatch()` 用 `new Array(texts.length).fill('')` 初始化，模型漏回编号时对应槽位保持空字符串。`immersive.js:114-120` 对这些空槽位静默跳过，不计入 `errorCount`，导致 toast 可能显示"翻译完成！共 N 个段落"但实际有若干段落未翻译。

---

## 任务 A：falsy 槽位计入 errorCount

**文件**：`content/modules/immersive.js:114-120`

**当前**：

```javascript
if (response && response.results) {
    batch.forEach((p, index) => {
        const translation = response.results[index];
        if (translation) {
            ST.injectTranslation(p, translation);
        }
    });
}
```

**修复**：

```javascript
if (response && response.results) {
    batch.forEach((p, index) => {
        const translation = response.results[index];
        if (translation) {
            ST.injectTranslation(p, translation);
        } else {
            errorCount++;
        }
    });
}
```

这样 falsy 值（`''`、`undefined`、`null`）都会被计入失败。

---

## 任务 B：确认 toast 正确反映失败数

**文件**：`content/modules/immersive.js:139-143`

**当前**：

```javascript
if (errorCount > 0) {
    ST.showToast(`翻译完成，${errorCount} 个段落失败`);
} else {
    ST.showToast(`翻译完成！共 ${translatedCount} 个段落`);
}
```

当前 toast 逻辑本身是正确的——只要 `errorCount` 准确，toast 就会正确显示"X 个段落失败"。任务 A 修复 errorCount 后，此处无需额外修改。

**但需验证**：修复后 toast 文案是否清晰。例如 batch 10 个，3 个 falsy，toast 应显示"翻译完成，3 个段落失败"。确认逻辑无误即可。

---

## 不改的事

- **不改进度条语义**：`translatedCount += batch.length` 保持表示 processed count。进度条 = 处理进度，toast = 成功/失败报告。两个语义独立。
- 不碰 `openai.js` / `gemini.js` 的 batch 返回格式（空字符串占位是正确的容错设计）
- 不碰 sidebar / float-window / popup
- 不碰 CSS / TTS

---

## 任务 C：补测试

验证部分失败场景的 errorCount 统计。

测试用例建议：

1. **全部成功**：`response.results = ['翻译A', '翻译B', '翻译C']`，batch 3 个 → errorCount 应为 0
2. **部分失败**：`response.results = ['翻译A', '', '翻译C']`，batch 3 个 → errorCount 应为 1
3. **全部失败**：`response.results = ['', '', '']`，batch 3 个 → errorCount 应为 3
4. **results 短于 batch**：`response.results = ['翻译A']`，batch 3 个 → errorCount 应为 2

测试不需要真实 DOM；可以 mock `ST.injectTranslation` 和 `ST.sendMessage`，只验证 errorCount 计算逻辑。

---

## 验收标准

- [x] `immersive.js` 中 falsy 槽位（`''`、`undefined`）计入 `errorCount`
- [x] toast 正确反映实际失败段落数
- [x] `translatedCount` 保持 processed count 语义不变
- [x] 测试覆盖全部成功、部分失败、全部失败、results 短于 batch 四种场景
