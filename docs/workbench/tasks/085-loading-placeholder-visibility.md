---
task: "085"
status: done
priority: P2
created: 2026-03-15
scope: "loading placeholder 可见性修复（CSS block 化 + 初始扫描全量预注入）"
---

# 085 — 沉浸式翻译加载动画不可见

## 范围

修复 084-B loading placeholder 的三个视觉缺陷：CSS block 化 + 增大尺寸 + 初始扫描全量预注入。

不改 loading helper 函数逻辑，不改 Observer/rescan 的注入方式。

## 执行结果

- [x] CSS 已完成：`.st-immersive-loading` 现在使用 block 级 `flex` 展示，dot 尺寸和对比度已提高。
- [x] JS 已完成：初始扫描在 batch 循环前会为所有待翻译元素一次性预注入 loading placeholder。
- [x] batch 内既有的 `injectLoadingPlaceholder(...)` 调用保留，Observer/rescan 路径不变。
- [x] 新增专项测试 `tests/085-loading-visibility.test.mjs`，覆盖静态断言和 runtime harness。
- [x] fresh verification 已通过：
  - `node --test tests/085-loading-visibility.test.mjs`
  - `node --test tests/*.test.mjs` (`297/297`)
  - `node --check content/modules/immersive.js`
  - `git diff --check`

---

## 改动

### 1. CSS — block 级别显示 + 增大尺寸

**文件：`content/content.css`**

改前（当前 `content.css:272-295`）：

```css
.st-immersive-loading {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: 8px;
    vertical-align: middle;
}

.st-immersive-loading span {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--accent);
    opacity: 0.6;
    animation: st-bounce 1.2s infinite ease-in-out;
}
```

改后：

```css
.st-immersive-loading {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 4px 0 0 0;
    padding: 2px 0;
}

.st-immersive-loading span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
    opacity: 0.7;
    animation: st-bounce 1.2s infinite ease-in-out;
}
```

变更明细：

| 属性 | 改前 | 改后 | 原因 |
|------|------|------|------|
| `display` | `inline-flex` | `flex` | block 级别，独占一行 |
| `gap` | `4px` | `6px` | 增大间距 |
| `margin` | `margin-left: 8px` | `margin: 4px 0 0 0` | 顶部间距取代左侧间距 |
| `padding` | 无 | `2px 0` | 上下留白 |
| `vertical-align` | `middle` | 移除 | inline 语义，不再需要 |
| dot `width/height` | `5px` | `6px` | 增大尺寸 |
| dot `opacity` | `0.6` | `0.7` | 提高对比度 |

`:nth-child(2)` 和 `:nth-child(3)` 的 `animation-delay` 规则不变。

### 2. JS — 初始扫描全量预注入

**文件：`content/modules/immersive.js` — `toggleImmersive` 函数**

在 batch 循环**开始前**新增一行：

```javascript
ST.showToast(`找到 ${paragraphs.length} 个段落，开始翻译...`);

// ↓ 新增：全量预注入 loading placeholder
paragraphs.forEach(p => injectLoadingPlaceholder(p));

// 分批翻译
let translatedCount = 0;
let errorCount = 0;

for (let i = 0; i < paragraphs.length; i += IMMERSIVE_BATCH_SIZE) {
    // ...（batch 内的 injectLoadingPlaceholder 保留，去重检查使其变为 no-op）
```

**不影响 `innerText` 取值**：loading placeholder 是空 `<span>` 元素，无文本内容。`batch.map(p => p.innerText.trim())` 不受影响。

**batch 内的 `injectLoadingPlaceholder` 保留不删**：内部有 `el.querySelector('.st-immersive-loading')` 去重检查，变为 no-op。删掉反而破坏 Observer/rescan 路径的对称性。

**Observer 和 rescan 不改**：增量翻译场景，per-batch loading 足够。

---

## 约束

1. **只改 CSS 样式 + 一行 JS**
2. **不改** `injectLoadingPlaceholder` / `removeLoadingPlaceholder` 函数签名或逻辑
3. **不改** Observer / rescan 的 loading 注入方式
4. **不改** `finally` 中的 `removeLoadingPlaceholder` 调用
5. **不改** `toggleImmersive` 关闭路径（已含 `.st-immersive-loading`）
6. **不改** own-artifact helper（`hasOwnTranslationArtifacts` 等）
7. **不改** 084-A 的 inline path 修复
8. **不碰** popup.js、sidebar.js、float-window.js、tts.js、options.*、storage.js

---

## 测试

**文件：`tests/085-loading-visibility.test.mjs`**

两层测试结构：

### 第一层 — 静态断言（source code assertions）

1. **CSS `display: flex` 而非 `inline-flex`**：读取 `content.css`，断言 `.st-immersive-loading` 规则中包含 `display:\s*flex`，不包含 `inline-flex`。
2. **CSS 无 `vertical-align`**：断言 `.st-immersive-loading` 规则块中不出现 `vertical-align`。
3. **CSS dot 尺寸 ≥ 6px**：断言 `.st-immersive-loading span` 规则中 `width` 和 `height` 均为 `6px`。
4. **JS 全量预注入存在**：读取 `immersive.js`，断言在 batch for 循环**之前**存在 `paragraphs.forEach(p => injectLoadingPlaceholder(p))` 或等效调用。
5. **batch 内的 `injectLoadingPlaceholder` 调用仍保留**：断言 `batch.forEach` 调用 `injectLoadingPlaceholder` 的出现次数仍为 3。

### 第二层 — Runtime harness（行为验证）

复用 084 的 `loadImmersiveHarness` + `createNode` 测试基础设施模式。

6. **全量预注入 — 所有元素在翻译前就有 loading**：构造多个段落 → 调用 `toggleImmersive` 并 mock `sendMessage` 使其在第一个 batch await 时暂停 → 断言所有段落（不只前 10 个）都已有 `.st-immersive-loading` 子节点。
7. **逐批移除 — 第一个 batch 完成后其 loading 消失，后续元素 loading 仍在**：让第一个 batch 的 `sendMessage` resolve → 断言前 10 个元素的 loading 已移除，第 11+ 个元素的 loading 仍在。
8. **loading 不污染 `innerText`**：构造一个已有 loading placeholder 的元素 → 断言 `el.innerText.trim()` 不包含 loading 产物（空 span 不产生文本）。
9. **关闭清理**：构造包含 `.st-immersive-loading` 节点的 DOM → 调用 `toggleImmersive()` 关闭 → 断言 loading 节点已移除。

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `content/content.css` | `.st-immersive-loading` 样式调整 |
| `content/modules/immersive.js` | `toggleImmersive` batch 循环前新增一行全量预注入 |
| `tests/085-loading-visibility.test.mjs` | 新增静态 + runtime harness 两层测试 |

## 旧测试基线同步

如果 `tests/084-immersive-ux.test.mjs` 中有断言检查 `inline-flex` 或其他被 085 改动的 CSS 值，需同步更新。`084` 的 test #5（静态断言）当前未检查 `inline-flex`，但如果有冲突需一并修正。

全量 `node --test tests/*.test.mjs` 必须通过。

## 不做的事

- **不改** loading helper 函数逻辑
- **不改** Observer / rescan 的 loading 注入方式
- **不改** 084-A inline path 修复
- **不做** C（替换/对照模式）
