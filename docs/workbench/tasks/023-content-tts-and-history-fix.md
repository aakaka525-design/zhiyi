---
status: done
priority: P2
created: 2026-03-13
discussion: 023-content-tts-and-css-tokens
---

# 023 — Content TTS 语言修复 & Sidebar 历史状态同步

## 背景

023 讨论经 Codex 复核后收敛。本 task 覆盖 A（TTS 语言）和 B（历史状态），C（CSS token）拆为独立 task 024。

---

## 任务 A：修复 TTS Google voice 选择不 resolve `'auto'`/`undefined`

### A1. Float-window source speak 入口传 `'auto'`

**文件**：`content/modules/float-window.js:148`

**当前**：
```javascript
speakSourceBtn.onclick = () => speak(input.value);
```

**修复**：
```javascript
speakSourceBtn.onclick = () => speak(input.value, 'auto');
```

### A2. Float-window `speak()` 内 Google TTS 路径使用 `resolvedLang`

**文件**：`content/modules/float-window.js:89-146`

**当前**：`resolvedLang` 只在系统 TTS 回退段（line 140）计算。Google TTS 路径（line 121）直接使用原始 `lang`。

**修复**：在 `speak` 函数顶部（line 90 `if (!text) return;` 之后）统一计算 `resolvedLang`：

```javascript
const resolvedLang = !lang || lang === 'auto' ? ST.detectLanguage(text) : lang;
```

然后 Google TTS voice 选择（line 121）改为：

```javascript
voice: settings.ttsVoice || ST.getDefaultGoogleTtsVoice(resolvedLang),
```

系统 TTS 回退（line 140）复用同一个 `resolvedLang`，删掉重复计算。

### A3. Sidebar `speakGoogle()` 同样使用 `resolvedLang`

**文件**：`content/modules/sidebar.js:209-231`

**当前**（line 216）：
```javascript
const voice = settings.ttsVoice || ST.getDefaultGoogleTtsVoice(lang);
```

**问题**：当 `sourceLangSelect.value === 'auto'` 时，`ST.getDefaultGoogleTtsVoice('auto')` 找不到 key，fallback 到中文。

**修复**：在 `speakGoogle()` 顶部 resolve lang：

```javascript
const resolvedLang = !lang || lang === 'auto' ? ST.detectLanguage(text) : lang;
const voice = settings.ttsVoice || ST.getDefaultGoogleTtsVoice(resolvedLang);
```

注意：sidebar 的 `speakSystem()` 已经有 `resolvedLang`（line 171），不需要改。

---

## 任务 B：Sidebar 历史点击同步完整 UI 状态

**文件**：`content/modules/sidebar.js`

### B1. 补存 `sourceLang` 和 `targetLang` 到 dataset

**当前**（line 318-319）：
```javascript
historyItem.dataset.source = item.source;
historyItem.dataset.target = item.target;
```

**修复**：追加：
```javascript
historyItem.dataset.sourceLang = item.sourceLang || '';
historyItem.dataset.targetLang = item.targetLang || '';
```

### B2. 历史点击时同步语言选择器和结果标签

**当前**（line 330-336）：
```javascript
historyItem.onclick = () => {
    input.value = historyItem.dataset.source;
    resultContent.innerText = historyItem.dataset.target;
    resultContent.style.color = '';
    resultCard.classList.add('active');
    translateBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
};
```

**修复**：在 `resultCard.classList.add('active');` 之后加入：
```javascript
const sl = historyItem.dataset.sourceLang;
const tl = historyItem.dataset.targetLang;
if (sl) sourceLangSelect.value = sl;
else sourceLangSelect.value = 'auto';
if (tl) {
    targetLangSelect.value = tl;
    resultLang.innerText = `翻译结果 (${tl})`;
} else {
    resultLang.innerText = '翻译结果';
}
```

---

## 不做的事

- 不给 float-window 加源语言选择器（product-surface 任务）
- 不合并 sidebar/float-window 的 speak 函数（架构任务）
- 不碰 CSS / content.css（024 任务）
- 不碰 service-worker、manifest、popup、options、translator.js

## 验收标准

- [x] float-window source speak 传 `'auto'`，Google TTS 路径使用 `resolvedLang` 选 voice
- [x] sidebar `speakGoogle()` 在 voice 选择前 resolve `'auto'`
- [x] sidebar 历史点击后 `sourceLangSelect`、`targetLangSelect`、`resultLang` 均同步更新
- [x] 历史旧数据缺 lang 字段时 fallback 到 `'auto'` 和 `'翻译结果'`
