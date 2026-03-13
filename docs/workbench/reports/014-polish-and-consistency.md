# 014 — 打磨与一致性修复报告

- 状态: done
- 对应任务: [tasks/014-polish-and-consistency.md](../tasks/014-polish-and-consistency.md)
- 来源讨论: [discussions/014-polish-and-consistency.md](../discussions/014-polish-and-consistency.md)
- 执行日期: 2026-03-13

## 结果概览

本轮按 `executing-plans` 分两批完成了 `014` 的全部范围：

- `A` Popup toast 深色模式可见性修复
- `B` Popup 远程 TTS 失败 fallback 到系统语音
- `C` Content script settings 默认值合并一致性
- `D` 沉浸式翻译同语言过滤
- `E` 翻译气泡加载动画 CSS
- `F` Content script 硬编码颜色 token 化

## 已完成改动

### 14.1 A Popup toast 固定深色背景

[popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 的 `showToast()` 不再使用 `background: var(--text-primary)`，现在固定为 `rgba(50, 54, 66, 0.95)`，同时保留 `color: white`。

这避免了 dark mode 下 `--text-primary` 变成浅灰时，toast 出现“浅灰底 + 白字”的低对比问题。

### 14.2 B Popup TTS 失败时回退系统语音

[popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 的 `speak()` 现在在非 `system` provider 路径上包了一层本地 `try/catch`：

- 远程 provider 成功时，仍走原来的 `requestTtsAudio()` + `playAudioOffscreen`
- 远程 provider 失败时，只 `console.warn(...)`
- 然后直接继续走 `SpeechSynthesisUtterance` 的系统语音路径

这让 popup 的失败行为和侧边栏 / 小窗对齐，同时没有额外新增 toast 干扰。

### 14.3 C Content script 默认设置合并收口

[content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) 新增了本地 `mergeDefaults(raw)` helper，内容与 [storage.js](/Users/xa/Desktop/projiect/zhiyi/src/core/storage.js) 当前 `DEFAULT_SETTINGS` 保持一致。

本批把两条原本会产出 raw settings 的路径收口到了 merged settings：

- `loadSettings()` 的超时 fallback：`chrome.storage.local.get('settings')` 结果会先经过 `mergeDefaults()`
- `chrome.storage.onChanged`：`changes.settings.newValue` 会先经过 `mergeDefaults()` 再写回 `ST.state.settings`

主路径 `sendMessage({ action: 'getSettings' })` 没有改，仍然由 service worker 侧的 `StorageManager.getSettings()` 负责合并默认值。

## TDD 记录

本批按 test-first 执行，新增了 [polish-consistency.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/polish-consistency.test.mjs)。

首次运行 `node --test tests/polish-consistency.test.mjs` 时，3 个断言全部失败，分别覆盖：

- popup toast 仍使用 `var(--text-primary)`
- popup 远程 TTS 失败后没有 fallback 到系统语音
- content script 的 fallback / `onChanged` 路径仍直接消费 raw settings

随后补最小实现，再回跑目标测试转绿。

## 验证

本批实际跑过：

```bash
node --test tests/polish-consistency.test.mjs
node --test tests/*.test.mjs
node --check popup/popup.js
node --check content/content.js
node --check content/modules/immersive.js
node --check content/modules/sidebar.js
git diff --check
```

验证结果：

- `tests/polish-consistency.test.mjs`：3/3 通过
- `node --test tests/*.test.mjs`：65/65 通过
- [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) `node --check` 通过
- [content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) `node --check` 通过
- [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) `node --check` 通过
- [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) `node --check` 通过
- `git diff --check` 无输出

## 第二批补完

### 14.4 D 沉浸式翻译通用路径补同语言过滤

[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的通用站点过滤链现在在 `text.length < 20` 之后也会检查：

```javascript
if (ST.detectLanguage(text) === targetLang) return false;
```

这样通用路径和 Twitter 专用路径收敛到同一行为，不再把已经是目标语言的长段落送去做“同语翻译”。

### 14.5 E 翻译气泡 loading dots 动画补齐

[content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 新增了：

- `.st-loading-dots`
- `.st-loading-dots span`
- `span:nth-child(2/3)` 的延迟
- `@keyframes st-bounce`

实现是 3 个 `7px` 圆点、`var(--accent)` 配色、`1.2s` 交替跳动，和任务要求保持一致，没有额外引入脉冲或渐变效果。

### 14.6 F Content script 硬编码颜色收回 token

[sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 里两类硬编码值已替换：

- 初始空状态与动态空状态 `#999` → `var(--text-tertiary)`
- 快捷键 badge `#eee` → `var(--bg-secondary)`

[content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 的 scoped token 块新增了：

- `--surface: rgba(255, 255, 255, 0.95)`

并把 3 个卡片型表面收回到该 token：

- `.st-sidebar-result-card`
- `.st-history-item:hover`
- `.st-orb-menu-item`

前景白色（例如 hover 态文字）没有改，保持在任务允许范围内。

## 最终验证补充

在第一批验证基础上，又补跑并确认：

```bash
node --test tests/polish-consistency.test.mjs
node --test tests/*.test.mjs
node --check popup/popup.js
node --check content/content.js
node --check content/modules/immersive.js
node --check content/modules/sidebar.js
git diff --check
```

最终结果：

- `tests/polish-consistency.test.mjs`：6/6 通过
- `node --test tests/*.test.mjs`：68/68 通过
- [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) `node --check` 通过
- [content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) `node --check` 通过
- [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) `node --check` 通过
- [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- Popup toast 在浅色和深色模式下都保持足够对比度
- Popup 在远程 TTS provider 失败时能直接听到系统语音 fallback
- 通用网站沉浸式翻译不会再把目标语言段落重复注入译文
- 划词翻译气泡 loading 态能看到三点跳动反馈
- 侧边栏结果卡片、历史 hover、悬浮球菜单项的 surface 视觉在真实页面里没有突兀回退
