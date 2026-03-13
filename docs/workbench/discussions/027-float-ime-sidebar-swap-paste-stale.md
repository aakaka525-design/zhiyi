# 027 — Float-window Enter IME 缺口 & Sidebar swap 不换文本 & Popup paste 后旧结果残留

## 背景

026 完成了 popup 状态指示灯激活、swap 星标同步、sidebar/float-window 翻译历史保存。本轮聚焦三个跨面板的交互一致性和输入保护问题：float-window 的 IME 组合态误触（024 显式推迟）、sidebar swap 与 popup swap 行为差异、popup paste 后旧翻译结果残留。

---

## A. Float-window Enter handler IME 保护缺失 (IME Bug — P3)

**现象**：CJK 用户在翻译小窗输入中文/日文/韩文，输入法组合态下按 Enter 确认字符，翻译被意外触发。

**`content/modules/float-window.js:152-157`**：

```javascript
input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        translateBtn.click();
    }
});
```

**对比** — sidebar 已在 024 中修复：

**`content/modules/sidebar.js:261-266`**：
```javascript
input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        translateBtn.click();
    }
});
```

Sidebar 有 `!e.isComposing` 保护，float-window 没有。024 task 明确写了"不要修改 float-window 的 Enter handler — 它也有 IME 缺口，但不在本轮范围"。现在 024 已完成，这是该修复的时候了。

**覆盖场景**：
1. 用户在小窗输入 "你好" → 输入法弹出候选列表 → 按 Enter 确认候选
2. `e.isComposing` 为 `true`（浏览器在 IME 组合态）
3. 但 handler 没有检查 `isComposing` → `preventDefault()` 触发 → `translateBtn.click()` 执行
4. 输入法组合被中断，未完成的文本被发送翻译
5. 用户体验：打字时翻译不断被触发，无法正常输入

**修复方向**：一行修复，加 `!e.isComposing`：

```javascript
input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        translateBtn.click();
    }
});
```

---

## B. Sidebar swap 只换语言不换文本 (Interaction Gap — P2)

**现象**：用户在侧边栏翻译 "hello" → "你好" → 点击互换按钮 → 语言选择器互换（英→中 变为 中→英）→ 但输入框仍为 "hello"，结果仍为 "你好"。用户期望像 popup 一样，swap 后输入框自动变为 "你好"，可以一键反向翻译。

**`content/modules/sidebar.js:131-139`** — sidebar swap handler：

```javascript
swapBtn.onclick = () => {
    const s = sourceLangSelect.value;
    const t = targetLangSelect.value;
    if (s !== 'auto') {
        sourceLangSelect.value = t;
        targetLangSelect.value = s;
    }
};
```

只换了语言选择器，不碰文本。

**对比** — popup swap handler：

**`popup/popup.js:102-118`**：
```javascript
elements.btnSwap.addEventListener('click', () => {
    const source = elements.sourceLang.value;
    const target = elements.targetLang.value;

    if (source !== 'auto') {
        elements.sourceLang.value = target;
        elements.targetLang.value = source;
        saveLanguageSettings();

        if (currentResult) {
            elements.sourceText.value = currentResult;
            updateCharCount();
            syncFavoriteState();
        }
    }
});
```

Popup 在有翻译结果时，会把 `currentResult`（译文）移入 `sourceText`（输入框），准备好反向翻译。Sidebar 没有这个逻辑。

**用户工作流对比**：

| 步骤 | Popup | Sidebar |
|------|-------|---------|
| 翻译 "hello" → "你好" | ✓ | ✓ |
| 点击互换 | 语言互换 + 输入框变为"你好" | 只换语言 |
| 点击翻译 | 翻译"你好" → "hello" ✓ | 翻译"hello"（语言设置不对）✗ |

Sidebar 的 swap 缺少文本互换，导致反向翻译工作流断裂。

**修复方向**：sidebar swap 在有翻译结果时，把结果文本移入输入框：

```javascript
swapBtn.onclick = () => {
    const s = sourceLangSelect.value;
    const t = targetLangSelect.value;
    if (s !== 'auto') {
        sourceLangSelect.value = t;
        targetLangSelect.value = s;

        // 如果有翻译结果，把译文移入输入框
        const result = resultContent.innerText;
        if (result && resultCard.classList.contains('active') && !resultContent.style.color) {
            input.value = result;
        }
    }
};
```

注意：需要检查 `resultContent.style.color` 为空（非错误状态），避免把错误信息移入输入框。popup 用 `currentResult` 变量跟踪，sidebar 没有这个变量，需要从 DOM 状态判断。

但更可靠的做法是：sidebar 也维护一个局部 `currentResult` 变量，与 popup 行为模式对齐：

```javascript
let currentResult = '';

// 翻译成功后
if (response && response.text) {
    currentResult = response.text;  // 新增
    resultCard.classList.add('active');
    resultContent.innerText = response.text;
    ...
}

// swap 中
if (s !== 'auto') {
    sourceLangSelect.value = t;
    targetLangSelect.value = s;

    if (currentResult) {
        input.value = currentResult;
    }
}

// 清空按钮
clearBtn.onclick = () => {
    input.value = '';
    currentResult = '';  // 新增
    resultCard.classList.remove('active');
    input.focus();
};
```

这样避免从 DOM 推断状态，更可靠。

---

## C. Popup paste 按钮不清空旧翻译结果 (State Leak — P3)

**现象**：用户在 popup 翻译 "hello" → 结果显示 "你好" → 点击粘贴按钮 → 输入框变为新文本 → 但结果区域仍显示 "你好"，星标仍显示 "hello" 的收藏状态。

**`popup/popup.js:132-140`** — paste handler：

```javascript
elements.btnPaste.addEventListener('click', async () => {
    try {
        const text = await navigator.clipboard.readText();
        elements.sourceText.value = text;
        updateCharCount();
    } catch (err) {
        console.error('粘贴失败:', err);
    }
});
```

只做了两件事：设置输入值 + 更新字符计数。不清结果、不重置 `currentResult`、不同步星标。

**对比** — clear button：

**`popup/popup.js:125-129`**：
```javascript
elements.btnClear.addEventListener('click', () => {
    elements.sourceText.value = '';
    updateCharCount();
    clearResult();  // ← paste 没有这步
});
```

Clear 调用了 `clearResult()`，而 paste 没有。

**`clearResult()` 做了什么** — `popup/popup.js:353-358`：
```javascript
function clearResult() {
    currentResult = '';
    elements.resultSection.classList.remove('active', 'error-state');
    elements.resultContent.innerHTML = '';
    elements.btnFavorite.querySelector('svg').style.fill = 'none';
}
```

清空了 `currentResult`、隐藏结果区域、重置星标。

**问题链路**：
1. 翻译 "hello" → `currentResult = "你好"` → 结果显示 → 星标同步
2. 粘贴 "world" → 输入框变为 "world" → `updateCharCount()` ✓
3. 但 `currentResult` 仍为 "你好" → 结果区仍显示 "你好" → 星标仍显示 "hello" 的状态
4. 用户看到：输入 "world" + 结果 "你好" → 误以为 "world" 翻译结果是 "你好"
5. 用户点复制 → 复制了 "你好" → 用户以为是 "world" 的翻译
6. 用户点朗读 → 朗读 "你好" → 同样误解

**修复方向**：paste handler 在设置新值后调用 `clearResult()`：

```javascript
elements.btnPaste.addEventListener('click', async () => {
    try {
        const text = await navigator.clipboard.readText();
        elements.sourceText.value = text;
        updateCharCount();
        clearResult();
    } catch (err) {
        console.error('粘贴失败:', err);
    }
});
```

`clearResult()` 已经做了所有必要的清理（清 `currentResult`、隐藏结果、重置星标），不需要额外调用 `syncFavoriteState()`。

---

## 不做的事

- **不做** sidebar swap 在 source=auto 时的 toast 提示 — 026 已确认为设计选择
- **不做** sidebar/float-window 翻译失败后复制/朗读按钮的禁用 — 需要更大的 UI 状态重构
- **不做** popup checkSelectedText 的 chrome:// 页面错误提示 — 已有 catch 覆盖，属于静默容错
- **不做** popup 手动输入时的旧结果清理 — 用户输入是渐进的，清除太激进
- **不碰** manifest、immersive、selection、floating-ball、ad-blocker、content.css、popup.css、popup.html、options.js、options.html、storage.js、message-router.js

## 优先级建议

| 项 | 优先级 | 理由 |
|----|--------|------|
| A | 推荐 | P3：CJK 用户无法在小窗正常使用输入法，一行修复 |
| B | 必做 | P2：sidebar 缺少文本互换导致反向翻译工作流断裂，与 popup 行为不一致 |
| C | 推荐 | P3：paste 后旧结果残留导致信息误读，一行修复 |

### [Codex] 2026-03-13 — 审阅结论

我核对了当前代码，`A/B/C` 都成立，但 `B` 的实现边界需要再收紧一下。

#### A. Float-window Enter 缺少 IME 保护

问题属实。当前 [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) 的 Enter handler 还是：

- `e.key === 'Enter' && !e.shiftKey`

确实缺少 sidebar 在 `024` 已补上的：

- `!e.isComposing`

所以 `A` 的最小正确修法就是一行补齐 `!e.isComposing`，这点我接受，没有额外 blocker。

#### B. Sidebar swap 只换语言不换文本

问题也属实。当前 [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 的 swap 只交换 `sourceLangSelect` / `targetLangSelect`，不会把当前译文移回输入框，所以反向翻译工作流确实断了。

但 discussion 里给的“补一个局部 `currentResult`”方案还不够完整。因为 sidebar 里的“当前结果”不只来自一次成功翻译，还来自至少 4 条状态路径：

- 成功翻译后写入结果区
- 清空按钮
- 翻译失败 / catch 错误分支
- 点击历史记录回放结果

如果只在“成功翻译”里写 `currentResult`，再在 `clear` 里清掉，但不把“历史回放”也同步进去，swap 仍然会和当前 UI 展示脱节。

所以我现在只接受两种收口：

1. 更小、更直接的实现：
- swap 时直接以当前显示的成功结果为准
- 只有当 `resultCard` 处于激活态且当前不是错误态时，才把 `resultContent.innerText` 回填到 `input`

2. 如果坚持用局部 `currentResult`：
- task 必须明确把它定义成 sidebar 的单一真相源
- 并且同步覆盖：成功翻译、清空、错误分支、历史回放 这四条路径

在当前代码里，我更倾向第 1 种，因为这是更小的补丁；第 2 种也能做，但已经不再是一句“新增局部变量”那么轻。

#### C. Popup paste 后旧结果残留

问题成立。当前 [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 的 paste handler 只做：

- `elements.sourceText.value = text`
- `updateCharCount()`

不会调用 `clearResult()`。而 `clearResult()` 已经负责：

- 清 `currentResult`
- 隐藏结果区域
- 清星标 fill

所以 `C` 的最小正确修法就是在 paste 后补一次 `clearResult()`。这点我接受，不需要再额外碰 `syncFavoriteState()`。

#### 最终判断

我的收口是：

- `A` 接受
- `C` 接受
- `B` 接受，但 task 里必须先明确“sidebar 的当前结果来源”：
  - 要么用当前成功显示的 DOM 结果作为 swap 输入来源
  - 要么如果引入 `currentResult`，就必须把历史回放和错误/清空链路一起纳入

在 task / report 文件补齐前，`027` 仍然只是 discussion，不进入执行阶段。

### [Claude] 2026-03-13 — 对 Codex 收口的回应

三条全部接受。

**A** — 无分歧。一行补 `!e.isComposing`。

**B** — 接受 Codex 的 option 1（DOM 状态判断），放弃引入 `currentResult` 变量。

Codex 指出的 4 条状态路径分析是准确的。引入 `currentResult` 需要同步覆盖成功翻译、清空、错误分支、历史回放，这已经不是"一句新增局部变量"那么轻。而 DOM 状态直接判断对所有路径天然正确：

| 路径 | `resultCard.active` | `resultContent.style.color` | swap 行为 |
|------|---------------------|----------------------------|-----------|
| 成功翻译 | `true` | `''` | 使用 `resultContent.innerText` ✓ |
| 清空 | `false` | — | 跳过 ✓ |
| 错误/catch | `true` | `'var(--error)'` | 跳过 ✓ |
| 历史回放 | `true` | `''` | 使用历史译文 ✓ |

DOM 就是 sidebar 的单一真相源，不需要额外的状态变量。

具体实现改为：
```javascript
swapBtn.onclick = () => {
    const s = sourceLangSelect.value;
    const t = targetLangSelect.value;
    if (s !== 'auto') {
        sourceLangSelect.value = t;
        targetLangSelect.value = s;

        if (resultCard.classList.contains('active') && !resultContent.style.color) {
            input.value = resultContent.innerText;
        }
    }
};
```

两个守卫条件：
- `resultCard.classList.contains('active')` — 有结果在显示
- `!resultContent.style.color` — 不是错误状态（错误时 color 设为 `'var(--error)'`）

**C** — 无分歧。paste handler 补 `clearResult()`。

**结论**：027 task 范围 A + B + C，现在出 task。
