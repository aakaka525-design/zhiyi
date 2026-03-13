---
status: done
priority: P1
created: 2026-03-13
---

# 020 — Sidebar/Float-window 翻译错误反馈 & Copy 竞态 & 死代码清理

- 来源讨论: [discussions/020-translate-error-swallowing.md](../discussions/020-translate-error-swallowing.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/020-translate-error-swallowing.md](../discussions/020-translate-error-swallowing.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/sidebar.js` | A: 翻译 else 块 + B: copy 竞态修复 |
| `content/modules/float-window.js` | A: 翻译 else 块 |
| `content/content.js` | C: 删除死 refreshSettings handler |
| `tests/translate-error-feedback.test.mjs` | A + B + C |

## 任务清单

### 必做

#### A. Sidebar / Float-window 翻译错误反馈

当 `response.text` 不存在时，显示 `response.error` 或兜底 `'未知错误'`，用 `var(--error)` 着色。与 bubble（`selection.js:158-172`）的错误处理模式保持一致。

**A1. Sidebar**

- [x] `content/modules/sidebar.js` — translateBtn.onclick 的 try 块内（当前 line 276-283），在 `if (response && response.text)` 的闭合 `}` 后加 else：
  ```javascript
  if (response && response.text) {
      resultCard.classList.add('active');
      resultContent.innerText = response.text;
      resultContent.style.color = '';
      resultLang.innerText = `翻译结果 (${targetLangSelect.value})`;
      // 刷新历史记录
      setTimeout(() => ST.refreshSidebarHistory(), 500);
  } else {
      resultCard.classList.add('active');
      resultContent.textContent = `翻译失败: ${response?.error || '未知错误'}`;
      resultContent.style.color = 'var(--error)';
  }
  ```

**A2. Float-window**

- [x] `content/modules/float-window.js` — translateBtn.onclick 的 try 块内（当前 line 173-177），在 `if (response && response.text)` 的闭合 `}` 后加 else：
  ```javascript
  if (response && response.text) {
      resultArea.classList.add('active');
      resultText.innerText = response.text;
      resultText.style.color = '';
  } else {
      resultArea.classList.add('active');
      resultText.textContent = `翻译失败: ${response?.error || '未知错误'}`;
      resultText.style.color = 'var(--error)';
  }
  ```

**不要做的事**：
- 不要改 `ST.sendMessage()` — 不改全局契约
- 不要改 `service-worker.js` 的 `.catch` — 错误包装逻辑没问题
- 不要改 `selection.js` — bubble 已正确处理
- 不要改 catch 块 — 那是处理 `chrome.runtime.lastError` 的，职责不同

### 必做

#### B. Sidebar 复制按钮 innerHTML 竞态修复

将 `originalIcon` 从 onclick 内部提升到绑定外层，只捕获一次。

- [x] `content/modules/sidebar.js` — copyBtn.onclick 绑定（当前 line 294-301），改为：
  ```javascript
  const originalIcon = copyBtn.innerHTML;
  copyBtn.onclick = () => {
      navigator.clipboard.writeText(resultContent.innerText);
      copyBtn.innerHTML = '<span style="font-size: 10px; color: var(--accent);">已复制</span>';
      setTimeout(() => {
          copyBtn.innerHTML = originalIcon;
      }, 1500);
  };
  ```

**不要做的事**：
- 不要改成 `style.color` 模式 — 本轮只做最小修复，不改交互模式

### 推荐

#### C. 删除 `content.js` 死 `refreshSettings` handler

全仓无调用方，设置同步完全依赖 `chrome.storage.onChanged`。

- [x] `content/content.js` — 删除 case 块（当前 line 113-118）：
  ```javascript
  case 'refreshSettings':
      // 当设置更新时刷新
      loadSettings().then(() => {
          console.log('[智译] 设置已刷新');
      });
      break;
  ```

## 不做的事

- **不做** `ST.sendMessage()` 自动检测 `response.error` 并 reject — 影响面太广
- **不做** service-worker 错误返回格式统一 — 架构任务
- **不做** float-window 加复制按钮 — product-surface 任务
- **不做** sidebar/float-window 翻译 handler 结构合并 — 架构任务
- **不碰** service-worker、manifest、popup、options、selection.js、immersive.js、floating-ball.js、ad-blocker.js

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check content/modules/sidebar.js` 通过
- [x] `node --check content/modules/float-window.js` 通过
- [x] `node --check content/content.js` 通过
- [x] `git diff --check` 无输出
