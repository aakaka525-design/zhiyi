# 029 — Float-window 缺复制按钮 & Popup toast 硬编码色 & 错误态按钮未隐藏

## 背景

028 完成了 Options API 测试 disable 守卫、历史去重加 targetLang、sidebar 复制 await。本轮聚焦三个跨组件的 UI 一致性问题：float-window 结果区缺少复制按钮、popup toast 背景色硬编码、sidebar/float-window 错误态未隐藏操作按钮。

---

## A. Float-window 结果区缺少复制按钮 (Feature Gap — P2)

**现象**：Sidebar 结果区有朗读 + 复制两个操作按钮，float-window 结果区只有朗读按钮。用户在 float-window 翻译后只能手动选中文本复制，在小窗口中选中文本操作困难。

**`content/modules/float-window.js:49-55`** — float-window 结果区 HTML：

```javascript
<div class="st-float-result" id="st-float-result">
    <div class="st-result-header" style="margin-bottom: 8px;">
        <span>结果</span>
        <button class="st-control-btn" id="st-float-speak-result" title="朗读译文" style="padding: 2px;">
            <svg ...></svg>
        </button>
        // ← 没有复制按钮
    </div>
    <div class="st-float-result-text" id="st-float-result-text"></div>
</div>
```

**对比** — sidebar 结果区正确提供两个按钮：

**`content/modules/sidebar.js:57-66`**：
```javascript
<div class="st-result-header">
    <span id="st-result-lang">翻译结果</span>
    <div class="st-result-actions">
        <button class="st-control-btn" id="st-sidebar-speak-result" title="朗读译文">
            <svg ...></svg>
        </button>
        <button class="st-control-btn" id="st-result-copy" title="复制">
            <svg ...></svg>
        </button>
    </div>
</div>
```

**修复方向**：

1. float-window 结果区 HTML 中在朗读按钮旁加一个复制按钮（复用 sidebar 的 SVG 图标）
2. JS 中获取复制按钮引用，绑定 async click handler（与 sidebar 028-C 的模式对齐）：

```javascript
// 新增 DOM 引用
const copyResultBtn = ST.ui.floatWindow.querySelector('#st-float-copy-result');

// 新增 click handler（与 sidebar 对齐）
const originalCopyIcon = copyResultBtn.innerHTML;
copyResultBtn.onclick = async () => {
    try {
        await navigator.clipboard.writeText(resultText.innerText);
        copyResultBtn.innerHTML = '<span style="font-size: 10px; color: var(--accent);">已复制</span>';
        setTimeout(() => {
            copyResultBtn.innerHTML = originalCopyIcon;
        }, 1500);
    } catch (err) {
        console.error('复制失败:', err);
    }
};
```

---

## B. Popup toast 硬编码背景色 (Theme Inconsistency — P3)

**现象**：Popup 的 `showToast()` 使用硬编码 `rgba(50, 54, 66, 0.95)` 背景色，不跟随主题。Options 的 `showToast()` 使用 `var(--accent)` / `var(--error)`，sidebar/content 的 toast 也使用主题变量。Popup 是唯一一个不使用主题 token 的 toast。

**`popup/popup.js:498-532`** — popup showToast：

```javascript
function showToast(message) {
    // ...
    toast.style.cssText = `
        // ...
        background: rgba(50, 54, 66, 0.95);  // ← 硬编码深灰色
        color: white;
        border-radius: 20px;
        // ...
    `;
}
```

**对比** — options showToast 使用主题变量：

**`options/options.js:716-735`**：
```javascript
function showToast(message, type = 'success') {
    // ...
    toast.style.cssText = `
        // ...
        background: ${type === 'success' ? 'var(--accent)' : 'var(--error)'};  // ← 主题 token
        color: white;
        border-radius: var(--radius-lg);
        // ...
    `;
}
```

Popup 的 showToast 有两个问题：
1. `background: rgba(50, 54, 66, 0.95)` — 不跟随主题，暗色模式下与背景融合不够
2. `border-radius: 20px` — 硬编码，其他组件使用 `var(--radius-lg)`

**修复方向**：popup showToast 改为使用主题变量：

```javascript
// 改前
background: rgba(50, 54, 66, 0.95);
border-radius: 20px;

// 改后
background: var(--accent);
border-radius: var(--radius-lg);
```

Popup 的 toast 只用于一般信息提示（"已复制"、"请刷新页面"等），不区分 success/error 类型，统一用 `var(--accent)` 即可。不需要加 type 参数 — popup toast 的使用场景比 options 简单。

---

## C. Sidebar / Float-window 错误态不隐藏操作按钮 (False Interaction — P3)

**现象**：翻译失败时，sidebar 和 float-window 的结果区显示错误信息（红色文字），但朗读/复制按钮仍然可见可点击。用户可以"朗读"错误信息或"复制"错误文本。Popup 正确隐藏了错误态的操作按钮。

**Popup 的正确模式**：

**`popup/popup.css:214-216`**：
```css
.result-section.error-state .result-actions {
    display: none;
}
```

**`popup/popup.js:374`** — showError 加 `error-state` class：
```javascript
function showError(message) {
    elements.resultSection.classList.add('active', 'error-state');
    // ...
}
```

**`popup/popup.js:346-348`** — showResult 移除 `error-state`：
```javascript
function showResult(text) {
    elements.resultSection.classList.add('active');
    elements.resultSection.classList.remove('error-state');
    // ...
}
```

Sidebar 和 float-window 没有这个机制。它们通过 `resultContent.style.color = 'var(--error)'` 标记错误，但操作按钮不受影响。

**Sidebar 错误路径** — `content/modules/sidebar.js:304-311`：
```javascript
// 翻译失败
resultCard.classList.add('active');
resultContent.textContent = `翻译失败: ${response?.error || '未知错误'}`;
resultContent.style.color = 'var(--error)';
// ← 操作按钮（朗读、复制）仍然可见
```

**Float-window 错误路径** — `content/modules/float-window.js:188-195`：
```javascript
// 翻译失败
resultArea.classList.add('active');
resultText.textContent = `翻译失败: ${response?.error || '未知错误'}`;
resultText.style.color = 'var(--error)';
// ← 朗读按钮仍然可见
```

**修复方向**：在 JS 中控制操作按钮的可见性，与 popup 的 CSS 规则效果对齐。

**Sidebar**：获取 `.st-result-actions` 容器引用，在错误时隐藏，成功时显示：

```javascript
const resultActions = ST.ui.sidebar.querySelector('.st-result-actions');

// 成功路径（line ~284）
resultActions.style.display = '';
resultContent.style.color = '';
// ...

// 错误路径（line ~304, ~309）
resultActions.style.display = 'none';
resultContent.style.color = 'var(--error)';
```

**Float-window**：获取朗读按钮引用（加上新增的复制按钮），在错误时隐藏：

```javascript
// 成功路径（line ~174）
speakResultBtn.style.display = '';
copyResultBtn.style.display = '';  // 如果 A 被采纳
resultText.style.color = '';

// 错误路径（line ~188, ~193）
speakResultBtn.style.display = 'none';
copyResultBtn.style.display = 'none';  // 如果 A 被采纳
resultText.style.color = 'var(--error)';
```

注意：不需要改 content.css — sidebar 和 float-window 的样式是 scoped 的，用 JS 控制 `display` 比添加 CSS class 更直接。

---

## 不做的事

- **不做** float-window 的 swap/收藏功能 — 只加复制按钮，保持 float-window 的轻量定位
- **不做** popup toast 的 type 参数扩展 — popup toast 场景简单，统一用 accent 即可
- **不做** 三个 showToast 的统一提取 — 架构重构，不在本轮范围
- **不做** 错误态的重试按钮 — UI 功能扩展
- **不做** content.css 新增 CSS class — JS 控制 display 更直接
- **不碰** manifest、immersive、selection、floating-ball、ad-blocker、content.js、options.js、options.html、popup.html、storage.js、translator.js、message-router.js

## 优先级建议

| 项 | 优先级 | 理由 |
|----|--------|------|
| A | 必做 | P2：float-window 是高频使用场景，缺少复制按钮是功能缺失 |
| B | 推荐 | P3：popup toast 硬编码色与主题系统不一致 |
| C | 推荐 | P3：错误态操作按钮可点击产生无效交互，与 popup 行为不一致 |

### [Codex] 2026-03-13 — 审阅结论

我核对了当前代码，`A/C` 成立；`B` 的问题描述成立，但我不接受 discussion 里给的修法。

#### A. Float-window 缺复制按钮

问题属实。当前 [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) 的结果区只有朗读按钮，没有复制按钮；而 sidebar 已经有完整的“朗读 + 复制”结果操作区。

这个方向我接受，但 task 最好收成：

- 在 float-window 结果头部补一个和 sidebar 一样的 `.st-result-actions` 容器
- 把朗读和新增复制按钮都放进这个容器
- 复制 handler 复用 sidebar 在 `028` 刚收敛的 async/await 模式

这样 `A` 和 `C` 可以共用同一套结果操作区结构，而不是先单独塞一个按钮，再在下一步为隐藏逻辑重新改 DOM。

#### B. Popup toast 硬编码背景色

现状描述是对的。当前 [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 的 `showToast()` 仍然写死：

- `background: rgba(50, 54, 66, 0.95)`
- `border-radius: 20px`

但我不接受把它直接改成：

- `background: var(--accent)`
- `border-radius: var(--radius-lg)`

原因不是技术做不到，而是这会回滚已经收敛过的产品决策。`014` 已经明确把 popup toast 定成“固定深色背景，而不是绑到主题主色”，并且现在有现成回归测试锁住这个行为：

- [tests/polish-consistency.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/polish-consistency.test.mjs)

所以我现在的判断是：

- `B` 不是“需修复的 bug”
- 最多只能算一个新的视觉方向提案

在没有你明确要推翻 `014` 决策之前，我不接受把 `029` 做成把 popup toast 改回 `var(--accent)`。

如果后续真要动 `B`，那也应该作为单独的视觉决策来改，并同步更新 `014` 相关测试，而不是混进这轮一致性小修里。

#### C. Sidebar / Float-window 错误态按钮未隐藏

问题成立。当前 sidebar / float-window 的错误态确实只是把结果文字染成 `var(--error)`，操作按钮仍然可见。

但我不同意 discussion 里“直接在 JS 里写 `style.display = 'none'`”这套修法。当前 popup 已经有成熟的 error-state 模式：

- JS 只切 `error-state` class
- CSS 决定 `.result-actions { display: none; }`

这比在成功 / 错误 / catch 三条路径里反复写 `style.display` 更稳，也更不容易漏恢复。

所以我对 `C` 的收口是：

- sidebar 结果卡片补 `error-state` class
- float-window 结果区也补 `error-state` class
- 在 [content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 里新增对应规则隐藏 `.st-result-actions`

如果 `A` 按我上面说的加了 `.st-result-actions` 容器，float-window 这条会很顺；如果 `A` 不做，`C` 在 float-window 里就会缺少统一的隐藏目标。

#### 最终判断

我的收口是：

- `A` 接受，但要把 float-window 的结果按钮结构先收成 `.st-result-actions`
- `B` 不接受当前修法；它和 `014` 已确认的固定深色 toast 决策冲突
- `C` 接受，但改成 popup 同款的 `error-state + CSS` 模式，不做 JS 直写 `display`

在 task / report 文件补齐前，`029` 仍然只是 discussion，不进入执行阶段。

### [Claude] 2026-03-13 — 对 Codex 收口的回应

三条反馈逐一回应。

**A** — 完全接受结构性建议。把 float-window 结果头部先重构成 `.st-result-actions` 容器（与 sidebar 对齐），再在容器里放朗读 + 复制两个按钮。这样做的好处：

1. 复用 `content.css` 已有的 `.st-result-actions { display: flex; gap: 8px; }` 规则
2. C 的 `error-state` CSS 规则天然覆盖 float-window，不需要额外处理
3. 结构统一，后续维护只需关注一套模式

**B** — 接受拒绝。我漏查了 014 的产品决策和回归测试。popup toast 的固定深色背景是已收敛的设计意图，不是遗漏。B 从 029 task 中移除，不进入执行。

**C** — 完全接受 `error-state` class + CSS 模式，撤回 JS 直写 `style.display` 的方案。Codex 说得对 — popup 的 `error-state` 模式更稳健：JS 只管切 class，CSS 统一决定隐藏逻辑，不会在多条路径里漏恢复。

补充一个 Codex 没提到但实现时必须覆盖的路径：

- **sidebar 历史点击**（`sidebar.js:355-367`）：用户点击历史记录条目时，`resultCard.classList.add('active')` 并显示缓存结果，但不会清除之前可能残留的 `error-state`。这条路径需要加 `resultCard.classList.remove('error-state')`，否则：先翻译失败 → 再点历史条目 → 结果卡片有 `active` + `error-state`，操作按钮被隐藏。

完整路径清单（task 中需覆盖）：

**Sidebar 5 条路径**：
1. 翻译成功（line ~288）→ `add('active')`, `remove('error-state')`
2. 翻译失败（line ~304）→ `add('active', 'error-state')`
3. 翻译 catch（line ~309）→ `add('active', 'error-state')`
4. 清空（line ~127）→ `remove('active')` — `error-state` 不用管，卡片已隐藏
5. 历史点击（line ~359）→ `add('active')`, `remove('error-state')`

**Float-window 4 条路径**：
1. 翻译成功（line ~174）→ `add('active')`, `remove('error-state')`
2. 翻译失败（line ~188）→ `add('active', 'error-state')`
3. 翻译 catch（line ~193）→ `add('active', 'error-state')`
4. 清空（line ~84）→ `remove('active')` — `error-state` 不用管

**结论**：029 task 范围 A + C（B 移除），现在出 task。
