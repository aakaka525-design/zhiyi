---
status: done
priority: P1
created: 2026-03-10
---

# 005 — 产品表面清理

## 背景

004 修复了 Critical/High 问题后，产品核心链路已可用。但仍有多个用户可见的"伪功能"和行为不一致问题，影响产品可信度和上架准备。本任务聚焦低风险、高感知的产品表面修复。

## 相关讨论

- 来源分析: [discussions/004-critical-fixes.md](../discussions/004-critical-fixes.md)（Codex 优先级建议 + 双方技术讨论）
- 审核报告: [reports/003-full-audit.md](../reports/003-full-audit.md)

## 修复清单

### 5.1 PDF 伪入口隐藏 [来源: 5.3-2]

**问题**: Popup 的 PDF 按钮点击后跳转 `options/options.html#pdf`，但 Options 页没有对应的 PDF 标签页。用户点击后看到的是空白或错误标签。

**修复**:

- [x] `popup/popup.js:200-203` — 移除或隐藏 PDF 按钮的点击事件
- [x] `popup/popup.html` — 隐藏或移除 `btn-pdf` 按钮元素（CSS `display:none` 或直接删除 DOM）
- [x] 如果 `manifest.json` 的 `description` 或 popup 界面文案中提到 PDF 翻译能力，同步移除相关描述
- [x] 保留 `src/core/pdf.js` 源码不删（后续可能实现）

### 5.2 Popup 朗读统一走 ttsProvider 配置 [来源: 004 讨论新发现]

**问题**: Popup 的朗读按钮始终使用系统 `speechSynthesis`，忽略用户在设置中选择的 TTS provider。侧边栏和小窗已经尊重 provider 配置，Popup 行为不一致。

**修复**:

- [x] `popup/popup.js:361-372`（`speak` 函数）— 改为先读取 `ttsProvider` 设置
- [x] provider 分发逻辑：
  - `system` → 保持现有 `speechSynthesis` 本地播放
  - `openai` → `chrome.runtime.sendMessage({ action: 'ttsOpenAI', ... })` 获取 audioData，再发 `playAudioOffscreen`
  - `google` → `chrome.runtime.sendMessage({ action: 'ttsGoogle', ... })` → `playAudioOffscreen`
  - `glm` → `chrome.runtime.sendMessage({ action: 'ttsGLM', ... })` → `playAudioOffscreen`
- [x] 不要在 Popup 里直接 `new Audio()` 播放远程音频（Popup 关闭后播放会中断），统一走 offscreen
- [x] 不需要复用 sidebar.js / float-window.js 的 TTS UI 代码，Popup 只加薄分发层
- [x] `popup/popup.js:141-146`（按钮事件）— 确认调用更新后的 `speak` 函数

**注意**: 需要先通过 `chrome.runtime.sendMessage({ action: 'getSettings' })` 获取当前 ttsProvider 设置。检查 Popup 初始化时是否已经读取了设置，如果已有就复用。

### 5.3 离线翻译声明修正 [来源: 5.1-1]

**问题**: `src/core/offline.js:20-24` 声明支持 3 个语言对（en-zh、ja-zh、ko-zh），但 `assets/dictionaries/` 下实际只有 `en-zh.json`。用户选择日语或韩语离线翻译时会静默失败并回退到 Google 翻译，没有任何提示。

**修复**:

- [x] `src/core/offline.js` — 从字典配置中移除 `ja-zh` 和 `ko-zh`（或保留但标记为不可用）
- [x] 当用户选择离线翻译但当前语言对无字典时，返回明确的错误消息（如"当前仅支持英译中离线翻译"），而非静默回退
- [x] 如果 Options 页的翻译引擎选择器中有离线翻译的语言对描述，同步修正

### 5.4 testTTS 改为真实播放测试 [来源: 3.3-3]

**问题**: Options 页的"测试语音"按钮（`options/options.js:275-308`）只验证 API 配置是否存在，不做真实请求和播放。用户以为 TTS 可用，实际链路可能是断的。

**修复**:

- [x] `options/options.js` `testTTS()` 函数改为：
  - `system` → 在 Options 页本地 `speechSynthesis` 播放固定短句（如"测试语音播放"）
  - `openai/google/glm` → 发送真实 TTS 请求获取 audioData → `playAudioOffscreen` 播放
- [x] 按钮状态文案：
  - 请求中：`正在测试...`（按钮禁用）
  - 成功：`✓ 已开始播放`
  - 失败：显示 provider 相关错误信息
- [x] 复用现有 `ttsOpenAI` / `ttsGoogle` / `ttsGLM` 后台 handler，不需要新建请求逻辑

### 5.5 config.txt 示例化 [来源: 1.1-1]

**问题**: `config.txt` 包含真实 API 配置。虽然已在 `.gitignore` 中排除，但仓库没有示例文件告知用户格式，新用户不知道如何创建。

**修复**:

- [x] 创建 `config.example.txt`，内容为带占位符的配置模板
- [x] 确认 `.gitignore` 中 `config.txt` 已被排除（当前已排除，验证即可）
- [x] 如果有文档提到 config.txt 的使用方式（如 `docs/guide/api-configuration.md`），确认引导用户从 example 复制

---

## 执行要求

1. **按编号顺序执行**
2. **每项修完后验证** — `node --check` 确认语法正确
3. **全仓搜索残留** — 每项修完后搜索相关关键词
4. **不要动 `src/core/tts.js` 的架构** — TTS 统一重构不在本任务范围
5. **不要动全站注入策略** — 那是 006 的范围
6. **报告写入** `reports/005-product-surface.md`

## 执行结果

- 报告: [reports/005-product-surface.md](../reports/005-product-surface.md)

## 相关文档

- 审核报告: [reports/003-full-audit.md](../reports/003-full-audit.md)
- 004 修复讨论: [discussions/004-critical-fixes.md](../discussions/004-critical-fixes.md)
- 004 修复报告: [reports/004-critical-fixes.md](../reports/004-critical-fixes.md)
