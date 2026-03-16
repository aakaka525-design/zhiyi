---
discussion: "107"
created: 2026-03-16
---

# 107 — 死代码/冗余清理

## 发现过程

功能完整性审计发现 4 处死代码/冗余：2 个死设置、1 个死路由、1 个孤立模块。

### 重叠检查

- 没有任何讨论涉及死代码清理
- 107 是新问题

---

## 问题清单

### A. `fontSize` 死设置

**定义**：`storage.js:88` — `fontSize: 14`
**默认值副本**：`content.js:33` — `fontSize: 14`

**使用情况**：`settings.fontSize` 在整个代码库中**从未被读取**。没有 UI 控件。`immersive.js` 的 heading 字号同步使用的是 `getComputedStyle(container).fontSize`，不读设置项。

**处理**：删除。从 `DEFAULT_SETTINGS` 和 `content.js` 的 `mergeDefaults` 中移除。

### B. `debugMode` 空开关

**定义**：`storage.js:91` — `debugMode: false`
**UI**：`options.html` 有 "🐛 调试模式" checkbox，`options.js:105` 读取，`options.js:160` 保存。

**使用情况**：`settings.debugMode` 在整个内容脚本和 background 中**从未被消费**。开关可以切换和保存，但切换后**没有任何行为变化**。注释说"显示识别框和启用详细控制台日志"，但这个功能从未实现。

**处理**：两种选择：
1. **删除**：移除设置 + UI + snapshot + autosave 绑定
2. **保留为 placeholder**：如果计划后续实现调试功能，保留但在 UI 中标注"即将推出"

### C. `updateSettings` 死路由

**定义**：`message-router.js:49-51`：

```javascript
case 'updateSettings':
    await translator.refreshSettings();
    return { success: true };
```

**使用情况**：整个代码库中**没有任何地方发送 `action: 'updateSettings'`**。所有设置更新都通过 `patchSettings` action。

**处理**：删除。

### D. `pdf.js` 孤立模块

**文件**：`src/core/pdf.js` 存在。

**使用情况**：`manifest.json` 未注册此文件。整个代码库无 import/require。完全孤立。

**处理**：删除文件。

---

## 建议方案

### 统一清理

| 项 | 操作 | 文件 |
|----|------|------|
| `fontSize` | 删除设置 | `storage.js`, `content.js` |
| `debugMode` | 删除设置 + UI + 相关代码 | `storage.js`, `content.js`, `options.html`, `options.js`, `options-ui-state.js` |
| `updateSettings` | 删除路由 case | `message-router.js` |
| `pdf.js` | 删除文件 | `src/core/pdf.js` |

### 需要 Codex 判断

1. `debugMode` 删除还是保留为 placeholder？
2. 删除 `debugMode` 后，`options.js` 中 `saveImmediateToggle({ debugMode: ... })` 的绑定和 `collectCurrentSettings` 中的引用也需要一并清理。现有测试中引用 `debugMode` 的断言是否需要同步更新？
3. `pdf.js` 是否有后续计划？如果有，保留但加注释标注"未集成"。

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `src/core/storage.js` | 删除 `fontSize` + `debugMode`（如选删除） |
| `content/content.js` | `mergeDefaults` 删除对应字段 |
| `options/options.html` | 删除调试模式 UI（如选删除） |
| `options/options.js` | 删除 `debugMode` 相关代码 |
| `options/options-ui-state.js` | `buildSettingsSnapshot` 删除 `debugMode` |
| `background/modules/message-router.js` | 删除 `updateSettings` case |
| `src/core/pdf.js` | 删除文件（如确认不需要） |
| `tests/107-dead-code-cleanup.test.mjs` | 回归测试 |

## 不做的事

- **不改** 任何功能逻辑
- **不碰** immersive.js、popup.js、floating-ball.js

---

_等待 Codex 审阅后出 task 文件。_

---

### [Codex] 2026-03-16 — 审阅结论

我逐项核过代码后，结论不是 `A/B/C/D` 都能按“死代码”一把删掉。

- `A fontSize`：成立，可以直接进 task。
  - 我全仓确认过，`fontSize` 只剩 [storage.js](/Users/xa/Desktop/projiect/zhiyi/src/core/storage.js) 默认值和 [content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) 的 fallback 副本，没有任何读取方。
  - `immersive.js` 里标题字号同步走的是宿主节点 `getComputedStyle(...).fontSize`，和这个设置项无关。

- `B debugMode`：技术上是“空开关”，但我不接受把它和 `A` 一起当纯死代码清理。
  - 现状判断没错：我确认 `debugMode` 只剩 [storage.js](/Users/xa/Desktop/projiect/zhiyi/src/core/storage.js)、[content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js)、[options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js)、[options-ui-state.js](/Users/xa/Desktop/projiect/zhiyi/options/options-ui-state.js) 这条设置/UI/snapshot 链，没有任何运行时消费。
  - 但它已经是用户可见设置项，也被 [features.md](/Users/xa/Desktop/projiect/zhiyi/docs/reference/features.md) 当作现有可配置项写进产品文档了，所以这不只是“删几行死代码”，而是产品表面变更。
  - 我的收口是：`B` 应改写成“placeholder 设置要么删除、要么明确标注未实现”，需要单独做产品决策，不和 `A` 捆成同一个无争议清理任务。

- `C updateSettings`：我不同意写成“死路由，直接删除”。
  - 我确认当前生产代码里确实已经没有地方再发送 `action: 'updateSettings'`；设置更新主路径已经是 `patchSettings`。
  - 但 [message-router.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/message-router.js) 里这个 case 仍被 [architecture.md](/Users/xa/Desktop/projiect/zhiyi/docs/reference/architecture.md) 记为公开 action，也被现有测试当成兼容契约锁住。
  - 所以它更准确的定位是“向后兼容路由”，不是无人知晓的死分支。要删可以，但那会是一次契约收缩，必须连文档和测试一起有意识地下掉，而不是在“死代码清理”里顺手删。

- `D pdf.js`：我明确不同意。
  - 这不是孤立到可以直接删除的残渣。[005-product-surface.md](/Users/xa/Desktop/projiect/zhiyi/docs/workbench/tasks/005-product-surface.md) 里已经有明确决策：`保留 src/core/pdf.js 源码不删（后续可能实现）`。
  - 现在 [features.md](/Users/xa/Desktop/projiect/zhiyi/docs/reference/features.md) 也明确写着“PDF 模块（未开放入口）”，说明它是刻意保留的未开放能力，不是误留文件。

所以我的最终建议是：

- 可以直接起 task 的只有 `A fontSize`
- `B debugMode` 需要先做产品决策：删除，还是保留并改成“未实现/即将推出”
- `C updateSettings` 如果要删，应单列成“兼容契约收缩”任务，不写成无风险死代码
- `D pdf.js` 不应进入本轮清理

按这个边界，`107` 不应该起成“一锅端删除四项”的 task；最多只能先收成 `A-only`，或者 `A + B(若确认删除)`。
