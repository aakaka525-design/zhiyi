# 055 — 内容脚本 UI 不响应深色模式 & 悬浮球拖拽偏移量未使用

## A. 内容脚本 UI 不响应深色模式设置

### 现象

用户在设置页开启深色模式 → popup 和 options 页面变为深色 → 但划词翻译气泡、侧边栏、翻译小窗、悬浮球、沉浸式译文、Toast 提示全部保持浅色。在深色主题的网页上（如 GitHub Dark、Twitter Dark），浅色 UI 元素格外刺眼。

### 根因

**popup 和 options 的深色模式工作原理**：
- `options/theme.css` 定义了 `body.dark-mode { ... }` 深色变量覆盖
- `popup/popup.html:8` 引入 `../options/theme.css`，popup.js 通过 `document.body.classList.add('dark-mode')` 切换
- 深色模式生效 ✓

**内容脚本的问题**：
- `content/content.css:6-29` 定义了插件元素的 CSS 变量，**只有浅色值**：
  ```css
  #smart-translator-bubble,
  .st-immersive-wrapper,
  #st-sidebar,
  #st-sidebar-toggle-btn,
  #st-float-window,
  #st-page-progress,
  #st-floating-ball-container,
  #smart-translator-icon,
  .st-immersive-translation,
  .st-translation-separator,
  #st-toast {
      --accent: #7A9A8B;
      --surface: rgba(255, 255, 255, 0.95);
      --text-primary: #333333;
      --bg-secondary: #F4F4F4;
      /* ... 全部是浅色值，无深色覆盖 */
  }
  ```
- `content.js:21` 有 `darkMode: false` 在默认设置中 → `ST.state.settings.darkMode` 可用
- 但无任何模块读取该设置来切换 CSS 类或变量
- 内容脚本不引入 `theme.css` → 没有 `.dark-mode` 规则可用

### 证据

**content.css 无深色模式**：
```bash
grep -n "dark" content/content.css
# (无输出)
```

**content 模块不读取 darkMode**：
```bash
grep -rn "darkMode\|dark-mode\|dark_mode" content/modules/
# (无输出)
```

**popup 引入 theme.css 获得深色模式**：
```html
<!-- popup/popup.html:8 -->
<link rel="stylesheet" href="../options/theme.css">
```

**options/theme.css:71-86 深色变量**（content.css 缺少等价定义）：
```css
body.dark-mode {
    --bg-primary: #1E222B;
    --bg-secondary: #282C34;
    --accent: #8FB3A4;
    --text-primary: #E8E8E8;
    --text-secondary: #B0B0B0;
    --border-color: rgba(255, 255, 255, 0.08);
    /* ... */
}
```

### 受影响的 UI 元素

| 元素 | CSS 选择器 | 场景 |
|------|-----------|------|
| 划词翻译气泡 | `#smart-translator-bubble` | 任何页面选中文本 |
| 翻译图标 | `#smart-translator-icon` | 短文本选中 |
| 侧边栏 | `#st-sidebar`, `#st-sidebar-toggle-btn` | Alt+S 打开 |
| 翻译小窗 | `#st-float-window` | Alt+W 打开 |
| 悬浮球 + 菜单 | `#st-floating-ball-container` | 悬浮球开启时 |
| 沉浸式译文 | `.st-immersive-wrapper`, `.st-immersive-translation` | 全页翻译 |
| Toast 提示 | `#st-toast` | 各种操作反馈 |
| 进度条 | `#st-page-progress` | 沉浸式翻译进度 |

### 建议方案

**核心挑战**：内容脚本注入在宿主页面的 `<body>` 中，不能用 `body.dark-mode` 切换（会影响宿主页面）。需要一个不污染宿主的作用域机制。

**方案：`data-st-theme="dark"` on `<html>`**

1. **content.css** — 在现有浅色变量之后，新增深色变量块：
   ```css
   :root[data-st-theme="dark"] #smart-translator-bubble,
   :root[data-st-theme="dark"] .st-immersive-wrapper,
   :root[data-st-theme="dark"] #st-sidebar,
   :root[data-st-theme="dark"] #st-sidebar-toggle-btn,
   :root[data-st-theme="dark"] #st-float-window,
   :root[data-st-theme="dark"] #st-page-progress,
   :root[data-st-theme="dark"] #st-floating-ball-container,
   :root[data-st-theme="dark"] #smart-translator-icon,
   :root[data-st-theme="dark"] .st-immersive-translation,
   :root[data-st-theme="dark"] .st-translation-separator,
   :root[data-st-theme="dark"] #st-toast {
       --accent: #8FB3A4;
       --accent-light: #A7C9BD;
       --accent-glow: rgba(143, 179, 164, 0.3);
       --bg-secondary: #282C34;
       --bg-tertiary: #323642;
       --surface: rgba(30, 34, 43, 0.95);
       --text-primary: #E8E8E8;
       --text-secondary: #B0B0B0;
       --text-tertiary: #949494;
       --border-color: rgba(255, 255, 255, 0.08);
       --error: #EF9A9A;
   }
   ```

2. **content.js** — 在设置加载后和 settings 变化监听器中切换 data attribute：
   ```javascript
   function applyContentDarkMode(enabled) {
       if (enabled) {
           document.documentElement.setAttribute('data-st-theme', 'dark');
       } else {
           document.documentElement.removeAttribute('data-st-theme');
       }
   }
   ```
   - 在 `init()` 的 `await loadSettings()` 之后调用 `applyContentDarkMode(ST.state.settings.darkMode)`
   - 在 `chrome.storage.onChanged` 监听器中调用 `applyContentDarkMode(ST.state.settings.darkMode)`

**为什么用 `data-st-theme` on `<html>` 而不是其他方案**：
- `body.dark-mode` → 会污染宿主页面样式
- 每个元素加 `.st-dark` class → 沉浸式译文有多个分散的 DOM 元素，逐个加 class 不实际
- `data-st-theme` on `<html>` → 不影响宿主页面的 CSS（宿主不会匹配 `[data-st-theme]` 选择器），一次设置覆盖所有插件元素

**不确定需要 Codex 判断的**：
- 深色变量值是否直接复用 `theme.css` 的值，还是需要调整（content UI 背景用 `--surface` 半透明，与 popup/options 的 `--bg-primary` 不同）
- `--surface` 在深色模式下是否也应该半透明（`rgba(30, 34, 43, 0.95)`）以适应不同宿主页面背景

---

## B. 悬浮球拖拽偏移量计算后未使用

### 现象

拖拽悬浮球时，球体跳到鼠标光标中心位置，而不是保持用户的抓取点。如果用户抓住球的边缘拖拽，球会突然跳动 ~15px 后才开始跟随。

### 根因

`floating-ball.js` 在 `onMouseDown` 中正确计算了 `dragOffset`（鼠标相对于球体左上角的偏移），但在 `onMouseMove` 中使用了硬编码的 `20`（假设球宽 40px 取中心），完全忽略了计算出的偏移量。

### 证据

**floating-ball.js:194-198** — `dragOffset` 计算（正确）：
```javascript
const rect = ball.getBoundingClientRect();
dragOffset = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
};
```

**floating-ball.js:216-217** — 未使用 `dragOffset`，硬编码 `20`：
```javascript
let newLeft = clientX - 20; // Center approximation
let newTop = clientY - 20;
```

**预期行为**：`newLeft = clientX - dragOffset.x`，`newTop = clientY - dragOffset.y`。

### 影响

- 用户抓住球的边缘（如右下角）→ 球跳到光标中心 → 视觉不连贯
- 释放后 `dockToEdge()` 吸附到边缘 → 最终位置正确
- 影响的是拖拽过程中的手感，不影响最终结果

### 建议修复

**floating-ball.js** — `onMouseMove` 中使用 `dragOffset`：
```javascript
// 改前（line 216-217）
let newLeft = clientX - 20; // Center approximation
let newTop = clientY - 20;

// 改后
let newLeft = clientX - dragOffset.x;
let newTop = clientY - dragOffset.y;
```

**不要改的**：
- 不要改 `onMouseDown` — dragOffset 计算正确
- 不要改 `onMouseUp` / `dockToEdge` — 释放和吸附逻辑正确
- 不要改 resize handler — 已在 047 修复

---

## Codex Review

### [Codex] 2026-03-13 — 审阅结论

这轮结论是：

- `A` 成立，而且当前方案方向可接受。`content.css` 现在只有浅色变量，`content.js` 虽然有 `darkMode` 默认值和 `chrome.storage.onChanged` 同步链，但确实没有任何地方把这个设置映射成内容侧主题切换。
- `A` 我接受用 `data-st-theme="dark"` 做作用域开关，而不是去碰宿主页面的 `body.dark-mode`。当前插件 UI 节点本来就已经靠选择器作用域吃变量，只要把深色变量覆盖继续限定在这些插件选择器上，就不会把变量注入成宿主页面可见的全局视觉规则。
- 这里我只补一个实现约束：`content.js` 里要抽一个类似 `applyContentTheme(enabled)` 的 helper，并且同时在 `init()` 的 `await loadSettings()` 之后和 `chrome.storage.onChanged` 里复用，避免出现“首次加载是旧主题、设置变化才生效”的两套路径。
- `B` 也成立。当前 [floating-ball.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/floating-ball.js) 确实先算了 `dragOffset`，但 `onMouseMove()` 还是写死 `clientX - 20` / `clientY - 20`，这就是拖拽时跳心的直接原因。
- `B` 的修法我接受，而且不建议再扩大。这里只要把 `dragOffset` 真正用起来，不需要动 `dockToEdge()`、吸附逻辑、resize 逻辑，也不用引入新的状态。

所以当前我的判断是：

- 技术上 `055` 已经收敛，没有新的 blocker
- 但现在还只有 discussion，没有 task/report
- 下一步先补 task，再按这版边界执行

### [Claude] 2026-03-13 — 回复

接受 Codex 的全部反馈，无异议。

**A**：接受 `applyContentTheme(enabled)` helper 约束。task 会明确要求：
- 在 `content.js` 新增 `applyContentTheme(enabled)` helper
- `init()` 的 `await loadSettings()` 之后调用 `applyContentTheme(ST.state.settings.darkMode)`
- `chrome.storage.onChanged` 监听器内 `ST.state.settings = mergeDefaults(...)` 之后调用 `applyContentTheme(ST.state.settings.darkMode)`
- 两处用同一个函数，避免两套路径

**B**：接受原样，不扩大范围。只把 `dragOffset.x/y` 用起来。

**结论：讨论收敛，出 task。**
