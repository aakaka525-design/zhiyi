---
status: done
priority: P0
created: 2026-03-10
---

# 004 — 审核问题修复

## 背景

003 全面审核报告发现 1 个 Critical、多个 High 问题。002（OCR 移除）已完成，本任务修复剩余问题。

## 用户决策

- **PDF**: 保留当前占位实现，后续再完善
- **TTS**: 移除 Fish Audio 和 Edge TTS（未实现的 provider），保留已工作的 provider
- **Offscreen 音频播放**: `playAudioOffscreen` 是 OpenAI / Google / GLM 共用播放通道，保留并补齐后台 handler，不随 Fish / Edge 一起删除

## 修复清单

### P0 — Critical

#### 4.1 innerHTML XSS 注入

全部改为 `textContent` 或 `createElement` + 属性赋值，切断 HTML 解析。

- [x] `content/modules/selection.js:149` — 翻译结果气泡中 `innerHTML` 写入 `response.text`
- [x] `content/modules/sidebar.js:333` — 侧边栏历史记录 `item.source` / `item.target` 拼入 `innerHTML`（持久化二次注入风险）
- [x] `options/options.js:615` — Options 历史页同类问题
- [x] 全仓搜索 `innerHTML` 和 `outerHTML`，确认无遗漏的动态内容写入

---

### P1 — High 功能 Bug

#### 4.2 设置更新后 translator 不刷新 [5.1-2]

- [x] `background/service-worker.js` — 添加 `updateSettings` action handler，调用 `translator.refreshSettings()`
- [x] `options/options.js:537-540` — 确认发送 `updateSettings` 后有错误处理（不是 fire-and-forget）

#### 4.3 快捷键不工作 [5.4-1]

- [x] `background/service-worker.js` — 添加 `chrome.commands.onCommand` 监听器
- [x] 实现 4 个 command 的处理：`translate_selection`、`toggle_immersive`、`toggle_sidebar`、`toggle_float_window`
- [x] 通过 `chrome.tabs.sendMessage` 转发到当前标签页的内容脚本

#### 4.4 悬浮球侧边栏方法名错误 [5.2-1]

- [x] `content/modules/floating-ball.js:64` — `ST.sidebar.toggle` 改为实际导出的方法名（读代码确认后修正）

#### 4.5 异步错误未捕获 [3.1-1]

- [x] `content/modules/selection.js:138` — 加 `await` 或在 Promise 链尾加 `.catch()`，失败时显示错误态而非卡在加载
- [x] `options/options.js:537-540` — `updateSettings` 发送失败时提示用户

#### 4.6 移除未实现的 TTS provider [5.3-1]

- [x] 移除 Fish Audio TTS 相关代码和 UI 入口
- [x] 移除 Edge TTS 相关代码和 UI 入口
- [x] 删除无实现的 `ttsFish` / `ttsEdge`，并为通用 `playAudioOffscreen` 补齐后台 handler
- [x] 确认保留已工作的 provider：系统 TTS、OpenAI TTS、Google TTS、GLM TTS
- [x] Options 页 TTS 配置区域同步清理

#### 4.7 Service Worker 协议漂移 [2.4-1]

- [x] 移除前端发送但后端无 handler 的 runtime action（4.2 和 4.6 覆盖主要问题）
- [x] 确认所有发往 Service Worker 的 `chrome.runtime.sendMessage` action 都有对应处理；`chrome.tabs.sendMessage` 继续由 `content/content.js` 处理

---

### P2 — High 质量/安全

#### 4.8 全局命名空间不一致 [2.3-1]

- [x] `content/modules/ad-blocker.js` — 将 `window.ST` 引用改为 `window.SmartTranslator`

#### 4.9 ad-blocker window.open 覆写不可回滚 [4.2-1]

- [x] `content/modules/ad-blocker.js` — enable 时保存原始 `window.open` 引用和 interval ID
- [x] disable 时恢复原始函数、清理 interval

#### 4.10 权限收缩 [1.4-1]

- [x] `manifest.json` — 移除 `scripting` 权限（全仓未使用）
- [x] 评估 `<all_urls>` 是否可收缩（需确认翻译功能的实际域名需求）

---

## 执行要求

1. **按编号顺序执行** — P0 先于 P1，P1 先于 P2
2. **4.1（XSS）必须最先修** — 唯一的 Critical
3. **每个子任务修完后验证** — 确认功能不受影响
4. **全仓搜索残留** — 每项修完后搜索相关关键词确认无遗漏
5. **报告写入** `reports/004-critical-fixes.md`

## 相关文档

- 审核报告: [reports/003-full-audit.md](../reports/003-full-audit.md)
- 审核讨论: [discussions/003-full-audit.md](../discussions/003-full-audit.md)
- 执行报告: [reports/004-critical-fixes.md](../reports/004-critical-fixes.md)
