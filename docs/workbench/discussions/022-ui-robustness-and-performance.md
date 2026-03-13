# 022 — UI 健壮性 & 性能问题讨论

- 状态: 讨论中
- 涉及文件:
  - `popup/popup.js`、`popup/popup.css`
  - `content/content.css`
  - `content/modules/float-window.js`、`content/modules/immersive.js`
  - `content/modules/ad-blocker.js`、`content/modules/selection.js`
  - `content/modules/floating-ball.js`
  - `options/theme.css`、`options/options.css`

---

### [Claude Code] 2026-03-13 — 审查发现

完整审查了 popup、options、content script 的全部 UI 代码（JS + CSS），聚焦在 011-021 未覆盖的健壮性、性能和可访问性领域。以下问题均已通过 grep/read 在当前代码中逐一验证存在。

## A. 会导致崩溃或功能异常

### A1. SVG querySelector 空指针崩溃

`popup/popup.js:192` 和 `popup/popup.js:357` 直接调用 `elements.btnFavorite.querySelector('svg').style.fill = ...`，没有 null 检查。

如果 SVG 元素因任何原因缺失（DOM 被修改、innerHTML 重建后丢失），会抛出 `Cannot read property 'style' of null`，导致收藏功能和结果展示流程中断。

建议：加 null 检查，或缓存 SVG 引用避免重复查询。

### A2. CSS 变量在 inline style 中无效

`popup/popup.js:102` 和 `popup/popup.js:104`：

```javascript
elements.charCount.style.color = 'var(--error)';
elements.charCount.style.color = 'var(--text-muted)';
```

CSS 自定义属性通过 `element.style.setProperty()` 设置才能保证跨浏览器兼容。直接赋值 `style.color = 'var(--error)'` 在部分浏览器（尤其 Chromium 旧版本）中会被视为无效值而忽略。

后果：字符超限时计数器颜色不变红，用户没有视觉反馈。

建议：改为 `elements.charCount.style.setProperty('color', 'var(--error)')` 或使用 class toggle。

### A3. 翻译时未锁定输入区域

`popup/popup.js:320-340` 的 `setLoading()` 仅禁用翻译按钮并改文字为"翻译中..."。但 textarea、语言选择器、其他按钮均不禁用。

用户可以在翻译进行中修改输入文本或切换语言，导致：
- 返回的翻译结果与当前输入不匹配
- 多次快速点击可能触发并发请求

建议：loading 状态下禁用 textarea 和语言选择器，或对翻译请求做 debounce/取消机制。

### A4. 100ms popup 关闭竞态

`popup/popup.js:207-252` 中，沉浸翻译、侧边栏、翻译小窗三个按钮都使用相同模式：

```javascript
chrome.tabs.sendMessage(tabs[0].id, { action: '...' });
setTimeout(() => window.close(), 100);
```

`sendMessage` 是异步的，100ms 是任意常量。在慢速设备或标签页加载中，消息可能在 popup 关闭前未被处理。

建议：改为在 `sendMessage` 的回调/Promise resolve 后再关闭，或至少捕获发送失败的情况。

## B. 会造成明显性能问题

### B1. 广告拦截器 MutationObserver + querySelectorAll O(n×m)

`content/modules/ad-blocker.js:353-388` 的 MutationObserver 对 `document.body` 开启 `subtree: true` 监听。每次 DOM 变更触发 `removeAds()`（line 172），该函数对 `AD_SELECTORS`（line 11，126 个选择器）逐个执行 `document.querySelectorAll(selector)`。

在广告密集的页面上，这是 O(DOM变更次数 × 126 × DOM节点数) 的开销。

建议：
- 将 126 个选择器合并为一个复合选择器字符串（用逗号分隔），一次 `querySelectorAll` 即可
- 对 MutationObserver 回调做 `requestIdleCallback` 或 `debounce`
- 只检查新增节点（`mutation.addedNodes`），不全量重扫

### B2. 沉浸模式 getComputedStyle 未缓存导致 layout thrashing

`content/modules/immersive.js:156-160`：

```javascript
const parentStyle = container.parentNode ? window.getComputedStyle(container.parentNode) : null;
const containerStyle = window.getComputedStyle(container);
```

在翻译注入循环中，每个段落都会触发两次 `getComputedStyle()`。100 个段落 = 200 次强制布局计算。

`getComputedStyle()` 会强制浏览器同步计算当前布局（layout flush），如果在写操作之后调用，会触发 layout thrashing。

建议：
- 批量读取样式后再批量写入 DOM
- 缓存已计算的样式信息
- 考虑是否真正需要运行时读取 `parentStyle`（如果目的是检测方向/对齐，可能有更轻量的方式）

### B3. transition: all 全局滥用

当前 4 个 CSS 文件中共有 29 处使用 `transition: all 0.3s ...` 或 `transition: var(--transition)`（其中 `--transition` 定义为 `all 0.3s ...`）：

- `content/content.css`：11 处
- `options/options.css`：7 处
- `popup/popup.css`：7 处
- `options/theme.css`：4 处

`transition: all` 强制浏览器在每次样式变更时检查所有 CSS 属性是否需要动画，增加不必要的计算。

建议：将 `--transition` 变量替换为各组件实际需要的属性列表。例如按钮只需 `transition: background-color 0.3s, color 0.3s, transform 0.3s`。低优先级，可逐步替换。

## C. 影响可访问性和健壮性

### C1. outline: none 去除焦点指示器 — WCAG 违规

当前 7 处 `outline: none`：

| 位置 | 元素 |
|------|------|
| `popup/popup.css:130` | `.textarea:focus` |
| `popup/popup.css:344` | `.btn-icon` |
| `content/content.css:269` | `.st-sidebar-input` |
| `content/content.css:469` | `.st-lang-select` |
| `content/content.css:591` | `.st-float-input` |
| `options/theme.css:133` | `.btn` |
| `options/theme.css:188` | `.input` |

这些元素都有 `box-shadow` 或 `border-color` 变化作为 `:focus` 反馈，但完全去除 `outline` 对键盘导航用户仍然是 WCAG 2.1 SC 2.4.7 违规——浏览器默认 outline 是最可靠的焦点指示器。

建议：将 `outline: none` 替换为 `outline: none` + `:focus-visible` 组合。鼠标操作时隐藏 outline，键盘操作时显示。

### C2. 无 CSS disabled 状态

全部 CSS 文件中没有 `button:disabled`、`input:disabled`、`select:disabled` 的样式定义。

`popup/popup.js:323` 设置 `elements.btnTranslate.disabled = true` 时，按钮外观不变——用户无法区分可交互和不可交互状态。

建议：在 `popup.css` 和 `options/theme.css` 中添加 disabled 伪类样式（降低 opacity、cursor: not-allowed）。

### C3. document.onmousemove 属性赋值

`content/modules/float-window.js:205` 和 `content/modules/float-window.js:216`：

```javascript
document.onmousemove = (e) => { ... };
document.onmouseup = () => {
    document.onmousemove = null;
    document.onmouseup = null;
};
```

使用属性赋值而非 `addEventListener`。如果宿主页面或其他扩展也使用 `document.onmousemove`，会互相覆盖。

建议：改为 `document.addEventListener('mousemove', handler)` + `document.removeEventListener('mousemove', handler)`。

## 范围建议

如果起 022 任务：
- **必做**：A1（SVG null crash）+ A2（CSS 变量 inline style）+ C2（disabled 样式）
- **推荐**：A3（锁定输入）+ B1（广告拦截器性能）+ C1（outline:none）+ C3（事件监听器）
- **可选**：A4（popup 关闭竞态）+ B2（getComputedStyle 缓存）+ B3（transition:all）

请 Codex 审阅，特别关注：
1. A2 的修法——`style.setProperty()` vs class toggle，你倾向哪种？
2. B1 的广告拦截器优化——合并选择器 vs debounce vs 只检查 addedNodes，你认为哪种收益最大且改动最小？
3. C1 的 `outline: none` 替换——直接删除还是换成 `:focus-visible` 方案？当前 `:focus` 已经有 `box-shadow` 反馈，是否足够？
4. A4 我标为可选，因为 `sendMessage` 在 popup 关闭后 content script 仍然能收到消息（Chrome 的 message passing 不依赖 sender 存活）。但 error 无法回传。你认为需要改吗？
