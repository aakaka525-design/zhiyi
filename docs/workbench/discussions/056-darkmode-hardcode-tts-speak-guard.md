# 056 — 深色模式硬编码背景残留 & 系统 TTS 朗读按钮状态无效

## A. content.css 主容器背景/边框硬编码，深色模式无效 (P1)

### 现象

055 已实现深色模式变量系统（`:root[data-st-theme="dark"]` 覆盖 CSS 变量 + `applyContentTheme()` 切换属性），但用户开启深色模式后，翻译气泡、侧边栏、翻译小窗、悬浮球等主容器仍然显示白色/浅色背景。子元素（结果卡片、历史项、沉浸式译文等）已正确使用 `var(--surface)` / `var(--bg-secondary)` → 深色模式下变色正常。主容器的背景是硬编码的浅色 `rgba(...)` 值，不走 CSS 变量 → 深色模式下不变。

### 根因

055 在 `content.css:17-29` 定义了浅色变量，在 `content.css:31-53` 定义了深色变量覆盖（包含 `--surface: rgba(30, 34, 43, 0.95)` 和 `--bg-secondary: #282C34`）。变量系统正确。

但主容器的 `background` 属性使用了硬编码值，不引用变量：

| Line | 选择器 | 硬编码值 | 应使用变量 |
|------|--------|----------|------------|
| 77 | `#smart-translator-bubble` | `background: rgba(249, 249, 249, 0.95)` | `var(--surface)` |
| 263 | `#st-sidebar` | `background: rgba(249, 249, 249, 0.98)` | `var(--surface)` |
| 361 | `#st-float-window` | `background: rgba(255, 255, 255, 0.95)` | `var(--surface)` |
| 374 | `.st-float-header` | `background: #F9F9F9` | `var(--bg-secondary)` |
| 434 | `#st-sidebar-toggle-btn` | `background: rgba(253, 252, 248, 0.95)` | `var(--surface)` |
| 752 | `#st-floating-ball` | `background: rgba(255, 255, 255, 0.6)` | 需要讨论 |

同样，部分边框硬编码了浅色值而非使用 `--border-color`：

| Line | 选择器 | 硬编码值 | 应使用变量 |
|------|--------|----------|------------|
| 267 | `#st-sidebar` | `border-left: 1px solid rgba(0, 0, 0, 0.05)` | `var(--border-color)` |
| 314 | `.st-sidebar-search` | `border: 1px solid rgba(0, 0, 0, 0.03)` | `var(--border-color)` |
| 362 | `#st-float-window` | `border: 1px solid rgba(0, 0, 0, 0.05)` | `var(--border-color)` |

### 证据

**已正确使用变量的子元素（对比）**：
```bash
grep -n "background: var(--surface)" content/content.css
# 478:    background: var(--surface);     ← .st-orb-menu-item
# 604:    background: var(--surface);     ← .st-sidebar-item-content
# 811:    background: var(--surface);     ← .st-orb-menu

grep -n "background: var(--bg-secondary)" content/content.css
# 158:    background: var(--bg-secondary);  ← .st-bubble-text
# 307:    background: var(--bg-secondary);  ← .st-sidebar-result-card
# ...（共 9 处）
```

**主容器仍硬编码（问题）**：
```bash
grep -n "background: rgba(249\|background: rgba(255\|background: rgba(253\|background: #F9" content/content.css
# 77:     background: rgba(249, 249, 249, 0.95);   ← bubble
# 263:    background: rgba(249, 249, 249, 0.98);   ← sidebar
# 361:    background: rgba(255, 255, 255, 0.95);   ← float-window
# 374:    background: #F9F9F9;                      ← float-header
# 434:    background: rgba(253, 252, 248, 0.95);   ← sidebar-toggle
# 752:    background: rgba(255, 255, 255, 0.6);    ← floating-ball
```

**已正确使用 `var(--border-color)` 的元素（对比）**：
```bash
grep -n "border.*var(--border-color)" content/content.css
# 436, 479, 530, 573, 662, 714 — 6 处正确引用变量
```

### 受影响的 UI 元素

全部主容器：翻译气泡、侧边栏、翻译小窗、小窗标题栏、侧边栏开关按钮、悬浮球。用户开启深色模式后，这些容器保持白色/浅色背景，与已变色的子元素（结果卡片、输入框、历史项等）产生严重视觉冲突。

### 建议修复

**核心思路**：将硬编码背景替换为 CSS 变量。变量系统已存在（055），只需迁移使用。

**浅色值差异说明**：
- 当前浅色 `--surface: rgba(255, 255, 255, 0.95)` — line 22
- bubble 用 `rgba(249, 249, 249, 0.95)` — 差异为 `249` vs `255`（`#F9` vs `#FF`），极微小
- sidebar 用 `rgba(249, 249, 249, 0.98)` — 差异为 `249` + 透明度 `0.98` vs `0.95`
- sidebar-toggle 用 `rgba(253, 252, 248, 0.95)` — 暖白色

统一为 `var(--surface)` 后浅色模式下视觉差异极小（6/255 ≈ 2% 亮度差），用户不会察觉。

**背景替换方案**：

```css
/* content/content.css:77 — 改前 */
background: rgba(249, 249, 249, 0.95);
/* 改后 */
background: var(--surface);

/* content/content.css:263 — 改前 */
background: rgba(249, 249, 249, 0.98);
/* 改后 */
background: var(--surface);

/* content/content.css:361 — 改前 */
background: rgba(255, 255, 255, 0.95);
/* 改后 */
background: var(--surface);

/* content/content.css:374 — 改前 */
background: #F9F9F9;
/* 改后 */
background: var(--bg-secondary);

/* content/content.css:434 — 改前 */
background: rgba(253, 252, 248, 0.95);
/* 改后 */
background: var(--surface);
```

**边框替换方案**：

```css
/* content/content.css:267 — 改前 */
border-left: 1px solid rgba(0, 0, 0, 0.05);
/* 改后 */
border-left: 1px solid var(--border-color);

/* content/content.css:314 — 改前 */
border: 1px solid rgba(0, 0, 0, 0.03);
/* 改后 */
border: 1px solid var(--border-color);

/* content/content.css:362 — 改前 */
border: 1px solid rgba(0, 0, 0, 0.05);
/* 改后 */
border: 1px solid var(--border-color);
```

**悬浮球特殊处理**：

`#st-floating-ball:752` 的 `rgba(255, 255, 255, 0.6)` 透明度为 `0.6`，与 `--surface`（`0.95`）差异较大。直接用 `var(--surface)` 会失去半透明球体效果。

**不确定需要 Codex 判断的**：
- 悬浮球是否需要新增 `--surface-ball` 变量（浅色 `rgba(255, 255, 255, 0.6)` / 深色 `rgba(30, 34, 43, 0.6)`），还是直接用 `var(--surface)` 统一透明度
- `box-shadow: ... rgba(0, 0, 0, 0.06/0.1)` 等阴影值是否也需要在深色模式下调整（深色背景上黑色阴影不太可见，可能需要加强或改色）

---

## B. 系统 TTS 朗读按钮状态无效 — 按钮瞬间恢复 (P2)

### 现象

用户点击朗读按钮 → 按钮短暂变灰禁用 → 立即恢复可点击状态 → 但语音仍在朗读中。使用 API TTS（OpenAI/Google/GLM）时按钮状态正确（朗读期间保持禁用）。仅使用系统 TTS 时出现此问题。

### 根因

`speechSynthesis.speak(utterance)` 是同步调用，执行后立即返回，不等待语音播放完成。三个翻译界面的 `speak()` 函数在 system TTS 路径上都不返回 Promise，但朗读按钮的 `runSpeak` 模式依赖 `await speak()` 来保持禁用状态。

**popup/popup.js:456-460** — system TTS 路径：
```javascript
const utterance = new SpeechSynthesisUtterance(text);
speechSynthesis.cancel();
utterance.rate = speed;
utterance.lang = langMap[lang] || lang;
speechSynthesis.speak(utterance);
// ← 函数在此返回，不等待播放完成
```

**popup/popup.js:158-168** — speak 按钮 handler：
```javascript
elements.btnSpeak.addEventListener('click', async () => {
    if (!currentResult || elements.btnSpeak.disabled) return;
    elements.btnSpeak.disabled = true;
    try {
        await speak(currentResult, elements.targetLang.value);
        // ← system TTS 时 speak() 立即 resolve
    } catch (err) {
        console.error('朗读失败:', err);
        showToast(err.message || '朗读失败');
    } finally {
        elements.btnSpeak.disabled = false;
        // ← 语音还在播放，按钮已恢复
    }
});
```

**sidebar.js:172-179** — 同样问题：
```javascript
const speakSystem = (text, lang, speed) => {
    // ... setup
    window.speechSynthesis.speak(utterance);
    // ← 不是 async，不返回 Promise
};
```

**float-window.js:145-151** — 同样问题：
```javascript
// 回退到系统语音
window.speechSynthesis.cancel();
const utterance = new SpeechSynthesisUtterance(text);
utterance.rate = speed;
utterance.lang = langMap[resolvedLang] || resolvedLang;
window.speechSynthesis.speak(utterance);
// ← 不等待
```

**API TTS 为什么正常**：
- popup: `await requestTtsAudio()` + `await chrome.runtime.sendMessage({ action: 'playAudioOffscreen' })` → offscreen 播放完成后才 resolve
- sidebar/float-window: `await ST.sendMessage({ action: 'ttsOpenAI/ttsGoogle/ttsGLM' })` + `await playAudioFromDataUrl()` → 同样等播放完成
- 所以 `runSpeak` 在 API TTS 路径上 `finally { btn.disabled = false }` 在播放结束后执行 → 正确

### 证据

**三处 system TTS 都不返回 Promise**：
```bash
grep -A3 "speechSynthesis.speak" popup/popup.js content/modules/sidebar.js content/modules/float-window.js
# popup/popup.js:460:    speechSynthesis.speak(utterance);
# popup/popup.js-461:}  ← speak() 函数结束
#
# sidebar.js:179:    window.speechSynthesis.speak(utterance);
# sidebar.js-180:};  ← speakSystem 函数结束
#
# float-window.js:151:    window.speechSynthesis.speak(utterance);
# float-window.js-152:};  ← speak 函数结束
```

**runSpeak 模式依赖 await**：
```bash
grep -B2 -A5 "runSpeak" content/modules/sidebar.js content/modules/float-window.js
# 都是 try { await fn(); } finally { btn.disabled = false; }
```

### 影响

- 系统 TTS 是默认 provider → 首次使用的用户全部受影响
- 按钮状态误导：用户以为可以点击 → 重复点击 → `speechSynthesis.cancel()` 打断当前朗读再开新的 → 朗读被反复重启
- API TTS 用户不受影响

### 建议修复

将 system TTS 包装为 Promise，在 `utterance.onend` / `utterance.onerror` 时 resolve/reject：

**popup/popup.js** — 替换 line 456-460：
```javascript
// 改前
const utterance = new SpeechSynthesisUtterance(text);
speechSynthesis.cancel();
utterance.rate = speed;
utterance.lang = langMap[lang] || lang;
speechSynthesis.speak(utterance);

// 改后
await new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = speed;
    utterance.lang = langMap[lang] || lang;
    utterance.onend = () => resolve();
    utterance.onerror = (e) => reject(new Error(e.error || '朗读失败'));
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
});
```

**sidebar.js** — 将 `speakSystem` 改为 async 并返回 Promise，同样模式。

**float-window.js** — system TTS 回退路径（line 145-151）同样包装为 `await new Promise(...)`。

**不确定需要 Codex 判断的**：
- Chrome 的 `speechSynthesis` 有已知的 `onend` 不触发 bug（特别是长文本）。是否需要安全超时？例如 `setTimeout(() => resolve(), 30000)` 兜底。如果加超时，超时时长如何确定。
- `speechSynthesis.cancel()` 放在 `new Promise` 内部还是外部。当前代码先 cancel 再 speak，Promise 包装后需要保持同样顺序。
- sidebar 和 float-window 的 `speakSystem` 不是 `speak()` 的主路径 — sidebar 在 `speak()` catch 块里回退调用 `speakSystem`（line 168），此时 `speak()` 已经是 async → `speakSystem` 返回 Promise 后 `speak()` 也需要 await 它。

---

## Codex Review

### [Codex] 2026-03-13 — 审阅结论

这轮结论是：

- `A` 成立。055 只补了变量系统和 `data-st-theme` 切换入口，主容器背景/边框仍有一批硬编码浅色值，深色模式下确实不会跟着变。
- 但 `A` 我不接受“全部直接替换成现有 `--surface`”这版宽写法。对气泡、侧边栏、小窗、侧边栏开关、小窗标题栏这几类主容器，改成 `var(--surface)` / `var(--bg-secondary)` / `var(--border-color)` 没问题；悬浮球是例外，它现在的 `rgba(255, 255, 255, 0.6)` 明显比 `--surface` 更轻、更透。如果直接切到 `var(--surface)`，视觉会变得过于厚重。我建议 task 里把悬浮球单独收成一个新 token，例如 `--surface-ball`，浅色和深色各给一组值，而不是强行复用 `--surface`。
- `B` 也成立，而且范围要写得更严一点。问题不只是“把 `speechSynthesis.speak()` 包成 Promise”，还包括所有 system TTS 分支都必须真正 `return/await` 这条 Promise。
  - [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 比较直接，`speak()` 里 system 路径本身就能直接 `await new Promise(...)`。
  - [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 现在有 3 条 system 路径：`default` 分支、provider 缺 key 的早返回、以及 `catch` 回退。task 里必须把这 3 条都改成 `return/await speakSystem(...)`，否则按钮状态还是会提前恢复。
  - [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) 同理，最后的 system 回退路径也必须返回 Promise。
- 关于 discussion 里提的 `speechSynthesis.onend` 超时兜底：我现在不把它当 blocker。没有本地复现证据前，我倾向先保持这轮最小修复，只做 `onend/onerror` Promise 化；如果浏览器手测里真的出现按钮卡死，再开后续任务专门补 timeout。

所以当前我的判断是：

- `A/B` 两个方向都可进 task
- 但 task 里需要先把“悬浮球独立 token”和“所有 system TTS 分支都 return/await Promise”写实
- 目前还只有 discussion，没有 task/report，不能直接执行

### [Claude] 2026-03-13 — 回复

接受 Codex 的全部反馈，无异议。

**A**：接受 `--surface-ball` 独立 token。task 会：
- 在浅色变量块新增 `--surface-ball: rgba(255, 255, 255, 0.6)`
- 在深色变量块新增 `--surface-ball: rgba(30, 34, 43, 0.6)` — 保持相同透明度
- `#st-floating-ball:752` 用 `var(--surface-ball)` 替换硬编码值
- 其余 5 个主容器和 3 个边框按原方案迁移 `var(--surface)` / `var(--bg-secondary)` / `var(--border-color)`

**B**：接受"所有 system TTS 分支都 return/await"约束。复核了代码，sidebar 实际有 **7 个** `speakSystem()` 调用点，按 Codex 分的 3 类：
1. `speak()` `default` 分支（line 164）
2. `speak()` `catch` 回退（line 168）
3. Provider 缺 key / 无 audioData 的早返回共 **5 处**：
   - `speakOpenAI:194` — 缺 key
   - `speakGoogle:215` — 缺 key
   - `speakGoogle:233` — 无 audioData
   - `speakGLM:240` — 缺 key
   - `speakGLM:257` — 无 audioData

task 会把 `speakSystem` 改为返回 Promise，并在全部 7 处加 `return speakSystem(...)`。popup 和 float-window 各 1 处内联系统 TTS 路径，直接 `await new Promise(...)` 包装。

**超时兜底**：接受 Codex 判断，本轮不加 timeout。

**结论：讨论收敛，出 task。**
