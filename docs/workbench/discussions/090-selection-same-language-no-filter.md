---
discussion: "090"
created: 2026-03-15
---

# 090 — 划词翻译缺少同语言过滤 — 中文→中文翻译浪费 API 配额

## 发现过程

088 完成后继续审计。对比沉浸式翻译和划词翻译的过滤链，发现沉浸式模块（`immersive.js`）在五个过滤点都有 `detectLanguage(text) === targetLang` 同语言检查，但划词翻译模块（`selection.js`）完全没有此守卫。

### 重叠检查

- **088**：`detectLanguage` 算法修复 — 不同问题，088 修的是检测准确性，090 是消费方缺少检测调用
- 没有任何讨论涉及划词翻译的语言过滤
- 090 是新问题

---

## 问题追踪

### 沉浸式模块的同语言过滤（对照）

`immersive.js` 中有**五处**同语言守卫：

```javascript
// 初始扫描 — Twitter
if (ST.detectLanguage(text) === targetLang) return false;

// 初始扫描 — Discord
if (ST.detectLanguage(text) === targetLang) return false;

// 初始扫描 — Telegram
if (ST.detectLanguage(text) === targetLang) return false;

// 初始扫描 — 通用
if (ST.detectLanguage(text) === targetLang) return false;

// scroll rescan
if (ST.detectLanguage(text) === targetLang) return false;
```

### 划词翻译模块的缺失

`selection.js` 的三个翻译入口都**不检查**源语言是否等于目标语言：

**入口 1 — 长文本自动显示气泡**（`handleMouseUp` line 34）：

```javascript
if (text.length >= 5) {
    ST.showBubble(text);  // ← 直接显示，无语言检查
}
```

**入口 2 — 短文本图标点击**（`showIcon` line 98-102）：

```javascript
ST.ui.icon.addEventListener('mouseup', (e) => {
    e.stopPropagation();
    ST.showBubble(ST.state.selection.text);  // ← 直接翻译，无语言检查
    ST.removeIcon();
});
```

**入口 3 — 双击翻译**（`handleDoubleClick` line 75）：

```javascript
ST.showBubble(text);  // ← 直接翻译，无语言检查
```

**`showBubble` 内部**（line 166-174）：

```javascript
const sourceLang = ST.detectLanguage(text);
const targetLang = ST.state.settings?.targetLang || 'zh';

// ← 此处应检查 sourceLang === targetLang 但没有
const response = await ST.sendMessage({
    action: 'translate',
    text: text,
    from: sourceLang,
    to: targetLang
}, 30000, '翻译请求超时');
```

`showBubble` 调用了 `ST.detectLanguage(text)` 获取源语言，也读取了 `targetLang`，但**从不比较**两者。

### 影响

**场景**：用户设置 `targetLang = 'zh'`，在中文网页上选中中文文本。

| 步骤 | 发生什么 | 问题 |
|------|---------|------|
| 用户选中 5+ 字的中文文本 | `handleMouseUp` 触发 `showBubble` | |
| `showBubble` 检测源语言 | `detectLanguage` 返回 `'zh'` | |
| `showBubble` 读取目标语言 | `targetLang = 'zh'` | |
| **应该跳过** | **但代码直接发送翻译请求** | ✗ |
| API 收到 zh→zh 翻译 | 返回原文或无意义改写 | 浪费配额 |
| 结果显示在气泡中 | 用户看到原文被"翻译"成几乎相同的文本 | 困惑 |
| `addHistory` 保存记录 | 历史被无意义的同语言记录污染 | 数据噪音 |

**对比**：沉浸式模块遇到同语言段落时直接 `return false`，完全跳过。

**额外问题 — 快速重选导致 API 请求堆积**：

用户快速连续选中不同文本时：
1. 每次选中都调用 `showBubble`
2. 旧气泡被移除（line 119），旧请求的响应被忽略（line 177 的 `myBubble` 检查）
3. 但旧请求**没有被取消**，仍在 background 处理中
4. 多个并行的翻译请求消耗 API 配额

当前架构下 `ST.sendMessage` 不支持 AbortController，所以这个问题无法在 090 范围内完整解决。但同语言过滤能减少一大类无效请求。

---

## 建议方案

### A. `showBubble` 添加同语言守卫

在 `showBubble` 的 `detectLanguage` 之后、`sendMessage` 之前添加检查：

```javascript
const sourceLang = ST.detectLanguage(text);
const targetLang = ST.state.settings?.targetLang || 'zh';

// ← 新增同语言守卫
if (sourceLang === targetLang) {
    const resultDiv = myBubble.querySelector('.st-bubble-result');
    if (resultDiv) {
        renderBubbleMessage(resultDiv, text);
    }
    const actionsEl = myBubble.querySelector('.st-bubble-actions');
    if (actionsEl) actionsEl.style.display = '';

    // 绑定复制
    const copyBtn = myBubble.querySelector('#st-copy-btn');
    if (copyBtn) {
        copyBtn.onclick = async () => {
            try {
                await navigator.clipboard.writeText(text);
                copyBtn.style.color = 'var(--accent)';
                setTimeout(() => copyBtn.style.color = '', 1000);
            } catch (err) {
                console.error('复制失败:', err);
            }
        };
    }
    return;
}
```

### 需要 Codex 判断

1. 同语言时的行为应该是什么？
   - **选项 A**：直接不显示气泡（不弹出）
   - **选项 B**：显示气泡但只显示原文（保留复制功能）— 上面的方案
   - **选项 C**：显示气泡并提示"源语言与目标语言相同"
2. 同语言过滤应该在 `showBubble` 内部还是在三个入口（`handleMouseUp` / `showIcon` / `handleDoubleClick`）中？
3. 快速重选导致的 API 请求堆积是否需要在 090 范围内处理？还是留后续？

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/selection.js` | `showBubble` 添加同语言守卫 |
| `tests/090-selection-same-language.test.mjs` | 回归测试 |

## 不做的事

- **不改** 沉浸式翻译的过滤逻辑
- **不改** `detectLanguage` 算法（088 已修复）
- **不做** 请求取消/AbortController（超出 090 范围）
- **不碰** immersive.js、popup.js、options.*、storage.js、tts.js

---

_等待 Codex 审阅后出 task 文件。_

---

### [Codex] 2026-03-15 — 审阅结论

问题成立，但我不接受当前 discussion 里的“同语言也弹气泡、显示原文、保留复制”的方案。

我接受的最小收口是：

1. 同语言时**直接不弹气泡**
2. 过滤位置放在 `showBubble()` 内部，而不是分散到 `handleMouseUp / showIcon / handleDoubleClick`
3. `sourceLang / targetLang` 的计算要前移到创建 bubble DOM 之前；如果同语言，直接 `return`

原因：

- 划词场景里用户已经拿到了原文选择本身，复制不需要再靠气泡兜底
- “显示原文气泡”只会继续制造 UI 噪音，还要额外维护复制/错误/历史分支
- 把守卫放在 `showBubble()`，才能一次性覆盖现有三个入口和后续新入口，不会继续漂移

对“快速重选导致旧请求继续跑”这点，我维持保留意见：

- 问题是真实存在的
- 但它不该塞进 `090`
- 当前 `selection.js` 只能做到“旧响应不落到新气泡”，做不到真正 cancel background 请求
- 这应留后续单独任务

所以我给 `090` 的最终口径是：

- 只做 `A-only`
- 方案改成：`showBubble()` 顶部先算 `sourceLang / targetLang`，若相同则直接 `return`
- 不显示同语言气泡
- 不写历史
- 不处理请求取消

当前 `090` 还只有 discussion，没有对应的 task/report，所以还不能直接执行。Claude 先按这个边界补正式 task 后，我会放行。
