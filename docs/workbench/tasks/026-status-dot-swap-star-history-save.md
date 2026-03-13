---
status: done
priority: P2
created: 2026-03-13
---

# 026 — Popup 状态指示灯 + Swap 星标同步 + Sidebar/Float-window 历史保存

- 来源讨论: [discussions/026-status-dot-swap-star-history-save.md](../discussions/026-status-dot-swap-star-history-save.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/026-status-dot-swap-star-history-save.md](../discussions/026-status-dot-swap-star-history-save.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `popup/popup.js` | A: statusDot + updateServiceDisplay + B: swap handler |
| `background/modules/message-router.js` | C: 新增 addHistory action |
| `content/modules/sidebar.js` | C: 翻译成功后 await addHistory + refreshHistory |
| `content/modules/float-window.js` | C: 翻译成功后 addHistory |
| `tests/status-dot-swap-history.test.mjs` | A + B + C |

## 任务清单

### 推荐

#### A. Popup 状态指示灯激活

在 `elements` 中添加 `statusDot` 引用，`updateServiceDisplay()` 中根据 provider 和 API Key 配置状态切换 `.active` class。

**A1. `popup/popup.js` — elements 对象添加 statusDot**

- [x] 在 `elements` 对象中（当前 line 28 附近，`btnHistory` 之后），新增：
  ```javascript
  statusDot: document.querySelector('.status-dot'),
  ```

**A2. `popup/popup.js` — updateServiceDisplay 添加指示灯逻辑**

- [x] `updateServiceDisplay()`（当前 line 376-386），在 `elements.currentService.textContent = ...` 之后添加指示灯逻辑：
  ```javascript
  async function updateServiceDisplay() {
      const settings = await StorageManager.getSettings();
      const providerNames = {
          'google': 'Google 翻译',
          'openai': 'OpenAI GPT',
          'gemini': 'Google Gemini',
          'deepseek': 'DeepSeek',
          'offline': '离线翻译（仅英译中）',
      };
      elements.currentService.textContent = providerNames[settings.provider] || 'Google 翻译';

      // 状态指示灯：provider 可用时亮绿
      if (elements.statusDot) {
          const hasKey = settings.provider === 'google'
              || settings.provider === 'offline'
              || (settings.provider === 'openai' && settings.openaiApiKey)
              || (settings.provider === 'gemini' && settings.geminiApiKey)
              || (settings.provider === 'deepseek' && settings.deepseekApiKey);
          elements.statusDot.classList.toggle('active', !!hasKey);
      }
  }
  ```

**不要做的事**：
- 不要做 API 连通性探测（fetch 测试）— 只做静态 key 判断
- 不要改 `popup.css` 中 `.status-dot` 或 `.status-dot.active` 的样式
- 不要改 `popup.html` 的 DOM 结构

### 推荐

#### B. Swap 后收藏星标同步

swap handler 中 `sourceText` 变更后调用 `syncFavoriteState()`。

- [x] `popup/popup.js` — swap handler（当前 line 101-116），在 `updateCharCount()` 之后加一行：
  ```javascript
  // 改前
  if (currentResult) {
      elements.sourceText.value = currentResult;
      updateCharCount();
  }

  // 改后
  if (currentResult) {
      elements.sourceText.value = currentResult;
      updateCharCount();
      syncFavoriteState();
  }
  ```

**不要做的事**：
- 不要改 `syncFavoriteState()` 函数本身
- 不要改 `clearResult()` 中的星标重置逻辑
- 不要改 swap 的语言互换逻辑

### 必做

#### C. Sidebar/Float-window 翻译保存历史

新增 `addHistory` 消息动作，sidebar 和 float-window 翻译成功后显式保存历史。sidebar 用 `await` 保证写入完成后再刷新列表，替换原来的 500ms setTimeout。

**C1. `background/modules/message-router.js` — 新增 addHistory action**

- [x] 在 `case 'getHistory'` 之后（当前 line 29 附近），新增：
  ```javascript
  case 'addHistory':
      return storage.addHistory(request.item);
  ```

  改动后的相关部分：
  ```javascript
  case 'getHistory':
      return storage.getHistory();

  case 'addHistory':
      return storage.addHistory(request.item);

  case 'updateSettings':
      await translator.refreshSettings();
      return { success: true };
  ```

**C2. `content/modules/sidebar.js` — 翻译成功后 await addHistory 再刷新**

- [x] sidebar 翻译成功分支（当前 line 284-290），替换 `setTimeout` 为 `await addHistory` 后直接刷新：
  ```javascript
  // 改前
  if (response && response.text) {
      resultCard.classList.add('active');
      resultContent.innerText = response.text;
      resultContent.style.color = '';
      resultLang.innerText = `翻译结果 (${targetLangSelect.value})`;
      // 刷新历史记录
      setTimeout(() => ST.refreshSidebarHistory(), 500);
  }

  // 改后
  if (response && response.text) {
      resultCard.classList.add('active');
      resultContent.innerText = response.text;
      resultContent.style.color = '';
      resultLang.innerText = `翻译结果 (${targetLangSelect.value})`;
      // 保存历史并刷新列表
      await ST.sendMessage({
          action: 'addHistory',
          item: {
              source: text,
              target: response.text,
              sourceLang: sourceLangSelect.value,
              targetLang: targetLangSelect.value,
              provider: response.provider || '',
          }
      });
      ST.refreshSidebarHistory();
  }
  ```

  关键改动：
  - 删除 `setTimeout(() => ST.refreshSidebarHistory(), 500)` — 时序赌博
  - 新增 `await ST.sendMessage({ action: 'addHistory', ... })` — 等待写入完成
  - 写入完成后直接调用 `ST.refreshSidebarHistory()` — 因果保证

**C3. `content/modules/float-window.js` — 翻译成功后 addHistory**

- [x] float-window 翻译成功分支（当前 line 173-176），添加 addHistory 调用：
  ```javascript
  // 改前
  if (response && response.text) {
      resultArea.classList.add('active');
      resultText.innerText = response.text;
      resultText.style.color = '';
  }

  // 改后
  if (response && response.text) {
      resultArea.classList.add('active');
      resultText.innerText = response.text;
      resultText.style.color = '';
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
  }
  ```

  注意：float-window 没有历史列表 UI，不需要 await 也不需要刷新。`sourceLang: 'auto'` 与 popup 自动检测语义一致。fire-and-forget 即可。

**不要做的事**：
- 不要在 message-router 的 `translate` action 中自动保存历史 — 划词气泡也用 translate，会塞满历史
- 不要给 selection.js（划词气泡）添加 addHistory — 快速查看场景不保存
- 不要改 `StorageManager.addHistory()` 的实现
- 不要改 popup 的历史保存逻辑 — 它已经正确工作
- 不要改 `ST.refreshSidebarHistory()` 的实现

## 不做的事

- **不做** 划词气泡翻译保存历史 — 快速查看场景
- **不做** 沉浸式翻译保存历史 — 批量翻译条目过多
- **不做** status-dot 的连通性检测 — 只做静态 key 判断
- **不做** swap 在 source=auto 时的 toast 提示 — 设计选择
- **不碰** manifest、immersive、selection、floating-ball、ad-blocker、content.js、content.css、storage.js、options.js、options.html、popup.html、popup.css

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check popup/popup.js` 通过
- [x] `node --check background/modules/message-router.js` 通过
- [x] `git diff --check` 无输出
