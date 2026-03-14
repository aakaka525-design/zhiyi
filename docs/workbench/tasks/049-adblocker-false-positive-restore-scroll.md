---
status: done
priority: P2
created: 2026-03-13
---

# 049 — 广告屏蔽弹窗检测误伤 & 观察器 restoreScroll 条件化

- 来源讨论: [discussions/049-adblocker-false-positive-restore-scroll.md](../discussions/049-adblocker-false-positive-restore-scroll.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/049-adblocker-false-positive-restore-scroll.md](../discussions/049-adblocker-false-positive-restore-scroll.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/ad-blocker.js` | A：token 级匹配替换子串匹配；B：closePopupAds 返回值 + 观察器条件化 restoreScroll |
| `tests/adblocker-false-positive-restore-scroll.test.mjs` | A + B |

## 任务清单

### 必做

#### A. closePopupAds 广告词判断改为 token 级匹配

`className.includes('ad')` 和 `id.includes('ad')` 是二字符子串匹配，大量常见英文词包含 "ad"（shadow, gradient, header, loading, upload, download, badge 等），导致合法弹窗被误判为广告并移除。

- [x] `content/modules/ad-blocker.js` — 在 `closePopupAds` 函数内部（当前 line 189），在 `POPUP_SELECTORS.forEach` 之前，新增 token 级匹配辅助函数：
  ```javascript
  // 改前（line 189-220）
  const closePopupAds = () => {
      POPUP_SELECTORS.forEach(selector => {
          try {
              document.querySelectorAll(selector).forEach(el => {
                  const text = el.innerText?.toLowerCase() || '';
                  const className = el.className?.toLowerCase() || '';
                  const id = el.id?.toLowerCase() || '';

                  const isAdPopup =
                      className.includes('ad') ||
                      id.includes('ad') ||
                      text.includes('广告') ||
                      text.includes('advertisement') ||
                      text.includes('sponsored') ||
                      text.includes('推广');

                  if (isAdPopup && !ST.isPluginElement(el)) {
                      el.remove();
                      document.querySelectorAll('[class*="backdrop"], [class*="mask"]').forEach(mask => {
                          if (mask.style.position === 'fixed' || mask.style.position === 'absolute') {
                              mask.remove();
                          }
                      });
                  }
              });
          } catch (e) {
          }
      });
  };

  // 改后
  const closePopupAds = () => {
      const hasAdToken = (str) => str.split(/[\s_-]+/).some(t => t === 'ad' || t === 'ads');
      let removed = false;
      POPUP_SELECTORS.forEach(selector => {
          try {
              document.querySelectorAll(selector).forEach(el => {
                  const text = el.innerText?.toLowerCase() || '';
                  const className = el.className?.toLowerCase() || '';
                  const id = el.id?.toLowerCase() || '';

                  const isAdPopup =
                      hasAdToken(className) ||
                      hasAdToken(id) ||
                      text.includes('广告') ||
                      text.includes('advertisement') ||
                      text.includes('sponsored') ||
                      text.includes('推广');

                  if (isAdPopup && !ST.isPluginElement(el)) {
                      el.remove();
                      removed = true;
                      document.querySelectorAll('[class*="backdrop"], [class*="mask"]').forEach(mask => {
                          if (mask.style.position === 'fixed' || mask.style.position === 'absolute') {
                              mask.remove();
                          }
                      });
                  }
              });
          } catch (e) {
          }
      });
      return removed;
  };
  ```

  行为说明：
  - `hasAdToken(str)` 按空格、`-`、`_` 分词，然后精确匹配 `ad` 或 `ads`
  - `"shadow-gradient"` → tokens `["shadow", "gradient"]` → 不匹配 → 不再误删
  - `"ad-container"` → tokens `["ad", "container"]` → 匹配 `ad` → 正确识别
  - `"popup_ad"` → tokens `["popup", "ad"]` → 匹配 `ad` → 正确识别（`\b` 会漏掉）
  - `"ads_popup"` → tokens `["ads", "popup"]` → 匹配 `ads` → 正确识别
  - 中文判断 `text.includes('广告')` / `text.includes('推广')` 不受影响
  - `closePopupAds()` 现在返回 `boolean`，表示是否实际移除了元素（B 要用）

**不要做的事**：
- 不要改 `POPUP_SELECTORS` 数组
- 不要改 `AD_SELECTORS` 列表
- 不要改 backdrop/mask 清理逻辑（`document.querySelectorAll('[class*="backdrop"]...')`）
- 不要改 `ST.isPluginElement(el)` 守卫
- 不要把 `hasAdToken` 提到模块级 — 它只在 `closePopupAds` 内使用

### 必做

#### B. 观察器仅在 closePopupAds 实际删除时调用 restoreScroll

观察器回调中 `restoreScroll()` 在每次检测到新广告元素时无条件执行，会破坏页面合法模态框的滚动锁定（`body { overflow: hidden }`）。

- [x] `content/modules/ad-blocker.js` — 在观察器回调的 `if (hasNewAds)` 块中（当前 line 377-381），将 `closePopupAds()` 的返回值用于条件化 `restoreScroll()` 调用：
  ```javascript
  // 改前（line 377-381）
          if (hasNewAds) {
              removeAds();
              closePopupAds();
              restoreScroll();
          }

  // 改后
          if (hasNewAds) {
              removeAds();
              if (closePopupAds()) {
                  restoreScroll();
              }
          }
  ```

  行为说明：
  - `closePopupAds()` 返回 `true` 表示本次确实删除了广告弹窗/遮罩 → 调用 `restoreScroll()` 恢复滚动
  - `closePopupAds()` 返回 `false` 表示没有删除任何弹窗（只是普通广告元素被注入，如 `ins.adsbygoogle`）→ 不触碰页面滚动状态
  - `enable()` 中的 `restoreScroll()` 保持无条件调用不变（line 403）— 初始化时无论是否删了弹窗，都应清除可能的广告滚动锁定
  - `removeAds()` 仍然无条件执行 — 它处理 `AD_SELECTORS` 匹配的普通广告元素，与滚动无关

**不要做的事**：
- 不要改 `enable()` 中的 `restoreScroll()` 调用 — 初始化时无条件调用是正确的
- 不要改 `restoreScroll()` 函数本身
- 不要改 `removeAds()` 函数
- 不要改观察器的结构（`MutationObserver` 构造、`observe` 调用、`hasNewAds` 检测）
- 不要改 `startObserver()` / `stopObserver()` 函数签名
- 不要给 `enable()` 中的 `closePopupAds()` 也加返回值判断 — 那里的 `restoreScroll()` 应保持无条件

## 不做的事

- **不做** `AD_SELECTORS` 列表变更 — 这些是精确 CSS 选择器，无子串问题
- **不做** `removeAds()` 改动 — 基于 `querySelectorAll`，无子串匹配
- **不做** `enableClickProtection()` 改动 — 点击劫持逻辑独立
- **不做** `injectStyles()` / `removeStyles()` 改动
- **不碰** popup.js、sidebar.js、float-window.js、selection.js、immersive.js、floating-ball.js、content.js、options.js、options.html、options.css、service-worker.js、message-router.js、tts.js、offscreen.js、storage.js、translator.js、manifest.json

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check content/modules/ad-blocker.js` 通过
- [x] `git diff --check` 无输出
