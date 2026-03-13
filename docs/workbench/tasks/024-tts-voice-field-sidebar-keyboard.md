---
status: done
priority: P2
created: 2026-03-13
---

# 024 — TTS voice 拆分三字段 + Sidebar 键盘快捷键(IME 保护) + History 子视图状态统一

- 来源讨论: [discussions/024-tts-voice-field-sidebar-keyboard.md](../discussions/024-tts-voice-field-sidebar-keyboard.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/024-tts-voice-field-sidebar-keyboard.md](../discussions/024-tts-voice-field-sidebar-keyboard.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `src/core/storage.js` | A: DEFAULT_SETTINGS 三字段 + sanitizeSettings 迁移 |
| `options/options.js` | A: loadSettings + collectTtsVoices + collectCurrentSettings + C: switchHistoryTab helper |
| `options/options-ui-state.js` | A: buildSettingsSnapshot 三字段 |
| `popup/popup.js` | A: requestTtsAudio 读对应字段 |
| `content/modules/sidebar.js` | A: speakOpenAI/Google/GLM 读对应字段 + B: keydown handler |
| `content/modules/float-window.js` | A: speak 读对应字段 |
| `content/content.js` | A: mergeDefaults 三字段 |
| `tests/tts-voice-sidebar-history.test.mjs` | A + B + C |

## 任务清单

### 必做

#### A. TTS voice 拆分为三个独立字段

将 `ttsVoice` 单字段拆分为 `ttsVoiceOpenai`、`ttsVoiceGoogle`、`ttsVoiceGlm`，覆盖存储层、设置页、dirty tracking、所有消费端和 fallback defaults。

**A1. `src/core/storage.js` — DEFAULT_SETTINGS 和迁移**

- [x] DEFAULT_SETTINGS（当前 line 61）删除 `ttsVoice: ''`，新增三个字段：
  ```javascript
  // 改前
  ttsVoice: '', // 具体声音ID，留空使用默认

  // 改后
  ttsVoiceOpenai: '',
  ttsVoiceGoogle: '',
  ttsVoiceGlm: '',
  ```

- [x] `sanitizeSettings()`（当前 line 24-33）在现有逻辑**之前**添加迁移：
  ```javascript
  function sanitizeSettings(settings = {}) {
      const cleaned = { ...settings };

      // 迁移: ttsVoice 单字段 → 三个独立字段
      if (cleaned.ttsVoice) {
          const provider = cleaned.ttsProvider || 'system';
          if (provider === 'openai' && !cleaned.ttsVoiceOpenai) {
              cleaned.ttsVoiceOpenai = cleaned.ttsVoice;
          } else if (provider === 'google' && !cleaned.ttsVoiceGoogle) {
              cleaned.ttsVoiceGoogle = cleaned.ttsVoice;
          } else if (provider === 'glm' && !cleaned.ttsVoiceGlm) {
              cleaned.ttsVoiceGlm = cleaned.ttsVoice;
          }
          delete cleaned.ttsVoice;
      }

      // 下面是现有的 legacy key 清理和 ttsProvider 迁移，不动
      LEGACY_SETTINGS_KEYS.forEach((key) => { ... });
      if (cleaned.ttsProvider === 'edge' || cleaned.ttsProvider === 'fish') { ... }
      return cleaned;
  }
  ```

**A2. `content/content.js` — mergeDefaults**

- [x] `mergeDefaults()` 函数（当前 line 23）删除 `ttsVoice: ''`，新增三个字段：
  ```javascript
  // 改前
  ttsVoice: '',

  // 改后
  ttsVoiceOpenai: '',
  ttsVoiceGoogle: '',
  ttsVoiceGlm: '',
  ```

**A3. `options/options-ui-state.js` — buildSettingsSnapshot**

- [x] `buildSettingsSnapshot()`（当前 line 23）删除 `ttsVoice`，新增三个字段：
  ```javascript
  // 改前
  ttsVoice: settings.ttsVoice || '',

  // 改后
  ttsVoiceOpenai: settings.ttsVoiceOpenai || '',
  ttsVoiceGoogle: settings.ttsVoiceGoogle || '',
  ttsVoiceGlm: settings.ttsVoiceGlm || '',
  ```

**A4. `options/options.js` — loadSettings**

- [x] `loadSettings()`（当前 line 111-113）改为从各自字段加载：
  ```javascript
  // 改前
  elements.ttsVoiceOpenai.value = settings.ttsVoice || 'nova';
  elements.ttsVoiceGoogle.value = settings.ttsVoice || 'cmn-CN-Chirp3-HD-Aoede';
  elements.ttsVoiceGlm.value = settings.ttsVoice || 'tongtong';

  // 改后
  elements.ttsVoiceOpenai.value = settings.ttsVoiceOpenai || 'nova';
  elements.ttsVoiceGoogle.value = settings.ttsVoiceGoogle || 'cmn-CN-Chirp3-HD-Aoede';
  elements.ttsVoiceGlm.value = settings.ttsVoiceGlm || 'tongtong';
  ```

**A5. `options/options.js` — getSelectedTtsVoice → collectTtsVoices**

- [x] 将 `getSelectedTtsVoice()`（当前 line 483-494）替换为 `collectTtsVoices()`：
  ```javascript
  // 改前
  function getSelectedTtsVoice() {
      switch (elements.ttsProvider.value) {
          case 'openai':  return elements.ttsVoiceOpenai.value;
          case 'google':  return elements.ttsVoiceGoogle.value;
          case 'glm':     return elements.ttsVoiceGlm.value;
          default:        return '';
      }
  }

  // 改后
  function collectTtsVoices() {
      return {
          ttsVoiceOpenai: elements.ttsVoiceOpenai.value,
          ttsVoiceGoogle: elements.ttsVoiceGoogle.value,
          ttsVoiceGlm: elements.ttsVoiceGlm.value,
      };
  }
  ```

**A6. `options/options.js` — collectCurrentSettings**

- [x] `collectCurrentSettings()`（当前 line 516）改为展开三个字段：
  ```javascript
  // 改前
  ttsVoice: getSelectedTtsVoice(),

  // 改后
  ...collectTtsVoices(),
  ```

**A7. `popup/popup.js` — requestTtsAudio 消费端**

- [x] OpenAI 分支（当前 line 435）：
  ```javascript
  // 改前
  voice: settings.ttsVoice || 'nova',
  // 改后
  voice: settings.ttsVoiceOpenai || 'nova',
  ```

- [x] Google 分支（当前 line 457）：
  ```javascript
  // 改前
  voice: settings.ttsVoice || voiceMap[lang] || voiceMap.zh,
  // 改后
  voice: settings.ttsVoiceGoogle || voiceMap[lang] || voiceMap.zh,
  ```

- [x] GLM 分支（当前 line 473）：
  ```javascript
  // 改前
  voice: settings.ttsVoice || 'tongtong',
  // 改后
  voice: settings.ttsVoiceGlm || 'tongtong',
  ```

**A8. `content/modules/sidebar.js` — speak 消费端**

- [x] `speakOpenAI`（当前 line 198）：
  ```javascript
  // 改前
  voice: settings.ttsVoice || 'nova',
  // 改后
  voice: settings.ttsVoiceOpenai || 'nova',
  ```

- [x] `speakGoogle`（当前 line 216）：
  ```javascript
  // 改前
  const voice = settings.ttsVoice || ST.getDefaultGoogleTtsVoice(lang);
  // 改后
  const voice = settings.ttsVoiceGoogle || ST.getDefaultGoogleTtsVoice(lang);
  ```

- [x] `speakGLM`（当前 line 240）：
  ```javascript
  // 改前
  const voice = settings.ttsVoice || 'tongtong';
  // 改后
  const voice = settings.ttsVoiceGlm || 'tongtong';
  ```

**A9. `content/modules/float-window.js` — speak 消费端**

- [x] OpenAI 分支（当前 line 113）：
  ```javascript
  // 改前
  voice: settings.ttsVoice || 'nova',
  // 改后
  voice: settings.ttsVoiceOpenai || 'nova',
  ```

- [x] Google 分支（当前 line 122）：
  ```javascript
  // 改前
  voice: settings.ttsVoice || ST.getDefaultGoogleTtsVoice(resolvedLang),
  // 改后
  voice: settings.ttsVoiceGoogle || ST.getDefaultGoogleTtsVoice(resolvedLang),
  ```

- [x] GLM 分支（当前 line 131）：
  ```javascript
  // 改前
  voice: settings.ttsVoice || 'tongtong',
  // 改后
  voice: settings.ttsVoiceGlm || 'tongtong',
  ```

**不要做的事**：
- 不要改 `options/options.html` 中 TTS voice select 的 option 列表
- 不要改 `background/modules/tts.js` — 后台 TTS handler 从 request 接收 voice，不读 settings
- 不要改 `options/options.js` 中的 `requestTtsTestAudio()` — 它已经从各自 element 读值，不经过 `getSelectedTtsVoice()`
- 不要碰 dirty tracking 的 `trackedFields` 列表 — 它已经分别 track 三个 voice select element

### 推荐

#### B. Sidebar 键盘翻译快捷键（含 IME 保护）

给侧边栏 textarea 添加 `Enter`（无 Shift）触发翻译，但必须排除 IME 组合输入。

- [x] `content/modules/sidebar.js` — 在 `translateBtn.onclick` 赋值之前（当前 line 260 附近），新增：
  ```javascript
  // 键盘快捷翻译 — Enter 发送，Shift+Enter 换行
  input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          translateBtn.click();
      }
  });
  ```

  关键：`!e.isComposing` 防止 CJK 输入法组合态下的 Enter 误触翻译。

**不要做的事**：
- 不要修改 float-window 的 Enter handler — 它也有 IME 缺口，但不在本轮范围
- 不要用 `Ctrl/Cmd + Enter` — 侧边栏使用模式更接近聊天输入，与 float-window 保持一致
- 不要加 `keyCode !== 229` 兼容守卫 — `isComposing` 在现代浏览器中已有足够支持，Chrome Extension 最低 Chrome 版本足够新

### 推荐

#### C. Options 历史子视图状态统一 helper（含 025-C 搜索框重置）

抽取 `switchHistoryTab(type)` helper，统一管理历史子视图的所有状态。同时解决 025-C（搜索框切换不清空）。

- [x] `options/options.js` — 在 `loadTab()` 函数附近（当前 line 426-430），新增 helper：
  ```javascript
  function switchHistoryTab(type) {
      // 同步标签 active 状态
      elements.historyTabs.forEach(b => b.classList.remove('active'));
      const targetBtn = document.querySelector(`.history-tab-btn[data-type="${type}"]`);
      if (targetBtn) targetBtn.classList.add('active');

      // 清空搜索框（025-C）
      const searchInput = document.getElementById('history-search');
      if (searchInput) searchInput.value = '';

      // 加载内容
      loadHistoryList(type);
  }
  ```

- [x] `options/options.js` — 标签切换 handler（当前 line 171-177）改为调用 helper：
  ```javascript
  // 改前
  elements.historyTabs.forEach(btn => {
      btn.addEventListener('click', () => {
          elements.historyTabs.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          loadHistoryList(btn.getAttribute('data-type'));
      });
  });

  // 改后
  elements.historyTabs.forEach(btn => {
      btn.addEventListener('click', () => {
          switchHistoryTab(btn.getAttribute('data-type'));
      });
  });
  ```

- [x] `options/options.js` — 清空历史 handler（当前 line 180-185）改为调用 helper：
  ```javascript
  // 改前
  elements.clearHistoryBtn.addEventListener('click', async () => {
      if (confirm('确定要清空所有翻译历史记录吗？')) {
          await StorageManager.clearHistory();
          loadHistoryList('recent');
      }
  });

  // 改后
  elements.clearHistoryBtn.addEventListener('click', async () => {
      if (confirm('确定要清空所有翻译历史记录吗？')) {
          await StorageManager.clearHistory();
          switchHistoryTab('recent');
      }
  });
  ```

- [x] `options/options.js` — `loadTab()`（当前 line 426-430）改为调用 helper：
  ```javascript
  // 改前
  function loadTab(name) {
      if (name === 'history') {
          loadHistoryList('recent');
      }
  }

  // 改后
  function loadTab(name) {
      if (name === 'history') {
          switchHistoryTab('recent');
      }
  }
  ```

**不要做的事**：
- 不要改 `loadHistoryList()` 函数本身 — 它只负责数据加载和渲染
- 不要改 `filterHistoryList()` — 搜索功能逻辑不变
- 不要改 `renderHistoryList()` — 渲染逻辑不变
- 不要改 `bindHistoryDeleteEvents()` — 删除事件不变

## 不做的事

- **不做** TTS speak 函数跨组件合并 — 架构任务
- **不做** popup Google TTS voiceMap 与 utils.js 去重 — 不同执行环境
- **不做** float-window Enter handler 的 IME 修复 — 不在本轮范围
- **不做** translateBatch DeepSeek 批量支持 — 已知 backlog
- **不碰** service-worker（除测试验证）、manifest、immersive、selection、floating-ball、ad-blocker、content.css、popup.html、options.html

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check src/core/storage.js` 通过
- [x] `node --check options/options.js` 通过
- [x] `node --check options/options-ui-state.js` 通过
- [x] `node --check popup/popup.js` 通过
- [x] `node --check content/content.js` 通过
- [x] `git diff --check` 无输出
- [x] `rg -n "settings\.ttsVoice\b" popup/popup.js content/modules/sidebar.js content/modules/float-window.js options/options.js content/content.js` 无输出（确认旧字段已替换；原始 grep 模式会误报新的 `ttsVoiceOpenai/Google/Glm`）
