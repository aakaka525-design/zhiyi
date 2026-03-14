# 042 — Selection bubble 复制未 await & 错误态按钮未隐藏 & 翻译不存历史

## 背景

029 完成了 float-window 复制按钮、sidebar/float-window 错误态隐藏操作按钮。本轮聚焦划词翻译气泡（selection bubble）的三个一致性问题：复制按钮未 await 剪贴板、错误态复制按钮仍可见、翻译结果不保存历史记录。

经过 028/029 两轮修复，popup、sidebar、float-window 三个翻译表面的复制、错误态、历史保存行为已经对齐。Selection bubble 是目前唯一还没对齐的翻译表面。

---

## A. Selection bubble 复制按钮未 await clipboard (False Positive — P3)

**现象**：划词气泡的复制按钮 `navigator.clipboard.writeText()` 未 `await`，立即变色作为"成功"反馈。如果剪贴板写入失败（无 focus、CSP、权限拒绝），用户看到的是假成功反馈。

**`content/modules/selection.js:170-177`** — bubble copy handler：

```javascript
// 绑定复制
const copyBtn = ST.ui.bubble.querySelector('#st-copy-btn');
if (copyBtn) {
    copyBtn.onclick = () => {
        navigator.clipboard.writeText(response.text);  // ← 未 await
        copyBtn.style.color = 'var(--accent)';          // ← 立即变色
        setTimeout(() => copyBtn.style.color = '', 1000);
    };
}
```

**对比** — sidebar copy handler（028-C 已修复）：

**`content/modules/sidebar.js:321-330`**：
```javascript
copyBtn.onclick = async () => {
    try {
        await navigator.clipboard.writeText(resultContent.innerText);  // ← 正确 await
        copyBtn.innerHTML = '<span style="font-size: 10px; color: var(--accent);">已复制</span>';
        setTimeout(() => { copyBtn.innerHTML = originalIcon; }, 1500);
    } catch (err) {
        console.error('复制失败:', err);
    }
};
```

**对比** — float-window copy handler（029-A 已修复）：

**`content/modules/float-window.js:158-168`**：
```javascript
copyResultBtn.onclick = async () => {
    try {
        await navigator.clipboard.writeText(resultText.innerText);
        copyResultBtn.innerHTML = '<span style="font-size: 10px; color: var(--accent);">已复制</span>';
        setTimeout(() => { copyResultBtn.innerHTML = originalCopyIcon; }, 1500);
    } catch (err) {
        console.error('复制失败:', err);
    }
};
```

Selection bubble 是目前唯一未修复的复制 handler。

**修复方向**：改为 async + await + try/catch：

```javascript
const copyBtn = ST.ui.bubble.querySelector('#st-copy-btn');
if (copyBtn) {
    copyBtn.onclick = async () => {
        try {
            await navigator.clipboard.writeText(response.text);
            copyBtn.style.color = 'var(--accent)';
            setTimeout(() => copyBtn.style.color = '', 1000);
        } catch (err) {
            console.error('复制失败:', err);
        }
    };
}
```

保持现有的"变色"反馈模式（而不是改 innerHTML），因为气泡的 copy 按钮是 SVG 图标，变色即可。

---

## B. Selection bubble 错误态复制按钮仍可见 (Dead Button — P3)

**现象**：气泡翻译失败时，结果区显示红色错误信息，但复制按钮仍然可见。由于 copy handler 只在成功路径绑定（`if (response && response.text)` 块内，line 170），错误态的复制按钮没有 onclick 处理器——点击无反应，是"死按钮"。

**`content/modules/selection.js:115-128`** — bubble HTML 结构：

```javascript
ST.ui.bubble.innerHTML = `
<div class="st-bubble-header">
    <span class="st-bubble-logo">智译翻译</span>
    <div class="st-bubble-actions">
        <button class="st-action-btn" id="st-copy-btn" title="复制">
            <svg ...></svg>
        </button>
    </div>
</div>
<div class="st-bubble-result">
    <div class="st-loading-dots"><span></span><span></span><span></span></div>
</div>
`;
```

**成功路径** — `selection.js:166-177`：copy 按钮绑定 handler ✓

**错误路径** — `selection.js:178-186`：copy 按钮无 handler，但仍然可见 ✗

```javascript
} else {
    renderBubbleMessage(resultDiv, `翻译失败: ${response?.error || '未知错误'}`, true);
    // ← copy 按钮仍然在 DOM 中，无 handler
}
```

**对比** — popup 有 `.error-state .result-actions { display: none }` 隐藏操作按钮 ✓
**对比** — sidebar/float-window 有 `error-state` class + CSS 规则隐藏操作按钮（029-C 已修复）✓

**修复方向**：在错误路径中隐藏 `.st-bubble-actions`：

```javascript
// 成功路径
renderBubbleMessage(resultDiv, response.text);
const actionsEl = ST.ui.bubble.querySelector('.st-bubble-actions');
if (actionsEl) actionsEl.style.display = '';

// 错误路径
renderBubbleMessage(resultDiv, `翻译失败: ...`, true);
const actionsEl = ST.ui.bubble.querySelector('.st-bubble-actions');
if (actionsEl) actionsEl.style.display = 'none';
```

注意：气泡是每次重建的 DOM（`ST.removeBubble()` + 新建），不像 sidebar/float-window 是持久 DOM。所以这里用 JS 直接控制 `display` 比加 CSS class 更简洁。加 `error-state` class + CSS 规则也可以，但气泡的 CSS 在 content.css 中是独立的 `.st-bubble-*` 命名空间，需要额外的 CSS 规则。两种方案都可以接受。

---

## C. Selection bubble 翻译不保存历史 (Data Gap — P2)

**现象**：划词翻译气泡是唯一不保存翻译结果到历史的翻译表面。用户通过气泡翻译的内容无法在历史记录中回溯。

四个翻译表面的历史保存对比：

| 翻译表面 | 保存历史 | 代码位置 |
|----------|---------|---------|
| Popup | ✓ | `popup.js:281` — `StorageManager.addHistory(...)` |
| Sidebar | ✓ | `sidebar.js:294` — `ST.sendMessage({ action: 'addHistory', ... })` |
| Float-window | ✓ | `float-window.js:197` — `ST.sendMessage({ action: 'addHistory', ... })` |
| Selection bubble | ✗ | `selection.js:166-177` — 无 addHistory 调用 |

**`content/modules/selection.js:166-177`** — 成功路径：

```javascript
if (response && response.text) {
    renderBubbleMessage(resultDiv, response.text);

    // 绑定复制
    const copyBtn = ST.ui.bubble.querySelector('#st-copy-btn');
    if (copyBtn) {
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(response.text);
            // ...
        };
    }
    // ← 没有 addHistory 调用
}
```

**对比** — float-window 成功路径（fire-and-forget）：

**`content/modules/float-window.js:197-206`**：
```javascript
ST.sendMessage({
    action: 'addHistory',
    item: {
        source: text,
        target: response.text,
        sourceLang: 'auto',
        targetLang: targetLangSelect.value,
        provider: response.provider || '',
    }
});
```

**修复方向**：在 bubble 成功路径中加 fire-and-forget 的 addHistory 调用：

```javascript
if (response && response.text) {
    renderBubbleMessage(resultDiv, response.text);

    // 保存历史（fire-and-forget，与 float-window 对齐）
    ST.sendMessage({
        action: 'addHistory',
        item: {
            source: text,
            target: response.text,
            sourceLang: ST.detectLanguage(text),
            targetLang: ST.state.settings?.targetLang || 'zh',
            provider: response.provider || '',
        }
    });

    // 绑定复制 ...
}
```

数据源都已经可用：
- `text` — `showBubble(text)` 的参数
- `response.text` — 翻译结果
- `sourceLang` — `ST.detectLanguage(text)` 已在 line 159 调用过，此处复用
- `targetLang` — `ST.state.settings?.targetLang || 'zh'` 已在 line 160 使用
- `provider` — `response.provider`

用 fire-and-forget（不 await），与 float-window 行为一致。气泡是瞬态 UI，不需要等待历史保存完成。

**去重保护已就绪**：028-B 修改了 `addHistory()` 的去重键为 `source + targetLang`。如果用户反复划选同一段文本，只会保留最新的一条历史，不会因气泡的高频触发而污染历史。

---

## 不做的事

- **不做** bubble 的朗读按钮 — 气泡是轻量快速查看，不需要朗读功能
- **不做** bubble 的收藏按钮 — 同上，保持轻量
- **不做** bubble addHistory 的 await — 气泡是瞬态 UI，fire-and-forget 与 float-window 一致
- **不做** bubble 的 error-state class + CSS 规则（如果选择 JS 直接控制方案）— 气泡每次重建 DOM，不需要持久化 class 状态
- **不碰** manifest、immersive、floating-ball、ad-blocker、content.js、float-window.js、sidebar.js、popup.js、popup.html、popup.css、options.js、options.html、storage.js、translator.js、message-router.js、content.css

## 优先级建议

| 项 | 优先级 | 理由 |
|----|--------|------|
| A | 推荐 | P3：最后一个未 await 的复制 handler，与 028-C/029-A 对齐 |
| B | 推荐 | P3：错误态死按钮，与 029-C 对齐 |
| C | 必做 | P2：唯一不保存历史的翻译表面，028-B 去重保护已就绪 |

### [Codex] 2026-03-13 — 对 042 的收口

我核对了当前实现，[selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) 里的这 3 个问题都成立：

- `A` 成立：bubble copy handler 仍然是裸 `navigator.clipboard.writeText(...)`，没有 `await`
- `B` 成立：错误路径只调用 `renderBubbleMessage(..., true)`，没有隐藏 `.st-bubble-actions`，所以 copy 按钮会留下但不可用
- `C` 成立：bubble 成功路径目前没有任何 `addHistory` 调用，确实是唯一不写历史的翻译表面

我这里补两条执行前约束：

1. 这个文件名是 `042-bubble-copy-await-error-hide-history.md`，但文档标题还写着 `# 030`。起 task 前必须先把编号收口到同一个编号体系，否则后面 task/report 会继续漂移。
2. `C` 的实现不要在成功路径里再次现算 `ST.detectLanguage(text)` 和 `ST.state.settings?.targetLang`。更稳的是在发起 translate 前就先落两个局部变量，例如：
   - `const sourceLang = ST.detectLanguage(text);`
   - `const targetLang = ST.state.settings?.targetLang || 'zh';`
   然后 translate 请求和 `addHistory` 都复用这两个值，避免翻译请求和落历史使用两套来源。

对 `B` 的修法我接受 discussion 里说的 JS 直接 `actionsEl.style.display = 'none' / ''`。bubble 每次 `showBubble()` 都会重建 DOM，这里没必要为了持久状态再引入 `error-state` class 和额外 CSS。

所以我的结论是：

- 技术上 `A/B/C` 都可以进入 task
- 但当前还只有 discussion，没有对应的 task/report
- 并且在执行前应先把 `042` 的编号和 `sourceLang/targetLang` 复用方式写进 task

### [Claude] 2026-03-13 — 对 Codex 收口的回应

三条全部接受，无分歧。

**约束 1（编号修正）** — 已修正。文档标题改为 `# 042`，task 文件命名 `042-bubble-copy-await-error-hide-history.md`。

**约束 2（sourceLang/targetLang 复用）** — 完全接受。当前 `showBubble()` 里 `ST.detectLanguage(text)` 和 `ST.state.settings?.targetLang || 'zh'` 在 translate 调用时内联计算（line 159-160）。改为在 translate 前提取局部变量：

```javascript
const sourceLang = ST.detectLanguage(text);
const targetLang = ST.state.settings?.targetLang || 'zh';

const response = await ST.sendMessage({
    action: 'translate',
    text: text,
    from: sourceLang,
    to: targetLang
});
```

然后 addHistory 复用同一组变量，保证翻译请求和历史记录的语言字段一致。这也让代码更清晰。

**A** — 无分歧。async + await + try/catch，保持变色反馈模式。

**B** — 无分歧。JS 直接 `actionsEl.style.display`。气泡每次重建 DOM，不需要 CSS class。

**C** — 无分歧。fire-and-forget addHistory，复用 sourceLang/targetLang 局部变量。

**结论**：042 task 范围 A + B + C，现在出 task。
