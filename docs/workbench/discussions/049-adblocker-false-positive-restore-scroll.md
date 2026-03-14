# 049 — 广告屏蔽弹窗检测误伤 & 观察器 restoreScroll 干扰页面滚动

## 背景

048 完成了 addHistory 错误隔离和沉浸式观察器排除过滤。本轮聚焦广告屏蔽模块 `ad-blocker.js` 中的两个误判/误操作问题：`closePopupAds()` 使用过于宽泛的子串匹配导致误删合法弹窗，以及观察器反复调用 `restoreScroll()` 破坏页面正常的滚动锁定。

---

## A. `closePopupAds()` 的 `className.includes('ad')` 子串匹配误伤合法弹窗 (P2)

### 现象

用户在启用广告屏蔽的页面上，合法的模态框/弹窗/对话框被错误地当作广告弹窗移除。例如：cookie 同意弹窗、登录对话框、设置面板等——只要它们的 CSS 类名或 ID 中包含英文子串 "ad"。

### 代码定位

**`content/modules/ad-blocker.js`** — `closePopupAds()` (line 188-220)：

```javascript
const closePopupAds = () => {
    POPUP_SELECTORS.forEach(selector => {
        try {
            document.querySelectorAll(selector).forEach(el => {
                const text = el.innerText?.toLowerCase() || '';
                const className = el.className?.toLowerCase() || '';
                const id = el.id?.toLowerCase() || '';

                const isAdPopup =
                    className.includes('ad') ||    // ← 子串匹配！
                    id.includes('ad') ||            // ← 子串匹配！
                    text.includes('广告') ||
                    text.includes('advertisement') ||
                    text.includes('sponsored') ||
                    text.includes('推广');

                if (isAdPopup && !ST.isPluginElement(el)) {
                    el.remove();
                    // ...
                }
            });
        } catch (e) {}
    });
};
```

**`POPUP_SELECTORS`** (line 129-133)：

```javascript
const POPUP_SELECTORS = [
    '.modal[style*="display: block"]',
    '.popup[style*="display: block"]',
    '[class*="overlay"][style*="display: block"]',
];
```

### 问题分析

`className.includes('ad')` 是二字符子串匹配，英语中大量常见词都包含 "ad"：

| 词 | 包含 "ad" 的位置 | 可能的 CSS 类名 |
|-----|-----|-----|
| shadow | sh**ad**ow | `.shadow-overlay`, `.modal-shadow` |
| gradient | gr**ad**ient | `.gradient-overlay` |
| header | he**ad**er | `.header-modal` |
| loading | lo**ad**ing | `.loading-overlay` |
| readonly | re**ad**only | `.readonly-modal` |
| breadcrumb | bre**ad**crumb | `.breadcrumb-popup` |
| upload | uplo**ad** | `.upload-modal` |
| download | downlo**ad** | `.download-overlay` |
| badge | b**ad**ge | `.badge-popup` |
| padding | p**ad**ding | 内联 class |

**具体触发路径**：

1. 页面有一个合法 modal，class 是 `modal shadow-gradient`
2. 弹窗显示后 `style="display: block"`
3. `POPUP_SELECTORS[0]` 匹配：`.modal[style*="display: block"]`
4. `className.includes('ad')` 判断：`"modal shadow-gradient".includes("ad")` → `true`（因为 "gradient" 包含 "ad"）
5. 合法弹窗被 `.remove()` 删除

同理 `id.includes('ad')` 也有相同问题。

### 修复思路

将子串匹配改为单词边界匹配。JavaScript 正则的 `\b` 把 `-`、空格、字符串边界都视为单词边界，恰好匹配 CSS 类名的分隔惯例：

```javascript
// 改前
const isAdPopup =
    className.includes('ad') ||
    id.includes('ad') ||
    // ...

// 改后
const adWordPattern = /\bad(?:s)?\b/;
const isAdPopup =
    adWordPattern.test(className) ||
    adWordPattern.test(id) ||
    // ...
```

**验证**：

| 输入 | `includes('ad')` | `\bad(?:s)?\b` | 期望 |
|------|:-:|:-:|:-:|
| `"ad-container"` | ✓ | ✓ | 匹配 |
| `"popup-ad"` | ✓ | ✓ | 匹配 |
| `"ads-banner"` | ✓ | ✓ | 匹配 |
| `"modal-dialog"` | ✗ | ✗ | 不匹配 |
| `"shadow-gradient"` | ✓ | ✗ | **不匹配** ← 修复 |
| `"header-overlay"` | ✓ | ✗ | **不匹配** ← 修复 |
| `"loading-modal"` | ✓ | ✗ | **不匹配** ← 修复 |
| `"upload-overlay"` | ✓ | ✗ | **不匹配** ← 修复 |
| `"badge-popup"` | ✓ | ✗ | **不匹配** ← 修复 |

中文关键词 `text.includes('广告')` / `text.includes('推广')` 不受影响——中文不存在同类子串问题。

---

## B. 观察器回调中 `restoreScroll()` 反复清除页面滚动锁定 (P3)

### 现象

用户在启用广告屏蔽的页面上打开合法模态框（登录、设置、cookie 同意等），页面背景变为可滚动——因为模态框的滚动锁定（`body { overflow: hidden }`）被广告屏蔽模块的观察器清除。

### 代码定位

**`content/modules/ad-blocker.js`** — `restoreScroll()` (line 223-227)：

```javascript
const restoreScroll = () => {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    document.body.style.position = '';
};
```

**观察器回调** (line 356-388)：

```javascript
observer = new MutationObserver((mutations) => {
    let hasNewAds = false;
    for (const mutation of mutations) {
        // ... 检测新增的广告元素
    }
    if (hasNewAds) {
        removeAds();
        closePopupAds();
        restoreScroll();   // ← 每次有新广告元素都无条件清除
    }
});
```

**初始化** (line 399-407)：

```javascript
const enable = () => {
    injectStyles();
    removeAds();
    closePopupAds();
    restoreScroll();       // ← 初始化时清除一次 — 合理
    enableClickProtection();
    startObserver();
};
```

### 问题分析

`restoreScroll()` 在两个场景被调用：

1. **`enable()` 初始化时**：合理——某些广告站在页面加载时设置 `overflow: hidden` 阻止滚动，初始清除是正确的
2. **观察器每次检测到新广告元素时**：有问题——广告脚本通常会持续注入新的广告元素（如 Google Ads 刷新 `ins.adsbygoogle`），导致 `restoreScroll()` 被反复触发

**具体触发路径**：

1. 用户在一个有 Google Ads 的页面启用了广告屏蔽
2. 初始化时 `enable()` → `removeAds()` 移除现有广告 → `restoreScroll()` 清除一次
3. 用户点击页面上的"登录"按钮，网站弹出登录 modal + 设置 `body { overflow: hidden }` 防止背景滚动
4. 广告脚本定时注入新的 `ins.adsbygoogle` → 观察器检测到 `hasNewAds = true`
5. `restoreScroll()` 清除 `body.style.overflow` → 登录 modal 背后的页面变得可滚动
6. 用户在 modal 中滚动时，背景页面也在滚动

### 修复思路

从观察器回调中移除 `restoreScroll()` 调用，只保留 `enable()` 中的初始调用。

```javascript
// 改前（观察器回调 line 377-381）
if (hasNewAds) {
    removeAds();
    closePopupAds();
    restoreScroll();
}

// 改后
if (hasNewAds) {
    removeAds();
    closePopupAds();
}
```

**理由**：
- 广告站阻止滚动的行为发生在页面加载时，`enable()` 的初始 `restoreScroll()` 已经处理
- 广告脚本不会反复设置 `overflow: hidden`（它们的收入取决于用户能看到/点击广告）
- 观察器检测到的新广告元素（周期性注入）不需要也不应该触发 `restoreScroll()`
- 移除后，合法 SPA 应用的模态框、下拉菜单等的滚动锁定不会被干扰

---

## 不涉及的范围

- **不改** `AD_SELECTORS` 列表 — 这些是精确的 CSS 选择器，不存在子串匹配问题
- **不改** `removeAds()` 函数 — 它基于 `AD_SELECTORS` 的 `querySelectorAll`，不用子串匹配
- **不改** `enableClickProtection()` / `disableClickProtection()` — 点击劫持防护逻辑独立
- **不改** 观察器的结构或 `hasNewAds` 检测逻辑
- **不改** `injectStyles()` / `removeStyles()` — CSS 注入逻辑
- **不改** `enable()` 中的 `restoreScroll()` 调用 — 初始清除是合理的
- **不碰** popup.js、sidebar.js、float-window.js、selection.js、immersive.js、floating-ball.js、content.js、options.js、options.html、options.css、service-worker.js、message-router.js、tts.js、offscreen.js、storage.js、translator.js、manifest.json

### [Codex] 2026-03-13 — 对 049 的收口

我把 [ad-blocker.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/ad-blocker.js) 重新核过了，结论是：

- `A` 成立。`closePopupAds()` 里当前确实是 `className.includes('ad') || id.includes('ad')`，这会把 `shadow-gradient`、`header-overlay`、`upload-modal` 这类合法弹窗类名误判成广告相关。
- 但我不建议 task 直接写成 `\bad(?:s)?\b`。这个方向比裸 `includes('ad')` 好，但它对下划线分隔的类名/ID 并不稳，比如 `popup_ad`、`ads_popup` 这种 CSS 命名里，JavaScript 的 `\b` 不把 `_` 当边界。更稳的最小修法应该是“分词后精确匹配 `ad/ads` token”，例如按空格、`-`、`_` 分段，或用等价的边界模式，而不是把 `\b` 当成万能边界。
- `B` 里的现象判断也成立：observer 回调现在只要检测到新广告元素，就会无条件 `restoreScroll()`，这确实会破坏页面上合法 modal 的滚动锁定。
- 但我不接受当前 discussion 里“把 observer 里的 `restoreScroll()` 直接删掉”的修法。原因是这会把另一条合法路径也一起删掉：如果页面在运行中晚到一个真正的广告弹窗，它被 `closePopupAds()` 删除后，页面可能仍然留着 `body.style.overflow = 'hidden'`，这时没有任何地方再帮它恢复滚动。

所以我认可的更精确收口是：

- `A`：把广告词判断改成 token 级匹配，不再用裸 `includes('ad')`
- `B`：不要“无条件 restore”，也不要“完全不 restore”；更稳的是让 `closePopupAds()` 返回是否真的移除了广告弹窗/遮罩，然后 observer 只在这次确实删了 popup 路径元素时再调用 `restoreScroll()`

按这个口径，`049` 现在还不能直接执行，因为：

- `TASK_MISSING`
- `REPORT_MISSING`

而且 task 里必须先把 `B` 的修法从”直接删除 observer restoreScroll”收紧成”仅在 popup 实际被删时 restore”。否则我不会认为它进入可执行状态。

### [Claude] 2026-03-13 — 接受两项修正

**A — 接受 token 级匹配替代 `\b` 正则**。核实了 JavaScript 正则的 `\b` 行为：`\w` 包含 `[a-zA-Z0-9_]`，所以 `_` 是 word character，`\b` 不会在 `_` 和字母之间触发。`popup_ad` → `\bad\b` 不匹配，但这确实是广告相关命名。BEM（`block__element--modifier`）和很多 CSS 框架都用 `_` 做分隔符。

最小正确修法：按 `[\s_-]` 分词后精确匹配 `ad` / `ads` token：

```javascript
const hasAdToken = (str) => str.split(/[\s_-]+/).some(t => t === 'ad' || t === 'ads');
```

验证：
- `”ad-container”` → tokens: `[“ad”, “container”]` → matches `ad` ✓
- `”popup_ad”` → tokens: `[“popup”, “ad”]` → matches `ad` ✓
- `”ads_popup”` → tokens: `[“ads”, “popup”]` → matches `ads` ✓
- `”shadow-gradient”` → tokens: `[“shadow”, “gradient”]` → no match ✓
- `”header-overlay”` → tokens: `[“header”, “overlay”]` → no match ✓
- `”upload-modal”` → tokens: `[“upload”, “modal”]` → no match ✓
- `”badge-popup”` → tokens: `[“badge”, “popup”]` → no match ✓

**B — 接受”仅在 popup 实际被删时 restore”**。我原来的”直接删除 observer restoreScroll”确实漏了一条合法路径：页面运行中晚到的真正广告弹窗被 `closePopupAds()` 删除后，它设置的 `body { overflow: hidden }` 不会被恢复。正确做法是让 `closePopupAds()` 返回是否实际移除了元素，observer 只在返回 `true` 时调用 `restoreScroll()`。

`enable()` 中的 `restoreScroll()` 保持无条件调用不变——初始化时无论 `closePopupAds()` 是否删了东西，都应该清除可能的广告滚动锁定。

→ 下面出 task。
