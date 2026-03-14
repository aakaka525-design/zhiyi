---
status: done
priority: P2
created: 2026-03-13
---

# 057 — 侧边栏/小窗语言持久化 & Options TTS 测试按钮 Promise 化

- 来源讨论: [discussions/057-sidebar-lang-persist-options-tts-promise.md](../discussions/057-sidebar-lang-persist-options-tts-promise.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/057-sidebar-lang-persist-options-tts-promise.md](../discussions/057-sidebar-lang-persist-options-tts-promise.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/sidebar.js` | A：新增 `saveLanguageSettings` helper + 3 处调用 |
| `content/modules/float-window.js` | A：新增 `saveLanguageSettings` helper + 1 处调用 |
| `options/options.js` | B：`playSystemTtsTest` Promise 化 + `testTTS` await + 文案 |
| `tests/sidebar-lang-persist-options-tts-promise.test.mjs` | A + B |

## 任务清单

### 必做

#### A. 侧边栏/翻译小窗语言持久化

Popup 在语言变化时通过 `saveLanguageSettings()` 保存到 storage，但侧边栏和翻译小窗不保存。用户切换语言后导航到其他页面，语言选择重置为默认值。

- [x] `content/modules/sidebar.js` — 在语言初始化块之后、事件绑定之前（当前 line 118 和 line 120 之间），新增 `saveLanguageSettings` helper：
  ```javascript
  // 改前（line 118-120）
  }

  // 事件绑定

  // 改后
  }

  const saveLanguageSettings = async (partialSettings) => {
      const result = await chrome.storage.local.get('settings');
      const settings = result.settings || {};
      await chrome.storage.local.set({
          settings: { ...settings, ...partialSettings },
      });
  };

  // 事件绑定
  ```

  行为说明：
  - Promise 版 `chrome.storage.local.get/set` — 与仓库 MV3 风格一致
  - `partialSettings` 通过 spread merge 合入当前 settings — 不覆盖其他字段
  - 写入 `chrome.storage.local` → 自动触发 `content.js` 的 `chrome.storage.onChanged` → 更新 `ST.state.settings`
  - 局部函数，不挂在 `ST` 上 — 仅 sidebar 内部使用
  - 不需要 background 参与 — 直接本地存储操作

- [x] `content/modules/sidebar.js` — 在 `saveLanguageSettings` helper 之后、`ST.ui.sidebarBtn.onclick` 之前（当前 line 120-121 区域），新增 `change` 事件监听器：
  ```javascript
  // 改前（line 120-121）
  // 事件绑定
  ST.ui.sidebarBtn.onclick = () => ST.toggleSidebar();

  // 改后
  // 事件绑定
  sourceLangSelect.addEventListener('change', () => {
      saveLanguageSettings({ sourceLang: sourceLangSelect.value });
  });
  targetLangSelect.addEventListener('change', () => {
      saveLanguageSettings({ targetLang: targetLangSelect.value });
  });

  ST.ui.sidebarBtn.onclick = () => ST.toggleSidebar();
  ```

  行为说明：
  - `change` 事件在 `<select>` 值变化时触发 — 与 popup 的 `saveLanguageSettings` 触发时机一致
  - 每次只保存变化的字段 — `{ sourceLang: ... }` 或 `{ targetLang: ... }`
  - 不影响其他 settings 字段

- [x] `content/modules/sidebar.js` — 在 `swapBtn.onclick` handler 中，语言互换后调用 `saveLanguageSettings`（当前 line 132-142）：
  ```javascript
  // 改前（line 132-142）
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

  // 改后
  swapBtn.onclick = () => {
      const s = sourceLangSelect.value;
      const t = targetLangSelect.value;
      if (s !== 'auto') {
          sourceLangSelect.value = t;
          targetLangSelect.value = s;
          saveLanguageSettings({ sourceLang: t, targetLang: s });
          if (resultCard.classList.contains('active') && !resultContent.style.color) {
              input.value = resultContent.innerText;
          }
      }
  };
  ```

  行为说明：
  - `sourceLang: t, targetLang: s` — swap 后 source 变为原来的 target，target 变为原来的 source
  - 复用同一个 `saveLanguageSettings` helper — 不单写保存逻辑
  - `saveLanguageSettings` 返回 Promise 但此处不 `await` — swap 是同步 UI 操作，保存在后台完成即可

- [x] `content/modules/float-window.js` — 在语言初始化之后、`closeBtn.onclick` 之前（当前 line 83 和 line 85 之间），新增 `saveLanguageSettings` helper 和 `change` 监听器：
  ```javascript
  // 改前（line 83-85）
  }

  closeBtn.onclick = () => ST.toggleFloatWindow();

  // 改后
  }

  const saveLanguageSettings = async (partialSettings) => {
      const result = await chrome.storage.local.get('settings');
      const settings = result.settings || {};
      await chrome.storage.local.set({
          settings: { ...settings, ...partialSettings },
      });
  };

  targetLangSelect.addEventListener('change', () => {
      saveLanguageSettings({ targetLang: targetLangSelect.value });
  });

  closeBtn.onclick = () => ST.toggleFloatWindow();
  ```

  行为说明：
  - 与 sidebar 的 `saveLanguageSettings` 同名同结构 — 统一模式
  - float-window 只有 `targetLangSelect`（无 source 选择器）→ 只需一个 `change` 监听器
  - 不需要 swap 保存 — float-window 无 swap 按钮

**不要做的事**：
- 不要用 callback 版 `chrome.storage.local.get(key, callback)` — 用 Promise 版
- 不要把 `saveLanguageSettings` 挂到 `ST` 上 — 保持局部作用域
- 不要修改 popup.js 的 `saveLanguageSettings` — 它通过 `StorageManager.updateSettings` 保存，模式不同但功能正确
- 不要改 `content.js` — `chrome.storage.onChanged` 监听器已存在，会自动响应
- 不要改 sidebar 的翻译逻辑 — 只改语言保存
- 不要改 swap 在 `source === 'auto'` 时的行为 — 设计选择

### 必做

#### B. Options TTS 测试系统语音 Promise 化

056-B 修复了 popup/sidebar/float-window 的系统 TTS Promise 化但排除了 options.js。设置页 TTS 测试按钮在系统语音路径上同步返回，按钮立即恢复可点击。

- [x] `options/options.js` — 将 `playSystemTtsTest` 改为返回 Promise（当前 line 376-382）：
  ```javascript
  // 改前（line 376-382）
  function playSystemTtsTest(text, speed) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = speed;
      window.speechSynthesis.speak(utterance);
  }

  // 改后
  function playSystemTtsTest(text, speed) {
      return new Promise((resolve, reject) => {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'zh-CN';
          utterance.rate = speed;
          utterance.onend = () => resolve();
          utterance.onerror = (e) => reject(new Error(e.error || '播放失败'));
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
      });
  }
  ```

  行为说明：
  - 与 056-B 模式完全一致 — `onend` resolve、`onerror` reject
  - `speechSynthesis.cancel()` 在 `speak()` 之前 — 保持原有顺序
  - 不加超时 — 与 056-B 决策一致

- [x] `options/options.js` — 修改 `testTTS` 的系统 TTS 路径为 `await` + 更新状态文案（当前 line 342-347）：
  ```javascript
  // 改前（line 342-347）
  if (provider === 'system') {
      playSystemTtsTest(testText, speed);
      statusEl.textContent = '✓ 已开始播放';
      statusEl.classList.add('success');
      return;
  }

  // 改后
  if (provider === 'system') {
      statusEl.textContent = '播放中...';
      await playSystemTtsTest(testText, speed);
      statusEl.textContent = '✓ 播放完成';
      statusEl.classList.add('success');
      return;
  }
  ```

  行为说明：
  - `statusEl.textContent = '播放中...'` — 播放期间显示进度状态，按钮保持 disabled
  - `await playSystemTtsTest(...)` — 等待语音播放完成
  - `statusEl.textContent = '✓ 播放完成'` — 播放结束后更新为完成状态
  - 如果 `onerror` 触发 → reject → `catch` 块显示 `✗ 播放失败`
  - `finally` 在播放结束后才执行 → `btn.disabled = false` 时机正确

**不要做的事**：
- 不要加超时 — 与 056-B 保持一致
- 不要改 API TTS 路径 — `requestTtsTestAudio` + offscreen 播放流程正确
- 不要改 `testApiConnection` — 翻译 API 测试逻辑不受影响
- 不要改 `withTimeout` — 超时工具函数正确

## 不做的事

- **不做** popup.js 的 `saveLanguageSettings` 改动 — 通过 `StorageManager.updateSettings` 保存，模式不同但正确
- **不做** `content.js` 改动 — `chrome.storage.onChanged` 监听器已存在
- **不做** swap 在 `source === 'auto'` 时的行为改动 — 设计选择
- **不做** `speechSynthesis.onend` 超时兜底 — 与 056-B 一致
- **不做** API TTS 测试路径改动 — 已正确 await
- **不碰** popup.js、popup.html、options.html、options-ui-state.js、service-worker.js、message-router.js、tts.js、offscreen.js、storage.js、translator.js、manifest.json、content.js、selection.js、immersive.js、ad-blocker.js、floating-ball.js、utils.js、menus.js

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check content/modules/sidebar.js` 通过
- [x] `node --check content/modules/float-window.js` 通过
- [x] `node --check options/options.js` 通过
- [x] `git diff --check` 无输出
