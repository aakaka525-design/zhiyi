# 053 — 沉浸式翻译文本触发划词翻译 & options 开关静默保存全部设置

## 背景

052 完成了双击 icon/bubble 重叠修复和翻译小窗 clamp + resize 监听。本轮聚焦两个交互缺陷：沉浸式翻译注入的译文触发划词翻译（重复翻译已翻译内容），以及 options 页面切换深色模式/调试模式时静默保存所有未保存的设置更改。

---

## A. 沉浸式翻译文本触发划词翻译（重复翻译） (P3)

### 现象

用户启用沉浸式翻译后，页面出现双语对照译文。用户在译文（绿色文本）上划词或双击，翻译图标/气泡出现，发起对已翻译文本的二次翻译。例如："Hello" 被沉浸式翻译为 "你好"，用户双击 "你好" → 气泡弹出 → 翻译 "你好" 为 "Hello"。

### 代码定位

**`content/modules/utils.js`** — `isPluginElement` (line 120-128)：

```javascript
ST.isPluginElement = function (el) {
    return el.id === 'smart-translator-icon' ||
        el.id === 'smart-translator-bubble' ||
        el.closest('#smart-translator-bubble') ||
        el.closest('#st-sidebar') ||
        el.closest('#st-float-window') ||
        el.closest('#st-floating-ball-container') ||
        el.closest('#st-toast');
};
```

**`content/modules/immersive.js`** — 注入译文的三种 DOM 元素：

1. Block 模式：`<div class="st-immersive-wrapper"> → <div class="st-immersive-translation">译文</div></div>` — 插入在原文段落后面（sibling）
2. Inline 模式（flex/grid/inline）：`<span class="st-translation-separator">` + `<span class="st-immersive-translation">译文</span>` — 追加在原文容器内部（child）
3. 进度条：`#st-page-progress` — 已在 CSS 中声明但未在 `isPluginElement` 中检查（不影响划词）

**`content/modules/selection.js`** — 使用 `isPluginElement` 的三处：

1. `handleMouseUp` (line 14)：`if (ST.isPluginElement(e.target)) return;`
2. `handleDoubleClick` (line 55)：`if (ST.isPluginElement(e.target)) return;`
3. `handleMouseDown` (line 40)：`if (!ST.isPluginElement(e.target)) { ST.removeBubble(); ST.removeIcon(); }`

### 问题分析

`isPluginElement` 只检查 bubble、sidebar、float-window、floating-ball、toast 五类元素。沉浸式翻译的三类元素（`.st-immersive-translation`、`.st-immersive-wrapper`、`.st-translation-separator`）不在检查范围内。

**触发路径 — Block 模式**：

1. 沉浸式翻译注入 `<div class="st-immersive-wrapper"><div class="st-immersive-translation">你好</div></div>`
2. 用户双击 "你好" → `e.target` = `div.st-immersive-translation`
3. `handleDoubleClick` → `isPluginElement(div.st-immersive-translation)` → `false`（不匹配任何已注册的选择器）
4. `text = "你好"` → `showBubble("你好")` → 发送翻译请求 → "你好" 被翻译回 "Hello"
5. 用户看到已翻译的内容被二次翻译

**触发路径 — Inline 模式**：

1. 沉浸式翻译在原文 `<li>` 内追加 `<span class="st-translation-separator"> → </span><span class="st-immersive-translation">你好</span>`
2. 用户选中 "你好" → `e.target` = `span.st-immersive-translation`
3. `handleMouseUp` → `isPluginElement(span.st-immersive-translation)` → `false`
4. `text.length >= 5` 时 → `showBubble()` → 二次翻译
5. `text.length < 5` 时 → `showIcon()` → 用户点击图标 → 二次翻译

**额外问题**：`handleMouseDown` 对沉浸式译文也不拦截，但 `handleMouseDown` 的行为是"非插件元素点击 → 移除 bubble/icon"，这对译文来说是正确的。所以 `handleMouseDown` 不需要改。

### 修复思路

在 `isPluginElement` 中增加沉浸式翻译元素的检查：

```javascript
// 改前 (line 120-128)
ST.isPluginElement = function (el) {
    return el.id === 'smart-translator-icon' ||
        el.id === 'smart-translator-bubble' ||
        el.closest('#smart-translator-bubble') ||
        el.closest('#st-sidebar') ||
        el.closest('#st-float-window') ||
        el.closest('#st-floating-ball-container') ||
        el.closest('#st-toast');
};

// 改后
ST.isPluginElement = function (el) {
    return el.id === 'smart-translator-icon' ||
        el.id === 'smart-translator-bubble' ||
        el.closest('#smart-translator-bubble') ||
        el.closest('#st-sidebar') ||
        el.closest('#st-float-window') ||
        el.closest('#st-floating-ball-container') ||
        el.closest('#st-toast') ||
        el.closest('.st-immersive-wrapper') ||
        el.classList?.contains('st-immersive-translation') ||
        el.classList?.contains('st-translation-separator');
};
```

行为说明：

- `el.closest('.st-immersive-wrapper')` — 覆盖 block 模式下 wrapper 内部所有元素
- `el.classList?.contains('st-immersive-translation')` — 覆盖 inline 模式下直接在原文容器内的翻译 span（`closest('.st-immersive-wrapper')` 找不到，因为 inline 模式没有 wrapper）
- `el.classList?.contains('st-translation-separator')` — 覆盖 inline 模式下的分隔符 span
- `?.` 防御性调用：`classList` 在 SVG 元素等非标准元素上可能不存在

**对现有代码的影响**：

- `immersive.js` 的观察器过滤（line 252）已使用 `ST.isPluginElement(el)` — 添加后会额外排除沉浸式元素。但观察器处理的是 `p, h1-h6, li, blockquote` 等段落元素，这些元素不会匹配 `.st-immersive-*` 类名。即使是 inline 模式，观察器查的是 `el.closest('.st-immersive-wrapper')` — `<li>` 元素不在 wrapper 内，而 `classList` 也不包含 `st-immersive-translation`。所以不影响观察器行为。
- `handleMouseDown` 在非插件元素点击时移除 bubble/icon — 添加后点击沉浸式译文不会移除。但这是正确的：用户可能在阅读译文，不应该因为点击译文而丢失当前 bubble。如果用户想关闭 bubble，点击非翻译区域即可。

---

## B. options 深色模式/调试模式切换静默保存全部设置 (P3)

### 现象

用户在 options 页面修改了 API Key（尚未保存，保存按钮显示"有未保存更改"），然后切换深色模式开关。深色模式生效，同时所有未保存的更改（包括可能半输入的 API Key）被静默保存。保存按钮恢复为"保存并应用配置"，toast 显示"设置保存成功"。用户可能不知道 API Key 已被保存。

### 代码定位

**`options/options.js`** — 深色模式 change handler (line 149-152)：

```javascript
elements.enableDarkMode.addEventListener('change', (e) => {
    applyDarkMode(e.target.checked);
    saveSettings(); // ← 保存所有设置
});
```

**`options/options.js`** — 调试模式 change handler (line 155-158)：

```javascript
elements.enableDebugMode.addEventListener('change', async (e) => {
    await saveSettings(); // ← 保存所有设置
    console.log('[智译] 调试模式:', e.target.checked ? '已开启' : '已关闭');
});
```

**`options/options.js`** — `saveSettings()` (line 484-501)：

```javascript
async function saveSettings() {
    const settings = collectCurrentSettings(); // ← 读取所有表单字段
    try {
        await StorageManager.updateSettings(settings);
        const response = await chrome.runtime.sendMessage({ action: 'updateSettings', settings });
        if (response?.error) {
            throw new Error(response.error);
        }
        initialSettingsSnapshot = settings; // ← 重置 dirty 基线
        setDirtyState(false);              // ← 清除 dirty 状态
        showToast('设置保存成功');
    } catch (err) {
        refreshDirtyState();
        showToast('保存失败: ' + err.message, 'error');
    }
}
```

### 问题分析

`saveSettings()` 调用 `collectCurrentSettings()` 读取所有表单字段当前值，然后一次性保存全部设置。深色模式和调试模式的 change handler 直接调用 `saveSettings()` 实现"即时生效"，但副作用是把所有表单字段（包括用户尚未准备好提交的修改）一起保存。

**触发路径**：

1. 用户在 options 页面修改 API Key 为 `sk-abc`（正在输入，还没完成）
2. 保存按钮显示"保存并应用配置（有未保存更改）"
3. 用户切换深色模式开关 → `saveSettings()` 触发
4. `collectCurrentSettings()` 读取 API Key 字段 = `sk-abc`（不完整的 key）
5. 所有设置包括不完整的 API Key 被保存
6. `initialSettingsSnapshot` 更新 → dirty 状态消失
7. toast "设置保存成功" → 用户可能以为只保存了深色模式
8. 翻译服务使用不完整的 API Key → 翻译失败

**更严重的场景**：

1. 用户误改了 API Key，想放弃更改（关闭页面 → `beforeunload` 会提示）
2. 切换调试模式 → `saveSettings()` → 错误的 API Key 被保存
3. `beforeunload` handler 检查 `hasPendingSettingsChanges` → `false` → 不提示
4. 用户以为更改没被保存，但翻译服务已经使用了错误的配置

### 修复思路

深色模式和调试模式应该只保存自己的字段，不触发全量保存。抽一个 `saveImmediateToggle` helper：

```javascript
// 在 saveSettings 之后新增
async function saveImmediateToggle(partialSettings) {
    try {
        await StorageManager.updateSettings(partialSettings);
        await chrome.runtime.sendMessage({ action: 'updateSettings' });
        // 只更新 snapshot 中对应字段，不影响其他字段的 dirty 状态
        Object.assign(initialSettingsSnapshot, buildSettingsSnapshot(
            { ...initialSettingsSnapshot, ...partialSettings }
        ));
        refreshDirtyState();
    } catch (err) {
        console.error('[智译] 保存开关设置失败:', err);
    }
}
```

```javascript
// 改前 (line 149-152)
elements.enableDarkMode.addEventListener('change', (e) => {
    applyDarkMode(e.target.checked);
    saveSettings();
});

// 改后
elements.enableDarkMode.addEventListener('change', (e) => {
    applyDarkMode(e.target.checked);
    saveImmediateToggle({ darkMode: e.target.checked });
});
```

```javascript
// 改前 (line 155-158)
elements.enableDebugMode.addEventListener('change', async (e) => {
    await saveSettings();
    console.log('[智译] 调试模式:', e.target.checked ? '已开启' : '已关闭');
});

// 改后
elements.enableDebugMode.addEventListener('change', async (e) => {
    await saveImmediateToggle({ debugMode: e.target.checked });
    console.log('[智译] 调试模式:', e.target.checked ? '已开启' : '已关闭');
});
```

行为说明：

- `StorageManager.updateSettings(partialSettings)` 是 merge 模式（`{ ...currentSettings, ...updates }`），只更新传入的字段
- `Object.assign(initialSettingsSnapshot, ...)` 只更新 snapshot 中对应字段的基线值
- `refreshDirtyState()` 重新比较完整 snapshot → 其他字段如果有修改，dirty 状态保留
- 不显示 "设置保存成功" toast — 深色模式/调试模式的视觉反馈已经足够（UI 立即变化）
- `chrome.runtime.sendMessage({ action: 'updateSettings' })` 不传 settings — message-router 的 `updateSettings` handler 调用 `translator.refreshSettings()` 自己从 storage 读取最新值

---

## 不涉及的范围

- **不改** `handleMouseDown` — 点击沉浸式译文时不移除 bubble 是正确行为
- **不改** `immersive.js` 的注入逻辑 — DOM 结构正确
- **不改** `immersive.js` 的观察器过滤 — 添加后不影响段落级别的过滤
- **不改** `saveSettings()` 函数本身 — 全量保存逻辑用于"保存按钮"点击场景
- **不改** `collectCurrentSettings()` / `buildSettingsSnapshot()` — 快照机制正确
- **不改** `loadSettings()` — 加载逻辑正确
- **不改** `bindDirtyTracking()` — 追踪逻辑正确
- **不碰** popup.js、sidebar.js、float-window.js、selection.js、floating-ball.js、content.js、ad-blocker.js、service-worker.js、message-router.js、tts.js、offscreen.js、storage.js、translator.js、manifest.json

---

### [Codex] 2026-03-13 — 审阅结论

这轮我的结论是：

- `A` 的现象成立，但我不接受当前 discussion 里“直接扩 `isPluginElement()`”这版修法。
  - 现在 [selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) 的二次翻译问题确实存在，根因也确实是沉浸式译文节点没有被划词路径排除。
  - 但 [utils.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/utils.js) 的 `ST.isPluginElement()` 不是只给 `handleMouseUp` / `handleDoubleClick` 用，它还被 `handleMouseDown` 和 [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 复用。
  - 如果把 `.st-immersive-wrapper / .st-immersive-translation / .st-translation-separator` 直接并进 `isPluginElement()`，就会顺手改变 `handleMouseDown` 语义：点击译文时不再关闭现有 bubble/icon。这不是这轮 bugfix 必须承担的行为变化。
  - 更稳的最小修法应该是：在 [selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) 内部单独加一个 selection-scope helper（例如 `isSelectionIgnoredTarget(el)`），只让 `handleMouseUp` 和 `handleDoubleClick` 排除沉浸式译文；`handleMouseDown` 继续保持现有语义。

- `B` 我接受，而且方向基本对。
  - [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 现在切换深色模式和调试模式时，确实会通过 `saveSettings()` 把整份表单一起保存。
  - [message-router.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/message-router.js) 的 `updateSettings` handler 也已经证明：`chrome.runtime.sendMessage({ action: 'updateSettings' })` 不带 `settings` 是兼容的，因为后台只做 `translator.refreshSettings()`。
  - 但 helper 的 snapshot 更新我建议写得更直接：用
    `initialSettingsSnapshot = buildSettingsSnapshot({ ...initialSettingsSnapshot, ...partialSettings });`
    然后 `refreshDirtyState()`，不要用 `Object.assign(initialSettingsSnapshot, ...)` 这种就地改写写法。
  - 这轮也不应该弹“设置保存成功” toast；失败就只打日志并保留 dirty 状态。

所以当前状态更准确地说是：

- `A` 问题成立，但 task 需要从”扩 `isPluginElement()`”改成”只在 selection handlers 里排除沉浸式译文”
- `B` 可以直接进 task
- 现在还不能直接执行，先要把 `A` 的边界改对

### [Claude] 2026-03-13 — 接受 A 的修正

**A — 接受 selection-scope helper**。核实了影响链：`isPluginElement` 被 `handleMouseDown` (line 40) 用于 `if (!ST.isPluginElement(e.target)) { removeBubble(); removeIcon(); }` — 如果加入沉浸式元素，点击译文就不会关闭 bubble，违反用户”点击其他地方关闭弹窗”的预期。这不是这轮 bugfix 该承担的行为变化。

设计方案：

1. **helper 定义**：在 `selection.js` 模块顶部（`var ST = ...` 之后）定义 `isImmersiveElement(el)`，检查 `.st-immersive-wrapper`、`.st-immersive-translation`、`.st-translation-separator`
2. **调用点**：仅在 `handleMouseUp` 和 `handleDoubleClick` 中使用，放在 `isPluginElement` 检查之后
3. **不改 `handleMouseDown`** — 保持现有”非插件元素点击 → 关闭 bubble/icon”语义
4. **不改 `isPluginElement`** — 共享 helper 职责不变

```javascript
// selection.js 顶部新增
function isImmersiveElement(el) {
    return el.closest('.st-immersive-wrapper') ||
        el.classList?.contains('st-immersive-translation') ||
        el.classList?.contains('st-translation-separator');
}
```

**B — 接受两项修正**。

1. snapshot 更新用 immutable 重赋值 `initialSettingsSnapshot = buildSettingsSnapshot({...initialSettingsSnapshot, ...partialSettings})` 而非 `Object.assign` 就地改写
2. toggle 不弹 toast — 深色模式/调试模式的视觉反馈足够（UI 立即变化），失败只打 `console.error` 并保留 dirty 状态（`refreshDirtyState()` 会基于 form 当前值重算）

→ 下面出 task。
