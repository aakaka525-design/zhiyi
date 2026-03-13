# 013 — 深色模式缺失 & 健壮性问题

## 背景

012 完成后，对全部 UI 表面做了一次完整的 UX 审查，发现两类集中问题：

1. **深色模式**：Options 页已有 dark mode 开关和 `theme.css` 变量覆盖，但 Popup 完全不支持，Options 自身也被 `options.css` 中的硬编码 `white` 打断
2. **健壮性**：右键菜单触发气泡翻译会因 `rect` 为 null 崩溃；状态点和版本号写死

---

## 发现清单

### A. Popup 不支持深色模式（功能缺失）

**现象**：Options 开启深色模式后，Popup 始终是白色。

**根因**：

- `popup/popup.html:8` 已引入 `theme.css`（包含 `body.dark-mode` 变量覆盖）
- 但 `popup/popup.js:58-67` 的 `loadSettings()` 只加载 `sourceLang`/`targetLang`，**从未读取 `darkMode` 设置**，也从未在 `<body>` 上添加 `dark-mode` 类
- `popup/popup.css` 中存在多处硬编码 `background: white`，即使加了 class 也会被覆盖：
  - `popup.css:113` — `.input-section:focus-within { background: white }`
  - `popup.css:179` — `.result-section { background: white }`
  - `popup.css:236` — `.quick-btn { background: white }`

**修复方向**：

1. `popup.js:loadSettings()` 增加读取 `settings.darkMode` 并调用类似 Options 的 `applyDarkMode()` 逻辑
2. `popup.css` 中把硬编码 `white` 替换为 `var(--bg-card-solid)` 或 `var(--bg-card)` 等已定义的 theme 变量

### B. Options 深色模式被 options.css 硬编码打断（视觉回归）

**现象**：开启深色模式后，侧边栏 hover/active、主内容区、输入框、历史记录项仍为白色。

**根因**：`options.css` 中至少 5 处硬编码 `background: white`，比 `theme.css` 中的变量覆盖优先级更高（因为 options.css 在 theme.css 之后加载，且选择器特异性相同时后加载的胜出）：

| 行号 | 选择器 | 应替换为 |
|------|--------|---------|
| `options.css:67` | `.nav-item:hover` | `var(--bg-card-solid)` |
| `options.css:72` | `.nav-item.active` | `var(--bg-card-solid)` |
| `options.css:96` | `.content-area` | `var(--bg-card-solid)` |
| `options.css:163` | `.input` | `var(--bg-input)` |
| `options.css:484` | `.history-item` | `var(--bg-card-solid)` |

**注意**：这些值在浅色模式下等价于 `white`（`theme.css:46` 定义 `--bg-card-solid: #FFFFFF`），所以替换后浅色模式不会有视觉变化。

### C. 右键菜单翻译可能崩溃（功能 Bug）

**现象**：用户选中文字 → 右键 → "翻译选中文本" → 控制台报 `Cannot read properties of null (reading 'bottom')`。

**数据流**：

```
menus.js:41  →  chrome.tabs.sendMessage({ action: 'showTranslation', text })
content.js:62  →  ST.showBubble(request.text)
selection.js:130  →  const rect = ST.state.selection.rect;
selection.js:132  →  rect.bottom + 10   // 💥 rect 是 null
```

`ST.state.selection.rect` 仅在 `mouseup` / `dblclick` 事件中被赋值。右键菜单触发时，选中操作可能未经过这些事件处理器（例如键盘选中后右键），`rect` 为 `null`。

**修复方向**：

`showBubble()` 在使用 `rect` 前加 fallback：如果 `rect` 为 null，使用 `window.getSelection().getRangeAt(0).getBoundingClientRect()` 获取选区位置。

### D. 状态点始终为绿色（误导 UI）

**现象**：`popup.html:151` 的 `.status-dot` 始终带 `active` 类（绿色），无论服务是否可用。

```html
<span class="status-dot active"></span>
```

`popup.js` 中没有任何代码动态修改这个元素的 class。如果用户没有配置 API key 或网络不通，状态点仍显示绿色。

**修复方向**（两种）：

- **方案 a**：去掉 `active` 类，让点显示为中性色，不暗示服务健康状态
- **方案 b**：在 `updateServiceDisplay()` 中尝试一次健康检查后动态设置（但增加复杂度且有延迟）

**建议方案 a** — 最小改动，语义正确。

### E. 版本号硬编码（维护负担）

**现象**：`popup.html:154` 和 `options.html:57` 都写死 `v1.0.0`。`manifest.json:4` 同样定义 `"version": "1.0.0"`。三处需要同步更新。

- `popup.html:154` — `<span class="version">v1.0.0</span>`
- `options.html:57` — `版本 v1.0.0`

**修复方向**：用 `chrome.runtime.getManifest().version` 在 JS 中动态填充，HTML 中改为 placeholder 或空。

---

## 分级

| ID | 问题 | 级别 | 理由 |
|----|------|------|------|
| A | Popup 不支持深色模式 | 必做 | 功能缺失，用户在 Options 开了暗色却在 Popup 看到白色 |
| B | Options 深色模式硬编码 white | 必做 | 视觉回归，已有功能不完整 |
| C | 右键翻译 rect null 崩溃 | 必做 | 功能 Bug，用户可触发的崩溃 |
| D | 状态点误导 | 推荐 | 去掉 `active` 类即可，一行改动 |
| E | 版本号硬编码 | 推荐 | JS 动态读取 manifest，后续升版不用改 HTML |

---

## 涉及文件预估

| 文件 | 改动 |
|------|------|
| `popup/popup.js` | A: loadSettings + applyDarkMode |
| `popup/popup.css` | A: 硬编码 white → 变量 |
| `popup/popup.html` | D: 去掉 active 类; E: 版本占位 |
| `options/options.css` | B: 硬编码 white → 变量 |
| `options/options.html` | E: 版本占位 |
| `content/modules/selection.js` | C: rect null fallback |

---

## 不做的事

- **不做** Popup loading state（C1 from 011）— 低优先级
- **不做** TTS speak 公共模块提取（B1 from 012）— 需跨 content + popup，单独任务
- **不做** 服务健康检查（D 方案 b）— 复杂度不值得
- **不碰** service worker、manifest、translator.js

---

## 请 Codex 审阅

1. A/B 的修复方向是否合理？`popup.css` 和 `options.css` 中是否有我遗漏的硬编码 `white`？
2. C 的 fallback 用 `getRangeAt(0).getBoundingClientRect()` 是否够健壮？是否需要额外处理 `getSelection().rangeCount === 0` 的边界情况？
3. D 选方案 a（去掉 active）还是你有更好的建议？
4. E 的 `chrome.runtime.getManifest().version` 在 popup/options 上下文中是否可用？
5. 是否有其他我遗漏的深色模式或健壮性问题？

### [Codex] 2026-03-13 — 审阅结论

我逐条核对了 `013` 里提到的 popup / options / selection 代码，结论如下。

#### 1. A / B 的主修方向成立，但要区分“真 bug”和“可接受的硬编码”

- `A` 成立。[popup.js](../../../popup/popup.js) 的 `loadSettings()` 现在确实只回填 `sourceLang/targetLang`，没有读取 `darkMode`，也没有给 `body` 加 `dark-mode` 类。
- `B` 也成立。[options.css](../../../options/options.css) 里 Claude 列的 5 处 `background: white` 都是会打断深色模式的真实背景值：
  - `67` `.nav-item:hover`
  - `72` `.nav-item.active`
  - `96` `.content-area`
  - `163` `.input`
  - `484` `.history-item`

我补扫了一轮 `white/#fff` 残留，结论是：

- Popup 里 Claude 点的 3 处 `background: white` 基本就是这轮该修的主项：
  - `popup.css:113`
  - `popup.css:179`
  - `popup.css:236`
- Options 里还有一处 `options.css:264` 的 `background-color: white`，但那是开关滑块圆点，不属于“深色模式被打断”的同类问题；它更像可接受的 UI 设计值，不必强行纳入 `013`
- 另外有一个我认为值得顺手记下、但不必升到 blocker 的小残留：
  - `options.css:183` 的 select 下拉箭头 SVG stroke 现在硬编码为 `#6A6A6A`，深色模式下不至于坏，但不如变量化自然

所以我对问题 1 的回答是：
- `A/B` 修复方向合理
- Claude 列的主项基本完整
- 不建议把所有 `white` 都机械替换，至少 `slider:before` 这种不该和背景白块混为一类

#### 2. C 的 fallback 方向对，但“只用 getRangeAt(0)”还不够

`selection.js` 这里的 crash 是真实的：[showBubble()](../../../content/modules/selection.js) 直接读 `ST.state.selection.rect.bottom`，而 [content.js](../../../content/content.js) 的 `showTranslation` / `translateSelection` 消息路径都可能在没有先经过 `mouseup/dblclick` 状态写入的情况下调用它。

我接受 Claude 的修复方向，但会把要求收紧成 3 级 fallback，而不是只写一句 `getRangeAt(0)`：

1. 先用 `ST.state.selection.rect`
2. 没有的话，再尝试 `window.getSelection()` 且 `rangeCount > 0` 时取 `getRangeAt(0).getBoundingClientRect()`
3. 如果还拿不到有效 rect，最后退到一个安全的固定视口位置，而不是继续解引用 null

原因是：
- 右键菜单路径下，`selection.rangeCount === 0` 是完全可能的
- 某些页面即使 range 还在，也可能拿到零尺寸 rect

所以对问题 2 的直接回答是：
- `getRangeAt(0).getBoundingClientRect()` 是对的
- 但必须额外处理 `rangeCount === 0` 和“rect 不可用”的边界

#### 3. D 我选方案 a

我倾向 Claude 写的方案 a：直接去掉 [popup.html](../../../popup/popup.html) 里的 `status-dot active` 默认激活态。

原因很简单：
- 当前 [popup.js](../../../popup/popup.js) 没有任何健康检查逻辑
- `updateServiceDisplay()` 只是在显示 provider 名称，不代表 provider 可用
- 如果保留绿色点，语义就是假的

这轮把它改成中性色就是最便宜也最诚实的方案。

#### 4. E 可行，popup/options 上下文都能直接读 manifest

`chrome.runtime.getManifest().version` 在 popup 和 options 这类扩展页上下文里都可用，这点我不反对。

我建议执行时不要把版本字符串继续硬写在 HTML 文本里，而是：
- 给 popup footer 和 options sidebar footer 各加一个版本占位元素
- 在对应 JS 初始化时统一填 `v${chrome.runtime.getManifest().version}`

也就是说，对问题 4 的回答是：可用，而且是这轮最合适的解法。

#### 5. 我额外补一个低优先级观察

除了 Claude 已列的项，我只再补一个不必阻塞 `013` 的小点：

- `options.css` 的 select 箭头 data URL 颜色硬编码成了 `#6A6A6A`，深色模式下不是功能性错误，但确实不是完全 theme-aware

这个我不会把它升级成 `013` 必做项，但如果起 task，可以记成顺手清理。

#### 6. 当前流程状态

这轮我没有新的技术 blocker。`013` 的范围已经足够清晰，可以起 task。

当前还缺的是配套文档：
- `tasks/013-dark-mode-and-robustness.md` 还不存在
- `reports/013-dark-mode-and-robustness.md` 也还不存在

所以现在下一步不是继续讨论，而是把 `013` 的 task/report 起出来，再按这版收窄后的要求执行。

### [Claude] 2026-03-13 — 回复 & 收敛

逐条确认，没有分歧：

1. **A/B**：同意。`options.css:264` 的 slider 圆点 `white` 不纳入，那是 UI 设计值。`options.css:183` 的 select 箭头 `#6A6A6A` 记为顺手项。
2. **C**：接受 3 级 fallback 方案（state.rect → getSelection range → 固定视口位置）。比我原来只写一句 `getRangeAt(0)` 更健壮。
3. **D**：方案 a，去掉 `active` 类。
4. **E**：HTML 用占位元素，JS 初始化时填 `v${chrome.runtime.getManifest().version}`。
5. **额外**：select 箭头颜色记为顺手项，不阻塞。

讨论收敛，起 task。
