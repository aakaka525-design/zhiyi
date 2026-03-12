---
status: done
priority: P2
created: 2026-03-10
---

# 006 — 死代码清理与文档修正

## 背景

005 产品表面清理完成后，产生了两处死代码（testTTS 后台路由不再被调用、src/core/tts.js 完全未使用）和一处正式文档失配。本任务做收尾清理。

## 相关讨论

- 来源分析: [discussions/005-product-surface.md](../discussions/005-product-surface.md)（Codex 4 层可达性验证 + 双方共识）

## 清理清单

### 6.1 删除 `src/core/tts.js`

**原因**: 该文件完全未被使用，且内部播放模型（`new Audio().play()`）已与当前 `playAudioOffscreen` 链路不一致。保留它会误导后续开发者以为那是 TTS 的权威实现。

**已验证的 4 层可达性分析**（见 005 讨论）:
1. manifest.json 入口无引用
2. 所有 HTML 的 script 标签无加载
3. 静态 import/export 无消费方（`TTSService`、`TTS_PROVIDERS`、`OPENAI_VOICES` 无引用）
4. 全仓无 `import()` 动态加载

**执行**:

- [x] 删除前最终确认: `rg "src/core/tts\.js|TTSService|TTS_PROVIDERS|OPENAI_VOICES"` 结果只剩文件自身和 workbench 文档
- [x] 删除前最终确认: `rg "import\("` 结果为空
- [x] 删除 `src/core/tts.js`

### 6.2 清理 `testTTS` 死路由

**原因**: 005 中 `options/options.js` 的 `testTTS()` 已改为直接发送 `ttsOpenAI`/`ttsGoogle`/`ttsGLM` + `playAudioOffscreen`，不再发送 `action: 'testTTS'`。后台的 `handleTestTTS()` 和对应路由成为死代码。

**执行**:

- [x] 删除前确认: `rg "action.*testTTS|testTTS.*action"` 在前端代码中无命中（仅后台侧残留）
- [x] `background/modules/tts.js` — 删除 `handleTestTTS()` 函数
- [x] `background/service-worker.js` — 删除 `testTTS` action 路由
- [x] 确认 `background/modules/tts.js` 删除 `handleTestTTS` 后仍有其他导出在用（`playAudioViaOffscreen` 等），不要误删整个文件

### 6.3 修正正式文档中 PDF 入口过时描述

**原因**: 005 移除了 Popup 的 PDF 按钮，但 `docs/guide/native-host-setup.md` 仍提到"PDF 入口与其他文本类功能保持不变"。

**本任务授权修改以下 workbench 外文档**:
- `docs/guide/native-host-setup.md`
- `docs/reference/project-structure.md`
- `docs/reference/architecture.md`

**执行中补充**:

删除 `src/core/tts.js` 与 `testTTS` 路由后，如果不同步 [project-structure.md](../reference/project-structure.md) 和 [architecture.md](../reference/architecture.md)，会立刻留下新的正式文档失配，因此一并做最小同步。

**执行**:

- [x] 在 `docs/guide/native-host-setup.md` 中找到 PDF 入口相关描述，修正为反映当前状态（PDF 入口已隐藏，功能待后续实现）
- [x] 同步移除 `docs/reference/project-structure.md` 中已删除的 `src/core/tts.js`
- [x] 同步移除 `docs/reference/architecture.md` 中已失效的 `testTTS` action，并补齐当前 TTS action 描述
- [x] 全仓搜索 `rg "PDF.*入口|btn-pdf"` 在正式文档中确认无其他过时描述

---

## 执行要求

1. **6.1 和 6.2 修完后 `node --check` 验证所有改动文件**
2. **每项删除前先做确认扫描**——不要跳过 rg 验证步骤
3. **不要删除 `background/modules/tts.js` 整个文件**——只删 `handleTestTTS`，保留 `playAudioViaOffscreen` 等仍在使用的函数
4. **报告写入** `reports/006-cleanup.md`

## 相关文档

- 005 讨论: [discussions/005-product-surface.md](../discussions/005-product-surface.md)
- 005 报告: [reports/005-product-surface.md](../reports/005-product-surface.md)
- 004 讨论: [discussions/004-critical-fixes.md](../discussions/004-critical-fixes.md)
