---
status: done
priority: P2
created: 2026-03-13
---

# 029 — Float-window 复制按钮 + 错误态隐藏操作按钮

- 来源讨论: [discussions/029-float-copy-toast-theme-error-actions.md](../discussions/029-float-copy-toast-theme-error-actions.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/029-float-copy-toast-theme-error-actions.md](../discussions/029-float-copy-toast-theme-error-actions.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/float-window.js` | A: 结果区重构 `.st-result-actions` + 复制按钮 |
| `content/modules/sidebar.js` | C: 翻译成功/失败/历史点击路径补 `error-state` class |
| `content/content.css` | C: 新增 `.error-state .st-result-actions { display: none }` |
| `tests/float-copy-error-state.test.mjs` | A + C |

## 任务清单

### 必做

#### A. Float-window 结果区重构 + 复制按钮

把 float-window 结果头部的按钮包进 `.st-result-actions` 容器（与 sidebar 结构对齐），并新增复制按钮。

**A1. `content/modules/float-window.js` — 结果区 HTML 重构**

- [x] 当前 line 49-57，结果区 HTML。把朗读按钮包进 `.st-result-actions` 容器，新增复制按钮：
  ```javascript
  // 改前
  <div class="st-float-result" id="st-float-result">
      <div class="st-result-header" style="margin-bottom: 8px;">
          <span>结果</span>
          <button class="st-control-btn" id="st-float-speak-result" title="朗读译文" style="padding: 2px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          </button>
      </div>
      <div class="st-float-result-text" id="st-float-result-text"></div>
  </div>

  // 改后
  <div class="st-float-result" id="st-float-result">
      <div class="st-result-header" style="margin-bottom: 8px;">
          <span>结果</span>
          <div class="st-result-actions">
              <button class="st-control-btn" id="st-float-speak-result" title="朗读译文" style="padding: 2px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
              </button>
              <button class="st-control-btn" id="st-float-copy-result" title="复制" style="padding: 2px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
          </div>
      </div>
      <div class="st-float-result-text" id="st-float-result-text"></div>
  </div>
  ```

**A2. `content/modules/float-window.js` — DOM 引用 + 复制 handler**

- [x] 当前 line 62-69 的 DOM 引用区域，新增复制按钮引用：
  ```javascript
  const copyResultBtn = ST.ui.floatWindow.querySelector('#st-float-copy-result');
  ```

- [x] 在 `speakResultBtn.onclick` 绑定之后（当前 line 149），新增复制 handler：
  ```javascript
  // 复制结果
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

**不要做的事**：
- 不要改朗读按钮的 SVG 尺寸或 padding — 保持现有 `width="12" height="12"` 和 `style="padding: 2px;"`
- 不要给复制按钮的 SVG 用和 sidebar 不同的图标 — 复用 sidebar 的 copy SVG，只是尺寸改为 12x12
- 不要加收藏、swap 等其他按钮 — float-window 保持轻量

### 必做

#### C. Sidebar / Float-window 错误态隐藏操作按钮

用 popup 同款的 `error-state` class + CSS 规则模式，在翻译失败时隐藏操作按钮。

**C1. `content/content.css` — 新增 error-state 规则**

- [x] 在 `.st-result-actions` 规则（当前 line 472-475）之后新增：
  ```css
  .st-sidebar-result-card.error-state .st-result-actions,
  .st-float-result.error-state .st-result-actions {
      display: none;
  }
  ```

**C2. `content/modules/sidebar.js` — 5 条路径补 error-state**

- [x] **翻译成功**（当前 line 288）— `resultCard.classList.add('active')` 之后加：
  ```javascript
  // 改前
  resultCard.classList.add('active');
  resultContent.innerText = response.text;
  resultContent.style.color = '';

  // 改后
  resultCard.classList.add('active');
  resultCard.classList.remove('error-state');
  resultContent.innerText = response.text;
  resultContent.style.color = '';
  ```

- [x] **翻译失败**（当前 line 304）— 改为同时加 `error-state`：
  ```javascript
  // 改前
  resultCard.classList.add('active');
  resultContent.textContent = `翻译失败: ${response?.error || '未知错误'}`;
  resultContent.style.color = 'var(--error)';

  // 改后
  resultCard.classList.add('active', 'error-state');
  resultContent.textContent = `翻译失败: ${response?.error || '未知错误'}`;
  resultContent.style.color = 'var(--error)';
  ```

- [x] **翻译 catch**（当前 line 309）— 同上加 `error-state`：
  ```javascript
  // 改前
  resultCard.classList.add('active');
  resultContent.textContent = `错误: ${err.message}`;
  resultContent.style.color = 'var(--error)';

  // 改后
  resultCard.classList.add('active', 'error-state');
  resultContent.textContent = `错误: ${err.message}`;
  resultContent.style.color = 'var(--error)';
  ```

- [x] **清空**（当前 line 127）— 不需要改。`remove('active')` 隐藏整个卡片，`error-state` 无影响。

- [x] **历史点击**（当前 line 359）— 加 `remove('error-state')`：
  ```javascript
  // 改前
  historyItem.onclick = () => {
      input.value = historyItem.dataset.source;
      resultContent.innerText = historyItem.dataset.target;
      resultContent.style.color = '';
      resultCard.classList.add('active');

  // 改后
  historyItem.onclick = () => {
      input.value = historyItem.dataset.source;
      resultContent.innerText = historyItem.dataset.target;
      resultContent.style.color = '';
      resultCard.classList.add('active');
      resultCard.classList.remove('error-state');
  ```

**C3. `content/modules/float-window.js` — 4 条路径补 error-state**

- [x] **翻译成功**（当前 line 174）：
  ```javascript
  // 改前
  resultArea.classList.add('active');
  resultText.innerText = response.text;
  resultText.style.color = '';

  // 改后
  resultArea.classList.add('active');
  resultArea.classList.remove('error-state');
  resultText.innerText = response.text;
  resultText.style.color = '';
  ```

- [x] **翻译失败**（当前 line 188）：
  ```javascript
  // 改前
  resultArea.classList.add('active');
  resultText.textContent = `翻译失败: ${response?.error || '未知错误'}`;
  resultText.style.color = 'var(--error)';

  // 改后
  resultArea.classList.add('active', 'error-state');
  resultText.textContent = `翻译失败: ${response?.error || '未知错误'}`;
  resultText.style.color = 'var(--error)';
  ```

- [x] **翻译 catch**（当前 line 193）：
  ```javascript
  // 改前
  resultArea.classList.add('active');
  resultText.innerText = '错误: ' + err.message;
  resultText.style.color = 'var(--error)';

  // 改后
  resultArea.classList.add('active', 'error-state');
  resultText.innerText = '错误: ' + err.message;
  resultText.style.color = 'var(--error)';
  ```

- [x] **清空**（当前 line 84）— 不需要改。`remove('active')` 隐藏整个结果区。

**不要做的事**：
- 不要在 JS 里写 `style.display = 'none'` — 用 CSS class 控制
- 不要改 popup 的 `showError()`/`showResult()` — 它已正确处理
- 不要改 clear handler — `remove('active')` 已经隐藏整个容器
- 不要在 `content.css` 里加 `.error-state` 对 `.st-result-text` 的颜色规则 — 保持 JS 的 `style.color` 控制，与现有行为一致
- 不要动 `.st-result-header` 的 flex 布局

## 不做的事

- **不做** popup toast 背景色变更 — 014 已确认固定深色背景是产品决策
- **不做** float-window 的 swap/收藏功能 — 保持轻量
- **不做** 错误态重试按钮 — UI 功能扩展
- **不做** sidebar 清空按钮补 `remove('error-state')` — 卡片隐藏后 class 无影响
- **不碰** manifest、immersive、selection、floating-ball、ad-blocker、content.js、options.js、options.html、popup.js、popup.html、popup.css、storage.js、translator.js、message-router.js

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check content/modules/float-window.js` 通过
- [x] `node --check content/modules/sidebar.js` 通过
- [x] `git diff --check` 无输出
