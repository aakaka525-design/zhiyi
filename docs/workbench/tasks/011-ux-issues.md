# 011 — UX 问题修复

- 状态: done
- 来源讨论: [discussions/011-ux-issues.md](../discussions/011-ux-issues.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/011-ux-issues.md](../discussions/011-ux-issues.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|---------|
| `options/options.html` | B1 + C3 + A1 |
| `options/options.js` | A1 + B3 |
| `options/options-ui-state.js` | B3 helper + A1 toast 文案 |
| `popup/popup.html` | C2 |

## 任务清单

### 必做

#### B1. Options 开关 HTML 默认值修复

- [x] `options/options.html:109` — `show-floating-ball` 的 `<input>` 去掉 `checked` 属性
- [x] `options/options.html:121` — `enable-ad-block` 的 `<input>` 去掉 `checked` 属性
- [x] 验证：`options.js` 的 `loadSettings()` 会根据实际存储值设置开关状态，去掉 HTML `checked` 后不影响功能

原因：`storage.js:DEFAULT_SETTINGS` 中 `showFloatingBall` 和 `enableAdBlock` 默认为 `false`，但 HTML 写了 `checked`，导致页面加载时开关先 ON 再 OFF 的视觉闪烁。

#### C2. Popup footer 服务名去硬编码

- [x] `popup/popup.html:152` — 将 `<span class="service-name" id="current-service">Google 翻译</span>` 的默认文本改为空或 `-`
- [x] 验证：`popup.js:updateServiceDisplay()` 会在 init 后填入正确的 provider 名称

#### C3. DeepSeek 配置区标题修改

- [x] `options/options.html:268` — 将 `ppinfra 配置 (DeepSeek)` 改为 `DeepSeek 配置`
- [x] `options/options.html:269-270` 的描述文字可适当调整，将 "ppinfra" 移到描述中作为补充说明，或直接改为面向用户的表述

### 推荐

#### A1. 快捷键自定义入口修复

- [x] `options/options.html:173-176` — 将 `<a href="chrome://extensions/shortcuts" target="_blank">` 改为 `<button>` 按钮
- [x] `options/options.js` — 为该按钮添加点击事件：将 `chrome://extensions/shortcuts` 复制到剪贴板 + 显示 toast 提示用户在地址栏粘贴打开

**注意**：不使用 `chrome.tabs.create()` 等程序化导航方式，因为 Chrome 117+ 对 `chrome://` URL 的保护行为未经实机验证。采用"复制 URL + 引导提示"的可靠方案。

#### B3. Options 页面保存语义一致化

当前问题：深色模式和调试模式（`options.js:118-128`）在 toggle 时自动保存，其余所有设置（包括功能开关、API key、TTS 等）需要手动点"保存"按钮。用户可能在修改后直接关闭页面而丢失配置。

- [x] 添加 dirty state 跟踪：当 input/select/checkbox 值与初始加载值不同时标记为 dirty
- [x] 离开页面提示：当存在未保存变更时，`beforeunload` 弹出浏览器默认提示
- [x] （可选）保存按钮状态：dirty 时高亮保存按钮或显示"有未保存更改"提示文字

**注意**：不做全量 auto-save。API key 等字段在输入过程中 blur 自动保存会落盘半截值。

## 不做的事

- **不做 B2**（清空历史确认）— 已有 `confirm()` 对话框，原讨论中为误报
- **不做 C1**（popup loading state）— 低优先级，留给后续
- **不做 C4**（TTS voice select 重置）— 运行时有 fallback 兜底，只是 UI 不同步，留给后续
- **不碰** `popup/popup.js` 的翻译逻辑或 service worker

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过（确认无回归）
- [x] `node --check options/options.js` 通过
- [x] `node --check popup/popup.js` 通过（如有改动）
- [x] `git diff --check` 无输出
- [x] 手动验证项已列入报告（本轮未执行，仅记录待人工点验项）：
  - Options 页加载时开关不闪烁
  - Popup 打开时 footer 不闪现 "Google 翻译"
  - DeepSeek 配置区标题无 "ppinfra"
  - 快捷键按钮可复制 URL + 显示提示
  - 修改设置后关闭页面弹出未保存提示
