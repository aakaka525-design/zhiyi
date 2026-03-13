---
status: done
priority: P2
created: 2026-03-13
---

# 027 — Float-window Enter IME 保护 + Sidebar swap 文本互换 + Popup paste 清旧结果

- 来源讨论: [discussions/027-float-ime-sidebar-swap-paste-stale.md](../discussions/027-float-ime-sidebar-swap-paste-stale.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/027-float-ime-sidebar-swap-paste-stale.md](../discussions/027-float-ime-sidebar-swap-paste-stale.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/float-window.js` | A: Enter handler 加 `!e.isComposing` |
| `content/modules/sidebar.js` | B: swap handler 加文本互换逻辑 |
| `popup/popup.js` | C: paste handler 加 `clearResult()` |
| `tests/float-ime-swap-paste.test.mjs` | A + B + C |

## 任务清单

### 推荐

#### A. Float-window Enter handler IME 保护

给翻译小窗的 Enter 快捷键添加 `!e.isComposing` 守卫，防止 CJK 输入法组合态误触翻译。

- [x] `content/modules/float-window.js` — Enter handler（当前 line 152-157），加 `!e.isComposing`：
  ```javascript
  // 改前
  input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          translateBtn.click();
      }
  });

  // 改后
  input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          translateBtn.click();
      }
  });
  ```

**不要做的事**：
- 不要改 sidebar 的 Enter handler — 它已经在 024 中修复
- 不要用 `keyCode !== 229` 兼容守卫 — `isComposing` 在现代浏览器中已有足够支持
- 不要改翻译按钮的 onclick 逻辑

### 必做

#### B. Sidebar swap 文本互换

swap handler 在有成功结果显示时，把结果文本移入输入框，使反向翻译工作流与 popup 一致。

- [x] `content/modules/sidebar.js` — swap handler（当前 line 132-139），扩展为：
  ```javascript
  // 改前
  swapBtn.onclick = () => {
      const s = sourceLangSelect.value;
      const t = targetLangSelect.value;
      if (s !== 'auto') {
          sourceLangSelect.value = t;
          targetLangSelect.value = s;
      }
  };

  // 改后
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
  - `!resultContent.style.color` — 不是错误状态（错误时 color 被设为 `'var(--error)'`）

  这样通过 DOM 状态判断，天然覆盖所有 4 条结果路径：
  - 成功翻译：active + 无 color → 使用译文 ✓
  - 清空：非 active → 跳过 ✓
  - 错误/catch：active + color=error → 跳过 ✓
  - 历史回放：active + 无 color → 使用历史译文 ✓

**不要做的事**：
- 不要引入局部 `currentResult` 变量 — DOM 就是 sidebar 的单一真相源
- 不要改 swap 在 source=auto 时的行为 — 设计选择，静默跳过
- 不要改翻译逻辑、清空逻辑、历史回放逻辑
- 不要改 popup 的 swap handler — 它已经在 026 中修复

### 推荐

#### C. Popup paste 清空旧翻译结果

paste handler 在设置新输入值后调用 `clearResult()`，清除旧的翻译结果、`currentResult` 和星标状态。

- [x] `popup/popup.js` — paste handler（当前 line 132-140），在 `updateCharCount()` 之后加一行：
  ```javascript
  // 改前
  elements.btnPaste.addEventListener('click', async () => {
      try {
          const text = await navigator.clipboard.readText();
          elements.sourceText.value = text;
          updateCharCount();
      } catch (err) {
          console.error('粘贴失败:', err);
      }
  });

  // 改后
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

  `clearResult()` 已经负责：
  - 清 `currentResult = ''`
  - 隐藏结果区域 `resultSection.classList.remove('active', 'error-state')`
  - 清空结果内容 `resultContent.innerHTML = ''`
  - 重置星标 `btnFavorite svg fill = 'none'`

  不需要额外调用 `syncFavoriteState()`。

**不要做的事**：
- 不要改 `clearResult()` 函数本身
- 不要改 clear 按钮的 handler — 它已正确工作
- 不要在 paste 后自动触发翻译 — 用户可能想先检查粘贴内容
- 不要改 `syncFavoriteState()` 函数

## 不做的事

- **不做** sidebar swap 在 source=auto 时的 toast — 设计选择
- **不做** sidebar/float-window 错误态复制/朗读按钮禁用 — 需更大的 UI 状态重构
- **不做** popup 手动输入时清旧结果 — 渐进输入，清除太激进
- **不碰** manifest、immersive、selection、floating-ball、ad-blocker、content.css、popup.css、popup.html、options.js、options.html、storage.js、message-router.js、content.js

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check content/modules/float-window.js` 通过
- [x] `node --check content/modules/sidebar.js` 通过
- [x] `node --check popup/popup.js` 通过
- [x] `git diff --check` 无输出
