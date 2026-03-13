---
status: done
priority: P1
created: 2026-03-13
---

# 018 — 沉浸式翻译颜色修复 & 杂项 UX 修复

- 来源讨论: [discussions/018-immersive-color-and-misc-ux.md](../discussions/018-immersive-color-and-misc-ux.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/018-immersive-color-and-misc-ux.md](../discussions/018-immersive-color-and-misc-ux.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/content.css` | A: token scope 扩展 + 颜色 token 化 |
| `content/modules/immersive.js` | A: inline 路径颜色修复 |
| `popup/popup.js` | B: showToast 去重 |
| `content/modules/floating-ball.js` | C: 删除 debug log |
| `content/modules/ad-blocker.js` | D: 插件元素守卫修复 |
| `tests/immersive-color-misc.test.mjs` | A + B + C + D |

## 任务清单

### 必做

#### A. 沉浸式翻译颜色 token 化

扩展 token scope，inline + block 两条路径统一使用 `var(--accent)`。背景色 `rgba(122, 154, 139, 0.08)` 本轮不动。

**A1. Token scope 补入**

- [x] `content/content.css` — 顶部 token scope 选择器（当前 line 6-13），在最后一项 `#st-toast` 之前补入：
  ```css
  /* 改前 */
  #st-floating-ball-container,
  #st-toast {
  /* 改后 */
  #st-floating-ball-container,
  .st-immersive-translation,
  .st-translation-separator,
  #st-toast {
  ```

**A2. Inline 路径颜色修复**

- [x] `content/modules/immersive.js` — separator 颜色（当前 line 171）：
  ```javascript
  // 改前
  separator.style.cssText = 'color: #8DA399; opacity: 0.6;';
  // 改后
  separator.style.cssText = 'color: var(--accent); opacity: 0.6;';
  ```
- [x] `content/modules/immersive.js` — transEl 颜色（当前 line 173）：
  ```javascript
  // 改前
  transEl.style.cssText = 'display: inline; font-style: normal; color: #8DA399; margin-left: 4px;';
  // 改后
  transEl.style.cssText = 'display: inline; font-style: normal; color: var(--accent); margin-left: 4px;';
  ```

**A3. Block 路径 CSS 颜色 token 化**

- [x] `content/content.css` — `.st-immersive-translation` 文字颜色（当前 line 184）：
  ```css
  /* 改前 */
  color: #7A9A8B;
  /* 改后 */
  color: var(--accent);
  ```
- [x] `content/content.css` — `.st-immersive-translation` 左边框（当前 line 187）：
  ```css
  /* 改前 */
  border-left: 3px solid #7A9A8B;
  /* 改后 */
  border-left: 3px solid var(--accent);
  ```

**不要做的事**：不要改 `background: rgba(122, 154, 139, 0.08)` — 本轮不动。

### 必做

#### B. Popup showToast 去重

创建前清理**所有**旧 toast，不是只删一个。

- [x] `popup/popup.js` — `showToast()` 函数（当前 line 479-480），在创建新 toast 前加入清理：
  ```javascript
  function showToast(message) {
      document.querySelectorAll('.toast').forEach(el => el.remove());
      const toast = document.createElement('div');
      // ... rest unchanged
  ```

### 必做

#### C. Floating-ball debug log 删除

三条全删，不保留任何一条。

- [x] `content/modules/floating-ball.js` — 删除 line 273：
  ```javascript
  console.log('[SmartTranslator] FloatingBall init called');
  ```
- [x] `content/modules/floating-ball.js` — 删除 line 275：
  ```javascript
  console.log('[SmartTranslator] Settings:', settings);
  ```
- [x] `content/modules/floating-ball.js` — 删除 line 282：
  ```javascript
  console.log('[SmartTranslator] Setting changed, showFloatingBall:', show);
  ```

### 推荐

#### D. Ad-blocker 插件元素守卫修复

复用已有的 `ST.isPluginElement()`，覆盖 `st-*` 和 `smart-translator-*` 两套前缀。

- [x] `content/modules/ad-blocker.js` — `removeAds()` 内的守卫（当前 line 176）：
  ```javascript
  // 改前
  if (el.closest('#st-')) return;
  // 改后
  if (ST.isPluginElement(el)) return;
  ```

**不要做的事**：不要用 `[id^="st-"]` — 它漏掉 `smart-translator-*` 前缀的元素。

## 不做的事

- **不做** immersive translation block/inline 路径合并 — 架构任务
- **不做** immersive 背景色 `rgba(122, 154, 139, 0.08)` token 化 — 不是本轮颜色断裂的主因
- **不做** floating-ball touch 事件支持 — 功能增强
- **不做** float-window 复制按钮 — product-surface 任务
- **不碰** service worker、manifest、options、translator.js、popup.html、sidebar.js、selection.js、float-window.js

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check content/modules/immersive.js` 通过
- [x] `node --check content/modules/floating-ball.js` 通过
- [x] `node --check content/modules/ad-blocker.js` 通过
- [x] `node --check popup/popup.js` 通过
- [x] `git diff --check` 无输出
