---
status: done
priority: P2
created: 2026-03-13
---

# 023 — Popup 收藏按钮返回值检查 + Toast 动画居中修复 + TTS GLM debug log 清理

- 来源讨论: [discussions/023-popup-favorite-toast-anim-tts-log.md](../discussions/023-popup-favorite-toast-anim-tts-log.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/023-popup-favorite-toast-anim-tts-log.md](../discussions/023-popup-favorite-toast-anim-tts-log.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `popup/popup.js` | A: 收藏返回值检查 + syncFavoriteState helper |
| `content/content.css` | B: toast 专用 keyframes |
| `background/modules/tts.js` | C: 删除 2 行 debug log |
| `tests/popup-favorite-toast-tts.test.mjs` | A + B + C |

## 任务清单

### 必做

#### A. Popup 收藏按钮返回值检查 + syncFavoriteState helper

两个子任务：收藏按钮检查返回值，补 syncFavoriteState helper 同步星标。

**A1. 收藏按钮检查 `addFavorite()` 返回值**

- [x] `popup/popup.js` — 收藏按钮 handler（当前 line 183-194），改为：
  ```javascript
  elements.btnFavorite.addEventListener('click', async () => {
      if (currentResult && elements.sourceText.value) {
          const result = await StorageManager.addFavorite({
              source: elements.sourceText.value,
              target: currentResult,
              sourceLang: elements.sourceLang.value,
              targetLang: elements.targetLang.value,
          });
          if (result) {
              showToast('已添加到收藏');
          } else {
              showToast('已在收藏中');
          }
          syncFavoriteState();
      }
  });
  ```

  具体改动点：
  - 用 `const result = await StorageManager.addFavorite(...)` 捕获返回值
  - `result` 为真 → "已添加到收藏"；`result` 为 `null` → "已在收藏中"
  - 删除 `elements.btnFavorite.querySelector('svg').style.fill = 'var(--warning)';` — 星标状态改由 `syncFavoriteState()` 统一管理
  - 末尾调用 `syncFavoriteState()` 确保星标与实际收藏状态一致

**A2. 补 `syncFavoriteState()` helper**

- [x] `popup/popup.js` — 在 `clearResult()` 函数之后（当前 line 358 附近），新增：
  ```javascript
  async function syncFavoriteState() {
      const text = elements.sourceText.value.trim();
      if (!text) {
          elements.btnFavorite.querySelector('svg').style.fill = 'none';
          return;
      }
      const isFav = await StorageManager.isFavorite(text);
      elements.btnFavorite.querySelector('svg').style.fill = isFav ? 'var(--warning)' : 'none';
  }
  ```

**A3. handleTranslate 成功后调用 syncFavoriteState**

- [x] `popup/popup.js` — `handleTranslate()` 的 try 块（当前 line 274-286），在 `await StorageManager.addHistory(...)` 之后加一行：
  ```javascript
  syncFavoriteState();
  ```

  改动后 try 块结构：
  ```javascript
  try {
      const result = await translator.translate(text, sourceLang, targetLang);
      currentResult = result.text;
      showResult(result.text);

      await StorageManager.addHistory({
          source: text,
          target: result.text,
          sourceLang,
          targetLang,
          provider: result.provider,
      });
      syncFavoriteState();
  } catch (error) {
      // ...
  }
  ```

**不要做的事**：
- 不要把 `showResult()` 改成 async — 它是纯同步 UI 渲染函数
- 不要改 `clearResult()` 中的星标重置逻辑 — 清空时星标确实应该重置为空心
- 不要改 `StorageManager.addFavorite()` 或 `StorageManager.isFavorite()` 的实现
- 不要改 options 页面的收藏逻辑

### 必做

#### B. Toast 专用 keyframes 修复居中动画冲突

保留 `left: 50%; transform: translateX(-50%)` 居中方式，给 `#st-toast` 用专属 keyframes。

**B1. content.css 新增 `@keyframes st-toast-fade-in`**

- [x] `content/content.css` — 在 `@keyframes st-fade-in` 闭合 `}` 之后（当前 line 85 附近），新增：
  ```css
  @keyframes st-toast-fade-in {
      from {
          opacity: 0;
          transform: translate(-50%, 8px);
      }

      to {
          opacity: 1;
          transform: translate(-50%, 0);
      }
  }
  ```

**B2. `#st-toast` animation 引用改为 `st-toast-fade-in`**

- [x] `content/content.css` — `#st-toast` 规则（当前 line 46），改为：
  ```css
  /* 改前 */
  animation: st-fade-in 0.3s ease;
  /* 改后 */
  animation: st-toast-fade-in 0.3s ease;
  ```

**不要做的事**：
- 不要改 `#st-toast` 的 `left: 50%; transform: translateX(-50%)` 居中方式
- 不要改成 `left: 0; right: 0; width: fit-content; margin: 0 auto;`
- 不要改 `@keyframes st-fade-in` — 其他元素还在使用
- 不要碰其他使用 `st-fade-in` 的元素（bubble、immersive、float-window、sidebar）

### 推荐

#### C. TTS GLM handler debug log 清理

- [x] `background/modules/tts.js` — 删除 line 53：
  ```javascript
  // 删除这一行
  console.log('[TTS] GLM 后台请求:', { voice, textLen: text.length });
  ```

- [x] `background/modules/tts.js` — 删除 line 82：
  ```javascript
  // 删除这一行
  console.log('[TTS] GLM 成功, 数据长度:', audioData.length);
  ```

  保留 `console.error`（line 71 和 line 85）不动。

**不要做的事**：
- 不要删除 `console.error` — 错误日志应该保留
- 不要改 OpenAI 或 Google handler 的日志
- 不要加新的日志替代删除的日志

## 不做的事

- **不做** popup toast 内联样式移入 CSS — popup 独立实现
- **不做** options toast 内联样式移入 CSS — options 独立实现
- **不做** `showResult()` async 化 — 保持同步渲染
- **不做** toast 居中方式改为 margin auto — 保留 translateX(-50%)
- **不做** 三套 showToast 统一 — 架构任务
- **不碰** service-worker（除 tts.js 两行 log）、manifest、sidebar、float-window、selection、floating-ball、immersive、content.js、options

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check popup/popup.js` 通过
- [x] `node --check background/modules/tts.js` 通过
- [x] `git diff --check` 无输出
