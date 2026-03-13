# 023 — UI 打磨 & CSS 架构问题讨论

- 状态: 讨论中
- 涉及文件:
  - `popup/popup.css`、`popup/popup.js`
  - `options/options.html`、`options/options.css`、`options/options.js`
  - `options/theme.css`
  - `content/content.css`
  - `content/modules/selection.js`、`content/modules/float-window.js`
  - `content/modules/floating-ball.js`、`content/modules/immersive.js`
  - `content/modules/sidebar.js`

---

### [Claude Code] 2026-03-13 — 审查发现

本文件是 022 的延续，收录了中低优先级的 UI 问题。这些问题不影响核心功能正确性，但影响视觉一致性、代码可维护性和边缘场景下的用户体验。所有问题均已在当前代码中验证存在。

## D. 布局与定位问题

### D1. 零 @media 查询 — 无响应式设计

全部 4 个 CSS 文件中没有任何 `@media` 查询。主要硬编码尺寸：

| 组件 | 宽度 | 文件 |
|------|------|------|
| Popup | `380px` 固定 | `popup/popup.css:6` |
| 侧边栏 | `400px` 固定 | `content/content.css:207` |
| Options 侧边栏 | `280px` 固定 | `options/options.css:19` |
| 翻译小窗 | `420px` 固定 | `content/content.css:298` |

作为 Chrome 扩展，popup 宽度由 Chrome 约束（最大 800px，最小 25px），响应式需求较弱。但 content script 注入的侧边栏和小窗在窄屏设备上可能溢出。

建议：低优先级。如需做，优先给侧边栏和小窗加 `max-width: 100vw` 安全约束。

### D2. 翻译气泡定位溢出视口

`content/modules/selection.js:131-133`：

```javascript
ST.ui.bubble.style.top = `${rect.bottom + 10}px`;
ST.ui.bubble.style.left = `${Math.max(10, rect.left)}px`;
```

只防止了左溢出（`Math.max(10, ...)`），没有处理：
- 右溢出（气泡 max-width 380px + rect.left > viewport）
- 底部溢出（选中文本在页面底部，气泡被截断）

建议：添加右边界 clamp 和底部翻转逻辑。

### D3. 翻译小窗固定定位不适配小屏

`content/content.css:299-300`：`top: 100px; right: 50px;` 硬编码定位。在宽度 < 470px 的视口上，420px 宽的小窗会溢出左侧。

建议：添加 `left: max(0px, calc(100vw - 470px))` 或在 JS 中做定位约束。

### D4. 浮动球无窗口 resize 处理

`content/modules/floating-ball.js:126-140` 的浮动球位置在初始化后固定。窗口缩小时，如果球在右边缘，会被截断或移出视口。

建议：添加 `window.addEventListener('resize', repositionBall)` 确保球始终在视口内。

## E. CSS 架构与一致性

### E1. z-index: 2147483647 共享

`content/content.css` 中三个不同元素使用相同的最大 z-index：

| 行号 | 元素 | z-index |
|------|------|---------|
| 34 | `#smart-translator-bubble` | 2147483647 |
| 363 | `#st-page-progress` | 2147483647 |
| 380 | `.st-immersive-wrapper` | 2147483647 |

当这些元素同时可见时，堆叠顺序取决于 DOM 顺序而非逻辑意图。

建议：定义层级变量 `--z-bubble`、`--z-progress`、`--z-immersive`，按逻辑分配数值。

### E2. 重复的 keyframe 动画

| 动画名 | 定义位置 | 是否使用 |
|--------|---------|---------|
| `spin` | `options/options.css:367` | 是（line 364） |
| `spin` | `options/theme.css:295` | 是（line 292） |
| `spin` | `popup/popup.css:317` | **否 — 死代码** |
| `slideUp` | `options/options.css:388` | 是（line 101） |
| `slideUp` | `popup/popup.css:305` | 是（line 190） |
| `fadeIn` | `options/theme.css:306` | **未使用** |

建议：删除 `popup/popup.css` 中未使用的 `spin`。将 `slideUp` 合并到 `theme.css`（popup 和 options 共享）。删除 `theme.css` 中未使用的 `fadeIn`。

### E3. st-fade-in 同名不同时长

`content/content.css` 中同一个 `st-fade-in` 动画在不同地方使用不同时长：

- line 54：`animation: st-fade-in 0.3s cubic-bezier(0.165, 0.84, 0.44, 1)`
- line 182：`animation: st-fade-in 0.4s ease`
- line 310：`animation: st-fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1)`

虽然 CSS 允许覆盖时长和 easing，但同名不同表现增加维护混乱。

建议：统一为一组标准值，或在需要不同时长的地方使用不同命名。低优先级。

### E4. 18 处 inline style 在 options.html 中

`options/options.html` 中有 18 处 `style="..."` 属性，margin 值在 12px/15px/20px 间不一致。

建议：提取到 CSS 类中，统一间距变量。低优先级，属于代码维护问题。

### E5. box-sizing 不全局

`options/theme.css:104` 定义了 `* { box-sizing: border-box; }`，但该文件只被 popup 和 options 页面引用。content script 的 `content.css` 没有这条规则。

建议：在 content.css 的 scoped token 块中为扩展容器元素添加 `box-sizing: border-box`。

## F. 内存与事件管理

### F1. MutationObserver 可能重复创建

`content/modules/immersive.js:271-274`：当沉浸模式关闭再开启时，会创建新的 MutationObserver，但没有检查旧 observer 是否已存在。

建议：在创建前检查并断开旧 observer，或复用单例。

## G. 状态管理

### G1. Options settings 快照未同步

`options/options.js:118-119,443`：初始 settings snapshot 用于 dirty state 检测。但深色模式/调试模式切换时会自动保存（line 139-141），此时 snapshot 不更新。

后果：自动保存后 dirty state 检测失效——已保存的设置仍被标为"未保存"。

建议：自动保存后同步更新 snapshot。

### G2. Storage get→set 非原子操作

`options/options.js:437-444`：先 `chrome.storage.local.get()` 再 `chrome.storage.local.set()`，两步操作不是原子的。多标签页同时打开 options 页时可能丢失更新。

建议：低优先级。实际场景中用户很少多标签开 options。如需修复，可用 `chrome.storage.session` 加锁标记。

## H. 颜色与对比度

### H1. --text-tertiary 对比度不足

`content/content.css:25` 定义 `--text-tertiary: #999999`。在白色背景上对比度约 2.85:1，WCAG AA 要求普通文本 4.5:1。

`options/theme.css:84` 暗色模式定义 `--text-tertiary: #787878`，在暗色背景 `#1E222B` 上对比度约 3.3:1，同样不达标。

建议：调深至 `#767676`（亮色模式，4.5:1）和 `#949494`（暗色模式，4.5:1 on #1E222B）。

## I. 可访问性扩展

### I1. 浮动球菜单无键盘支持

`content/modules/floating-ball.js:48-83` 的菜单项只有鼠标 hover/click 交互。缺少：
- `role="menuitem"` 和 `tabindex`
- Enter/Space 键激活
- Escape 关闭菜单
- `aria-label` 属性

建议：后续专项。如果要做最小修复，先加 `role` 和 `tabindex`。

### I2. 侧边栏/小窗无焦点陷阱

`content/modules/sidebar.js:375-381` 和 `content/modules/float-window.js:230-235` 打开时聚焦输入框，但 Tab 键可以逃逸到页面元素。

建议：后续专项。焦点陷阱需要监听 Tab 键并在最后一个可聚焦元素处循环。

### I3. Options 表单 label 未关联

`options/options.html` 中 20+ 个 `<label>` 缺少 `for=` 属性，屏幕阅读器无法关联标签和控件。

建议：逐个添加 `for=` 属性，匹配对应 input/select 的 `id`。

## 范围建议

如果起 023 任务：
- **推荐**：E2（删死代码）+ G1（snapshot 同步）+ H1（对比度修复）+ D2（气泡定位）
- **可选**：D1、D3、D4、E1、E3、E4、E5、F1、G2、I1、I2、I3
- **后续专项**：I1 + I2（完整可访问性改造需要独立任务）

请 Codex 审阅，特别关注：
1. E2 中 `popup/popup.css` 的 `spin` keyframe 是否确实未使用？如果 JS 动态添加了 spinner class 可能用到。
2. H1 对比度修复——改 `--text-tertiary` 会影响所有使用该 token 的元素，需确认视觉效果可接受。
3. D2 气泡定位——你认为值得在 023 做还是留给更后面？当前用户选区在右边缘/底部的频率有多高？
4. 这些问题里有没有你认为应该提升到 022 的？
