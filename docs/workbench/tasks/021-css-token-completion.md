---
status: done
priority: P2
created: 2026-03-13
---

# 021 — content.css 残余硬编码颜色 token 化 & Float-window 朗读 lang & 历史回填标签

- 来源讨论: [discussions/021-css-token-completion.md](../discussions/021-css-token-completion.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/021-css-token-completion.md](../discussions/021-css-token-completion.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/content.css` | A: token scope 补入 + 20 处 hex→var 替换 |
| `content/modules/float-window.js` | B: speak lang 修复 |
| `content/modules/sidebar.js` | C: 历史点击 UI 同步 |
| `tests/css-token-and-speak.test.mjs` | A + B + C |

## 任务清单

### 必做

#### A. content.css 硬编码颜色 token 化

**执行顺序**：先 A1（scope 补入），再 A2（替换）。

**A1. Token scope 补入 `#smart-translator-icon`**

- [x] `content/content.css` — 顶部 token scope 选择器（当前 line 6-15），在 `#st-floating-ball-container` 之后补入：
  ```css
  /* 改前 */
  #st-floating-ball-container,
  .st-immersive-translation,
  /* 改后 */
  #st-floating-ball-container,
  #smart-translator-icon,
  .st-immersive-translation,
  ```

**A2. 20 处 hex → var() 等值替换**

每处都是精确的 1:1 等值替换，视觉输出完全不变。

- [x] line 44 `#smart-translator-bubble` — `color: #333333` → `color: var(--text-primary)`
- [x] line 81 `.st-bubble-logo` — `color: #7A9A8B` → `color: var(--accent)`
- [x] line 97 `.st-action-btn` — `color: #999999` → `color: var(--text-tertiary)`
- [x] line 103 `.st-action-btn:hover` — `background: #F4F4F4` → `background: var(--bg-secondary)`
- [x] line 104 `.st-action-btn:hover` — `color: #7A9A8B` → `color: var(--accent)`
- [x] line 111 `.st-bubble-result` — `color: #333333` → `color: var(--text-primary)`
- [x] line 159 `#smart-translator-icon` — `background: #7A9A8B` → `background: var(--accent)`
- [x] line 173 `#smart-translator-icon:hover` — `background: #9CBAB0` → `background: var(--accent-light)`
- [x] line 219 `#st-sidebar` — `color: #333333` → `color: var(--text-primary)`
- [x] line 231 `.st-sidebar-header` — `border-bottom: 1px solid #F4F4F4` → `border-bottom: 1px solid var(--bg-secondary)`
- [x] line 238 `.st-sidebar-title` — `color: #333333` → `color: var(--text-primary)`
- [x] line 252 `.st-sidebar-search` — `background: #F4F4F4` → `background: var(--bg-secondary)`
- [x] line 265 `.st-sidebar-input` — `color: #333333` → `color: var(--text-primary)`
- [x] line 274 `.st-sidebar-btn` — `background: #7A9A8B` → `background: var(--accent)`
- [x] line 288 `.st-sidebar-btn:hover` — `background: #9CBAB0` → `background: var(--accent-light)`
- [x] line 319 `.st-float-header` — `border-bottom: 1px solid #F4F4F4` → `border-bottom: 1px solid var(--bg-secondary)`
- [x] line 325 `.st-float-title` — `color: #7A9A8B` → `color: var(--accent)`
- [x] line 678 `#st-floating-ball` — `color: #7A9A8B` → `color: var(--accent)`
- [x] line 686 `#st-floating-ball:hover` — `background: #7A9A8B` → `background: var(--accent)`
- [x] line 731 `.st-orb-menu-item` — `color: #7A9A8B` → `color: var(--accent)`
- [x] line 738 `.st-orb-menu-item:hover` — `background: #7A9A8B` → `background: var(--accent)`

**不要做的事**：
- 不要动 `rgba(122, 154, 139, ...)` 系列透明色 — 无对应 token
- 不要动 `.st-float-header` `background: #F9F9F9` — 无精确 token
- 不要动 token 定义本身（line 16-27）
- 不要动 CSS 注释中的颜色值

### 必做

#### B. Float-window 朗读原文 lang 修复

两步修改：source button 传 `'auto'`，speak 函数内 `resolvedLang` 提升到顶部。

**B1. speakSourceBtn 传 lang**

- [x] `content/modules/float-window.js` — speakSourceBtn 绑定（当前 line 148），改为：
  ```javascript
  // 改前
  speakSourceBtn.onclick = () => speak(input.value);
  // 改后
  speakSourceBtn.onclick = () => speak(input.value, 'auto');
  ```

**B2. resolvedLang 提升到 speak 函数顶部**

- [x] `content/modules/float-window.js` — speak 函数内（当前 line 89-93），在 `const speed = ...` 之后加入 resolvedLang 计算，并让 Google voice 和 system TTS 都使用它：
  ```javascript
  const speak = async (text, lang) => {
      if (!text) return;
      const settings = ST.state.settings || {};
      const provider = settings.ttsProvider || 'system';
      const speed = settings.ttsSpeed || 1.0;
      const resolvedLang = !lang || lang === 'auto' ? ST.detectLanguage(text) : lang;

      // ... playAudio 函数不变 ...

      try {
          // ... openai 分支不变 ...
          } else if (provider === 'google' && settings.geminiApiKey) {
              const response = await ST.sendMessage({
                  action: 'ttsGoogle',
                  apiKey: settings.geminiApiKey,
                  text,
                  voice: settings.ttsVoice || ST.getDefaultGoogleTtsVoice(resolvedLang),
                  speed
              });
          // ... glm 分支不变 ...
      }
      // 回退到系统语音
      const langMap = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP', ko: 'ko-KR' };
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = speed;
      utterance.lang = langMap[resolvedLang] || resolvedLang;
      window.speechSynthesis.speak(utterance);
  };
  ```

  具体改动点：
  - line 93 后新增：`const resolvedLang = !lang || lang === 'auto' ? ST.detectLanguage(text) : lang;`
  - line 121：`ST.getDefaultGoogleTtsVoice(lang)` → `ST.getDefaultGoogleTtsVoice(resolvedLang)`
  - line 140：删除旧的 `const resolvedLang = ...` 行（已提升到顶部）

**不要做的事**：
- 不要给 float-window 加源语言选择器 — product-surface 任务
- 不要改 sidebar 的 speak 函数 — 它有 sourceLangSelect，不存在这个问题

### 推荐

#### C. Sidebar 历史点击 UI 同步

历史点击时，利用 `item.targetLang` 同步 `targetLangSelect` 和 `resultLang` 标签。

- [x] `content/modules/sidebar.js` — historyItem.onclick 内（当前 line 330-336）。首先需要在 historyItem 上存储 targetLang（line 318-319 附近），然后在 onclick 中同步 UI：
  ```javascript
  // 在 historyItem 创建时，增加 targetLang dataset
  historyItem.dataset.source = item.source;
  historyItem.dataset.target = item.target;
  historyItem.dataset.targetLang = item.targetLang || '';

  // onclick 内增加 UI 同步
  historyItem.onclick = () => {
      input.value = historyItem.dataset.source;
      resultContent.innerText = historyItem.dataset.target;
      resultContent.style.color = '';
      resultCard.classList.add('active');
      if (historyItem.dataset.targetLang) {
          targetLangSelect.value = historyItem.dataset.targetLang;
          resultLang.innerText = `翻译结果 (${historyItem.dataset.targetLang})`;
      } else {
          resultLang.innerText = '翻译结果';
      }
      translateBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  ```

**不要做的事**：
- 不要回填 `sourceLangSelect` — 可选但不在本轮范围
- 不要改历史记录的 storage schema

## 不做的事

- **不做** `rgba(122, 154, 139, ...)` 透明色 token 化 — 无对应 token
- **不做** `.st-float-header` `background: #F9F9F9` token 化 — 无精确 token
- **不做** float-window 加源语言选择器 — product-surface 任务
- **不做** sidebar/float-window speak 函数合并 — 架构任务
- **不做** sourceLangSelect 回填 — 可选，不在本轮
- **不碰** service-worker、manifest、popup、options、translator.js、message-router.js、selection.js、immersive.js

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check content/modules/float-window.js` 通过
- [x] `node --check content/modules/sidebar.js` 通过
- [x] `git diff --check` 无输出
