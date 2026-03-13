---
status: done
priority: P1
created: 2026-03-13
---

# 022 — Observer pendingTranslations 泄漏修复 & Toast 样式入 CSS & Observer 阈值对齐

- 来源讨论: [discussions/022-observer-leak-and-toast.md](../discussions/022-observer-leak-and-toast.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/022-observer-leak-and-toast.md](../discussions/022-observer-leak-and-toast.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | A: finally 清理 + C: 阈值对齐 |
| `content/modules/utils.js` | B: 移除 style.cssText |
| `content/content.css` | B: 新增 #st-toast 实体样式规则 |
| `tests/observer-toast.test.mjs` | A + B + C |

## 任务清单

### 必做

#### A. Observer `pendingTranslations` finally 统一清理

将 `pendingTranslations.delete` 从 try 内和 catch 内移除，统一放到 `finally` 块。

- [x] `content/modules/immersive.js` — observer 的 translateBatch 处理（当前 line 249-268），改为：
  ```javascript
  try {
      const response = await ST.sendMessage({
          action: 'translateBatch',
          texts: texts,
          to: targetLang
      });

      if (response && response.results) {
          newElements.forEach((el, index) => {
              const translation = response.results[index];
              if (translation) {
                  ST.injectTranslation(el, translation);
              }
          });
      }
  } catch (err) {
      console.error('[智译] 动态内容翻译失败:', err);
  } finally {
      newElements.forEach(el => ST.pendingTranslations.delete(el));
  }
  ```

  具体改动点：
  - line 262：删除 `ST.pendingTranslations.delete(el);`（原在 success 分支内）
  - line 267：删除 `newElements.forEach(el => ST.pendingTranslations.delete(el));`（原在 catch 内）
  - line 268 后：新增 `finally { newElements.forEach(el => ST.pendingTranslations.delete(el)); }`

**不要做的事**：
- 不要改初始扫描的 translateBatch 处理（line 107-127）— 它不使用 pendingTranslations
- 不要加 debounce/throttle — 性能优化任务
- 不要改 observer 的 response.results 注入逻辑

### 必做

#### B. Toast 样式从 JS 内联移入 CSS

将 `ST.showToast()` 的 `style.cssText` 全部移入 `content.css`，JS 只保留 fade-out 最小内联覆盖。

**B1. content.css 新增 `#st-toast` 实体样式规则**

- [x] `content/content.css` — 在 token scope 闭合 `}` 之后（当前 line 29 附近），新增 `#st-toast` 样式：
  ```css
  #st-toast {
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 24px;
      background: var(--accent);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      z-index: 2147483647;
      animation: st-fade-in 0.3s ease;
  }
  ```

**B2. utils.js 移除 style.cssText**

- [x] `content/modules/utils.js` — `ST.showToast()` 函数（当前 line 32-63），移除整段 `style.cssText` 赋值，只保留 fade-out 的最小内联覆盖：
  ```javascript
  ST.showToast = function (message) {
      const oldToast = document.getElementById('st-toast');
      if (oldToast) oldToast.remove();

      const toast = document.createElement('div');
      toast.id = 'st-toast';
      toast.textContent = message;
      document.body.appendChild(toast);

      setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.transition = 'opacity 0.3s';
          setTimeout(() => toast.remove(), 300);
      }, 3000);
  };
  ```

**不要做的事**：
- 不要把 fade-out 扩成 CSS animation 体系 — 保留 opacity 内联覆盖即可
- 不要改 popup 或 options 的 showToast — 它们各有独立实现
- 不要在 CSS 中保留 `rgba(141, 163, 153, 0.95)` — 统一用 `var(--accent)`

### 推荐

#### C. Observer 最小文本长度阈值对齐

Observer 过滤使用与初始扫描一致的阈值。

- [x] `content/modules/immersive.js` — observer 过滤（当前 line 236），改为：
  ```javascript
  // 改前
  if (text.length < 5) return false;
  // 改后
  const minLength = isTwitter ? 5 : 20;
  if (text.length < minLength) return false;
  ```

**不要做的事**：
- 不要改初始扫描的阈值 — 它们是对的
- 不要改 Twitter 的 5 字符阈值 — Twitter 推文可以很短

## 不做的事

- **不做** observer debounce/throttle — 性能优化任务
- **不做** translateBatch fallback chain — 已知 backlog
- **不做** toast fade-out CSS animation 化 — 可选优化
- **不做** 初始扫描和 observer 选择器统一 — 架构任务
- **不碰** service-worker、manifest、popup、options、sidebar、float-window、selection、floating-ball

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check content/modules/immersive.js` 通过
- [x] `node --check content/modules/utils.js` 通过
- [x] `git diff --check` 无输出
