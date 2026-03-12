# 004 — 审核问题修复报告

- 状态: done
- 对应任务: [tasks/004-critical-fixes.md](../tasks/004-critical-fixes.md)
- 对应讨论: [discussions/004-critical-fixes.md](../discussions/004-critical-fixes.md)
- 执行日期: 2026-03-10

## 结果概览

本任务完成了 `003-full-audit` 中 OCR 移除后仍然保留的 Critical / High 修复项，覆盖 XSS 注入面、设置刷新、快捷键、未实现 TTS provider、消息协议漂移、广告屏蔽回滚和权限收缩。

## 已完成修复

### 4.1 innerHTML XSS 注入

- `content/modules/selection.js`
  - 将翻译气泡结果改为 `textContent`
  - 统一错误态渲染，避免模型输出 / 异常消息进入 `innerHTML`
- `content/modules/sidebar.js`
  - 历史记录改为 `createElement` + `textContent`
  - 翻译失败时改为纯文本错误展示
- `options/options.js`
  - 历史列表改为 DOM API 渲染，删除动态 `innerHTML` 拼接
- 全仓复查 `innerHTML` / `outerHTML`
  - 剩余用法只保留静态模板、静态图标、或已做 `escapeHtml` 的 popup 输出

### 4.2 设置更新后 translator 不刷新

- `background/service-worker.js`
  - 新增 `updateSettings` handler
  - 收到设置变更后调用 `translator.refreshSettings()`
- `options/options.js`
  - `saveSettings()` 改为等待 `updateSettings` 响应
  - 后台返回错误时直接 toast 给用户，不再 fire-and-forget

### 4.3 快捷键不工作

- `background/service-worker.js`
  - 新增 `chrome.commands.onCommand`
  - 将 manifest 中的 snake_case command 映射到内容脚本现有的 camelCase action
  - 转发前读取设置，尊重 `enableShortcut === false`

### 4.4 悬浮球侧边栏方法名错误

- `content/modules/floating-ball.js`
  - 将错误的 `ST.sidebar.toggle()` 改为实际导出的 `ST.toggleSidebar()`

### 4.5 异步错误未捕获

- `content/modules/selection.js`
  - 划词翻译改为 `await` + `try/catch`
  - 请求失败时气泡进入明确错误态，不再卡在 loading
- `options/options.js`
  - 保存设置时能正确展示后台刷新失败

### 4.6 未实现 TTS provider 清理

- 已移除 Fish Audio 和 Edge TTS 的代码 / UI / 设置残留
  - `options/options.html`
  - `options/options.js`
  - `content/modules/sidebar.js`
  - `content/modules/float-window.js`
  - `src/core/storage.js`
  - `src/core/tts.js`
- 结论修正
  - `playAudioOffscreen` 不是 Fish / Edge 专用，而是 OpenAI / Google / GLM 共用播放通道
  - 因此本次保留该 action，并在 `background/service-worker.js` 中接入 `playAudioViaOffscreen()`

### 4.7 Service Worker 协议漂移

- 静态比对了所有发往后台的 `chrome.runtime.sendMessage` action
- 现状
  - `translate`, `translateBatch`, `getSettings`, `getHistory`, `updateSettings`
  - `testTTS`, `ttsOpenAI`, `ttsGoogle`, `ttsGLM`, `playAudioOffscreen`
  - 都已有对应后台处理
- 额外说明
  - popup 中的 `toggleImmersive` / `toggleSidebar` / `toggleFloatWindow` / `getSelectedText` 走的是 `chrome.tabs.sendMessage`，由 `content/content.js` 处理，不属于 Service Worker 漂移

### 4.8 全局命名空间不一致

- `content/modules/ad-blocker.js`
  - 统一切到 `window.SmartTranslator`

### 4.9 ad-blocker 回滚不完整

- `content/modules/ad-blocker.js`
  - enable 时保存原始 `window.open`
  - 保存点击拦截 handler 和覆盖层清理 interval
  - disable 时恢复 `window.open`、移除事件监听、清理 interval

### 4.10 权限收缩

- `manifest.json`
  - 已移除未使用的 `scripting` 权限
- `<all_urls>` 评估结论
  - 当前保留
  - 原因是划词翻译、沉浸式翻译、侧边栏、小窗和悬浮球都依赖内容脚本在任意站点运行；在没有产品侧白名单策略前，直接收缩会改变功能边界

## 验证

执行通过：

```bash
node --check background/service-worker.js
node --check content/modules/selection.js
node --check content/modules/sidebar.js
node --check options/options.js
node --check content/modules/floating-ball.js
node --check content/modules/float-window.js
node --check content/modules/ad-blocker.js
node --check src/core/storage.js
node --check src/core/tts.js
python3 - <<'PY'
import json
json.load(open('manifest.json'))
print('MANIFEST_OK')
PY
```

静态扫描结果：

- `ttsFish` / `ttsEdge` 已无代码引用
- `playAudioOffscreen` 已有后台 handler，并保留前端调用链
- `window.ST` 已从 `content/modules/ad-blocker.js` 移除
- `innerHTML` / `outerHTML` 复查后，剩余动态风险点已清掉

## 未做项

- 没有在真实 Chrome 扩展环境里手工点击验证快捷键、侧边栏 TTS 和广告屏蔽开关
- 项目仍无自动化测试框架，本次以语法检查和静态引用校验为主
