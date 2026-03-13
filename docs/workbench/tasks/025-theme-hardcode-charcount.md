---
status: done
priority: P3
created: 2026-03-13
---

# 025 — Theme.css 硬编码残留色值 + Popup charCount 颜色未重置

- 来源讨论: [discussions/025-theme-hardcode-charcount-search-reset.md](../discussions/025-theme-hardcode-charcount-search-reset.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/025-theme-hardcode-charcount-search-reset.md](../discussions/025-theme-hardcode-charcount-search-reset.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `options/theme.css` | A: 3 处硬编码色值 → `var(--accent-glow)` |
| `popup/popup.js` | B: `updateCharCount()` 补颜色逻辑 + `input` handler 去重 |
| `tests/theme-charcount.test.mjs` | A + B |

## 任务清单

### 推荐

#### A. Theme.css 硬编码色值替换

三处硬编码旧版色值替换为已定义的 `--accent-glow` 变量。

**A1. `.btn-primary:hover` box-shadow**

- [x] `options/theme.css` — line 144，改为：
  ```css
  /* 改前 */
  box-shadow: var(--shadow-md), 0 0 20px rgba(102, 126, 234, 0.4);
  /* 改后 */
  box-shadow: var(--shadow-md), 0 0 20px var(--accent-glow);
  ```

**A2. `.input:focus` box-shadow**

- [x] `options/theme.css` — line 193，改为：
  ```css
  /* 改前 */
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
  /* 改后 */
  box-shadow: 0 0 0 3px var(--accent-glow);
  ```

**A3. `.tag-accent` background**

- [x] `options/theme.css` — line 251，改为：
  ```css
  /* 改前 */
  background: rgba(0, 217, 255, 0.15);
  /* 改后 */
  background: var(--accent-glow);
  ```

**不要做的事**：
- 不要改 `--accent-glow` 变量的定义值（line 17 和 line 78）
- 不要改 `:root` 或 `body.dark-mode` 中的任何变量定义
- 不要改 `--primary`、`--primary-gradient-start`、`--primary-gradient-end` 等兼容性变量
- 不要重命名任何 CSS 类名
- 不要碰 `content/content.css`

### 推荐

#### B. Popup charCount 颜色逻辑收口

把字符计数颜色逻辑并入 `updateCharCount()` 函数，消除 `input` handler 中的重复逻辑。

**B1. 给 `updateCharCount()` 补颜色管理**

- [x] `popup/popup.js` — `updateCharCount()` 函数（当前 line 319-322），改为：
  ```javascript
  // 改前
  function updateCharCount() {
      const len = elements.sourceText.value.length;
      elements.charCount.textContent = `${len} / ${MAX_CHARS}`;
  }

  // 改后
  function updateCharCount() {
      const len = elements.sourceText.value.length;
      elements.charCount.textContent = `${len} / ${MAX_CHARS}`;
      elements.charCount.style.color = len > MAX_CHARS ? 'var(--error)' : 'var(--text-muted)';
  }
  ```

**B2. `input` handler 改为调用 `updateCharCount()`**

- [x] `popup/popup.js` — `input` 事件 handler（当前 line 97-106），改为：
  ```javascript
  // 改前
  // 输入框字符计数
  elements.sourceText.addEventListener('input', () => {
      const len = elements.sourceText.value.length;
      elements.charCount.textContent = `${len} / ${MAX_CHARS}`;
      if (len > MAX_CHARS) {
          elements.charCount.style.color = 'var(--error)';
      } else {
          elements.charCount.style.color = 'var(--text-muted)';
      }
  });

  // 改后
  // 输入框字符计数
  elements.sourceText.addEventListener('input', updateCharCount);
  ```

**不要做的事**：
- 不要改 `MAX_CHARS` 的值
- 不要改 `clearResult()` 中的星标重置逻辑
- 不要把 `updateCharCount()` 改成 async
- 不要改 `setLoading()` 或 `showResult()` 或 `showError()`
- 不要碰 options 页面的任何代码

## C 不在此 task 范围

025-C（历史搜索框切换不清空）已合并至 024-C（history 子视图状态统一管理），将在 024 的 task 中一并处理。

## 不做的事

- **不做** theme.css 变量重命名或结构调整 — 只替换硬编码色值
- **不做** charCount 的 CSS class 化 — 保持现有 inline style 模式
- **不做** 历史搜索框清空 — 合并至 024-C
- **不碰** service-worker、manifest、sidebar、float-window、selection、floating-ball、immersive、content.js、content.css、storage.js、options.js

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check popup/popup.js` 通过
- [x] `git diff --check` 无输出
- [x] `grep -n 'rgba(102, 126, 234' options/theme.css` 无输出（确认蓝色硬编码已清除）
- [x] `grep -n 'rgba(0, 217, 255' options/theme.css` 无输出（确认青色硬编码已清除）
