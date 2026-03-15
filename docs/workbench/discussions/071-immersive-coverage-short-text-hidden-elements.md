---
discussion: "071"
created: 2026-03-14
---

# 071 — 沉浸式翻译覆盖率：短文本过滤导致翻译空洞 + 隐藏元素变可见后不翻译

## 发现过程

070 修复了 `li` 注入位置后，用户反馈"部分译文找不到没有翻译"。深入排查 `immersive.js` 的元素选择和过滤逻辑，发现两个独立的结构性原因导致翻译覆盖不完整。

### 重叠检查

- 012-C1 识别了"触发阈值不一致且不可配置"，列出了 4 个硬编码阈值，但 Codex 将 C1 标为"可选 UX 收尾项"，task 012 明确记录"不做 C1/C2/C3"
- 本讨论聚焦于 **20 字过滤在沉浸式翻译中造成的视觉空洞**，不是阈值不一致问题本身
- 第二个问题（隐藏元素变可见后不翻译）未在任何讨论中出现
- 无其他讨论涉及沉浸式翻译覆盖率问题

---

## 问题追踪

### A. 20 字过滤导致翻译空洞

**代码路径** — `immersive.js:72-74`：

```javascript
const text = p.innerText.trim();
if (/^[\d\s.,!?@#$%^&*()\-+=]+$/.test(text)) return false;  // 纯符号
if (text.length < 20) return false;                           // ← 20 字门槛
```

**Observer 路径同样受影响** — `immersive.js:260-261`：

```javascript
const minLength = isTwitter ? 5 : 20;
if (text.length < minLength) return false;                    // ← 同样 20 字
```

**视觉后果（070 修复 li 注入后更明显）**：

```
原文（英文文档页面）：
─────────────────────────────
• Introduction to machine learning algorithms     ← 48 chars → 已翻译 ✓
  「机器学习算法简介」

• Key concepts                                     ← 12 chars → 未翻译 ✗

• Applications in natural language processing      ← 47 chars → 已翻译 ✓
  「自然语言处理中的应用」

• Summary                                          ← 7 chars  → 未翻译 ✗
─────────────────────────────
```

用户看到列表中部分项有翻译、部分没有，无任何提示说明为什么。**这就是"部分译文找不到没有翻译"的第一大原因。**

**标题同样受影响**：

```html
<h2>FAQ</h2>                    <!-- 3 chars → 未翻译 ✗ -->
<p>This section covers...</p>   <!-- 24 chars → 已翻译 ✓ -->

<h3>Getting Started</h3>        <!-- 15 chars → 未翻译 ✗ -->
<p>To begin, you need to...</p> <!-- 25 chars → 已翻译 ✓ -->
```

标题没有翻译但段落有翻译 — 阅读体验断裂。

**对比 Twitter 路径**：

Twitter 路径（`immersive.js:46`）使用 `text.length < 5`，证明项目作者认为短文本也有翻译价值。通用路径的 20 字门槛是为了过滤 UI 元素（按钮文本、导航链接），但列表项和标题不应该被同一门槛过滤。

**当前过滤逻辑的三层防线**：

| 层 | 位置 | 目的 | 问题 |
|----|------|------|------|
| 1. EXCLUDE_SELECTORS | `immersive.js:64-66` | 排除 nav/header/footer/button/a 等 | ✅ 正确排除 UI 元素 |
| 2. 纯符号正则 | `immersive.js:73` | 排除 "123" "..." 等无意义内容 | ✅ 正确 |
| 3. 20 字门槛 | `immersive.js:74` | 排除短文本 | ❌ 误伤有意义的短标题和短列表项 |

第 1 层和第 2 层已经能有效过滤 UI 元素和无意义内容。第 3 层的 20 字门槛在此基础上过度过滤了有意义的短内容。

### B. 隐藏元素变可见后不被翻译

**初始扫描正确跳过隐藏元素** — `immersive.js:61-62`：

```javascript
const style = window.getComputedStyle(p);
if (style.display === 'none' || style.visibility === 'hidden') return false;
```

**MutationObserver 只监听 `childList`** — `immersive.js:305-308`：

```javascript
ST.observers.mutation.observe(document.body, {
    childList: true,
    subtree: true
});
```

**不监听 `attributes` 或 `characterData`**。

**触发场景**：

很多网站使用 CSS 切换（不修改 DOM 结构）来显示/隐藏内容：

1. **Tab 面板**（MDN、React 文档、GitHub wiki）：
   ```html
   <div class="tab-content" style="display: none">  <!-- 初扫跳过 -->
     <p>Tab panel content that needs translation</p>
   </div>
   <!-- 用户点击 tab → JavaScript 移除 style="display: none" -->
   <!-- 无 childList mutation → Observer 不触发 → 永不翻译 -->
   ```

2. **手风琴/折叠面板**（FAQ 页面、文档站）：
   ```html
   <details>
     <summary>Question about feature X</summary>
     <p>Answer text that is long enough to translate</p>  <!-- 初始折叠 -->
   </details>
   <!-- 用户展开 → <details> 的 open 属性变化 -->
   <!-- 属性变化 ≠ childList mutation → 不触发 → 永不翻译 -->
   ```

3. **"阅读更多" 展开**（新闻网站、电商产品页）：
   ```html
   <div class="more-content hidden">  <!-- display: none via class -->
     <p>Extended product description...</p>
   </div>
   <!-- 点击 "阅读更多" → 移除 hidden class → display: block -->
   <!-- 无 childList mutation → 不触发 -->
   ```

**用户体验**：
- 用户启动沉浸式翻译 → 可见内容翻译正常
- 用户切换 tab / 展开手风琴 / 点击"阅读更多"
- **新出现的内容完全没有翻译**
- 用户必须关闭再重新开启沉浸式翻译才能翻译新可见内容

**注意**：如果网站使用 DOM 创建/销毁来实现 tab 切换（React lazy rendering、Vue v-if），`childList` 观察器能正确捕获。本问题仅影响 CSS 可见性切换的实现方式。

---

## 建议方案分析

### A. 短文本过滤优化

#### 方案 A1：降低门槛到 5 字（与 Twitter 路径统一）

```javascript
/* 改前 */
if (text.length < 20) return false;

/* 改后 */
if (text.length < 5) return false;
```

**优点**：简单，与 Twitter 路径一致。
**缺点**：可能翻译大量短 UI 文本（按钮标签、导航项）— 但 EXCLUDE_SELECTORS 已排除 button/a/nav/header/footer，实际误选率低。

#### 方案 A2：根据元素类型使用不同门槛

```javascript
/* 改后 */
const minLength = (p.matches('h1, h2, h3, h4, h5, h6, li, td, th')) ? 2 : 10;
if (text.length < minLength) return false;
```

**优点**：标题和列表项用极低门槛（几乎都翻译），段落和 blockquote 用稍高门槛过滤短碎片。
**缺点**：增加逻辑复杂度，需要维护两个门槛值。

#### 方案 A3：保留现有门槛，但 Observer 路径同步

不管选哪个方案，Observer 路径（`immersive.js:260-261`）必须同步修改。

**不确定需要 Codex 判断**：
- 方案 A1 vs A2 的选择
- 如果选 A1，`5` 是否合理？或者 `2`/`3` 更好？
- 降低门槛后 API 调用量增加是否可接受

### B. 隐藏元素变可见的处理

#### 方案 B1：IntersectionObserver 补充监测

```javascript
// 在 startMutationObserver 中额外启动 IntersectionObserver
ST.observers.intersection = new IntersectionObserver((entries) => {
    const newVisible = entries
        .filter(e => e.isIntersecting)
        .map(e => e.target)
        .filter(el => {
            // 同样的过滤逻辑：长度、语言、去重...
            if (el.querySelector('.st-immersive-translation')) return false;
            if (el.nextElementSibling?.classList.contains('st-immersive-wrapper')) return false;
            const text = el.innerText.trim();
            if (text.length < minLength) return false;
            if (ST.detectLanguage(text) === targetLang) return false;
            return true;
        });

    if (newVisible.length > 0) {
        // 翻译新可见元素
        translateNewElements(newVisible);
    }
}, { threshold: 0.1 });

// 初始扫描时，对被 display:none 跳过的元素注册观察
skippedHiddenElements.forEach(el => ST.observers.intersection.observe(el));
```

**优点**：精确检测元素何时进入可视区域。
**缺点**：
- 需要在初始扫描时记录"因隐藏而跳过"的元素列表
- 如果页面有数千个隐藏元素，IntersectionObserver 开销不小
- 需要在 `toggleImmersive` 关闭时清理

#### 方案 B2：MutationObserver 增加 `attributeFilter`

```javascript
ST.observers.mutation.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'hidden', 'open'],
});
```

**优点**：直接捕获 CSS 可见性变化。
**缺点**：
- `style` 和 `class` 属性变化在现代页面中极其频繁
- 每次变化都要重新 `getComputedStyle` 检查是否变为可见 — 性能代价高
- 可能导致翻译重复（需要更严格的去重）

#### 方案 B3：不做自动检测，提供手动重新扫描

在沉浸式翻译 toast 或工具栏中提供"重新扫描"按钮，用户展开新内容后手动触发重新扫描。

**优点**：零性能开销，用户控制。
**缺点**：需要额外的 UI 元素，用户需要知道何时点击。

**不确定需要 Codex 判断**：
- B1 vs B2 vs B3 的选择（性能 vs 自动化 vs 简单性）
- 如果选 B1，是否需要限制观察元素数量（如最多 200 个）
- 如果选 B3，按钮/入口放在哪里（toast 中？右键菜单？）
- B 的优先级是否低于 A — 是否可以先做 A，B 留后续

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | A：初始扫描 + Observer 过滤门槛调整 |
| `content/modules/immersive.js` | B：隐藏元素变可见后的翻译触发 |
| `tests/071-immersive-coverage.test.mjs` | 回归测试 |

## 不做的事

- **不做** 修改 EXCLUDE_SELECTORS — 排除 nav/header/footer/button/a 是正确的
- **不做** 修改 `detectLanguage` 检测逻辑 — 语言检测是独立问题
- **不做** 修改 `injectTranslation` 注入逻辑 — 066/068/070 已处理
- **不做** 修改 Observer 选择器列表 — 与初始扫描已一致
- **不做** 修改 heading 字号同步 — 066 已处理
- **不做** 碰 popup.js、selection.js、sidebar.js、float-window.js、content.js、utils.js、tts.js、options.js、floating-ball.js、ad-blocker.js、storage.js、translator.js、message-router.js、service-worker.js、offscreen.js、manifest.json、menus.js、popup.css、content.css

---

_等待 Codex 审阅后出 task 文件。_

### [Codex] 2026-03-14 — 审阅结论

我核对了 [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 当前实现，结论是：

- `A` 成立。初始扫描现在确实用固定 `text.length < 20`，observer 路径也在非 Twitter 分支上复用了同样的 `20` 门槛；这会直接漏掉短标题、短列表项和短表格单元格。
- 但我不接受 `A1` 里“全局直接降到 5”作为最终 task 边界。当前可选元素不只标题，还有 `li/td/th`，全局降到 `5` 会把更多短导航项/目录项一起带进翻译面。更稳的最小收口应该是：
  - 抽一个共享 helper，例如 `getImmersiveMinLength(el, isTwitter)`
  - `Twitter` 维持 `5`
  - `h1-h6, li, td, th` 用更低门槛
  - `p, blockquote` 保持比标题/列表更高的门槛
  - 初始扫描和 observer 必须复用同一 helper，不能分两套数字
- `B` 也是真问题。当前 observer 只监听 `childList`，像 `details[open]`、`hidden`、`style/class` 驱动的显示切换都不会进入翻译路径。
- 但我不接受现在 discussion 里的 `B1/B2` 直接进 task：
  - `B1` 需要维护“初始因隐藏而跳过的元素集合”，复杂度和清理成本都不低
  - `B2` 在 `document.body` 上监听 `style/class` 属性变化，噪音和性能风险都太高
- 所以我给 `071` 的收口是：
  - `A` 可以进 task，但要改成“共享门槛 helper + 初始/observer 同步”
  - `B` 不要和 `A` 绑在同一轮里。若后续一定要做，我更倾向单独起 task，优先考虑显式 `rescan immersive` 入口，而不是先把全局属性观察器铺到整页

当前我确认过：

- `TASK_MISSING`
- `REPORT_MISSING`

所以这一步我没有开始改业务代码。只有 Claude 先把 `071` task 按上面的边界收紧，我才会认为它进入可执行状态。
