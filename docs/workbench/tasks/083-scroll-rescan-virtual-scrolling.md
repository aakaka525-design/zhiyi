---
status: done
priority: P2
created: 2026-03-15
---

# 083 — 虚拟滚动/动态加载页面：滚动重扫描补充翻译

- 来源讨论: [discussions/083-scroll-rescan-virtual-scrolling.md](../discussions/083-scroll-rescan-virtual-scrolling.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/083-scroll-rescan-virtual-scrolling.md](../discussions/083-scroll-rescan-virtual-scrolling.md)（完整讨论记录 + Codex 三个 blocker + Claude 收紧方案）

## 背景

MutationObserver 只监听 `childList: true`，对虚拟滚动节点复用（`textContent` 更新）和 CSS 可见性变化（`display: none` → `block`）不触发 mutation。079-A 的 Observer 分批修复了超时丢失，但不覆盖此类场景。

Codex 审阅接受方向，但要求三个 blocker 先收紧：
1. `rescanInFlight` 防并发守卫
2. stale translation 处理策略
3. 共享选择器常量，避免第三份过滤链漂移

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | A1：共享选择器常量 + 重构现有硬编码 |
| `content/modules/immersive.js` | A2：stale translation helper 函数 |
| `content/modules/immersive.js` | A3：scroll rescan + rescanInFlight |
| `content/modules/immersive.js` | A4：stopMutationObserver 清理 |
| `content/modules/immersive.js` | A5：初始扫描/Observer 存储源文本指纹 |
| `tests/083-scroll-rescan.test.mjs` | A6：回归测试 |

## 任务清单

### 必做

#### A1. 共享选择器常量 + 重构现有硬编码

- [x] 在 `IMMERSIVE_BATCH_SIZE` 定义附近（约 line 51），添加三个选择器常量：

  ```javascript
  const GENERIC_SELECTORS = 'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption';
  const DISCORD_GENERIC_SELECTORS = 'p, h1, h2, h3, h4, h5, h6, td, th, blockquote, figcaption, dt, dd, caption';
  const INITIAL_SCAN_EXTRA_SELECTORS = '.markdown-body p, .markdown-body li, .comment-body p, .js-comment-body p';
  ```

- [x] 重构初始扫描通用路径（约 line 121-129），将 `selectors` 数组替换为常量引用：

  ```javascript
  /* 改前 */
  const selectors = [
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'li', 'td', 'th', 'blockquote',
      'figcaption', 'dt', 'dd', 'caption',
      '.markdown-body p', '.markdown-body li',
      '.comment-body p', '.js-comment-body p'
  ].join(', ');

  /* 改后 */
  const selectors = GENERIC_SELECTORS + ', ' + INITIAL_SCAN_EXTRA_SELECTORS;
  ```

- [x] 重构 Observer 通用路径（约 line 341-347），将硬编码字符串替换为 `GENERIC_SELECTORS`：

  ```javascript
  /* 改前 */
  if (node.matches && node.matches('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption')) {
      newElements.push(node);
  }
  const paragraphs = node.querySelectorAll ?
      node.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption') : [];

  /* 改后 */
  if (node.matches && node.matches(GENERIC_SELECTORS)) {
      newElements.push(node);
  }
  const paragraphs = node.querySelectorAll ?
      node.querySelectorAll(GENERIC_SELECTORS) : [];
  ```

- [x] 重构 Observer Discord 路径（约 line 327），将 `discordGenericSelector` 局部变量替换为 `DISCORD_GENERIC_SELECTORS`：

  ```javascript
  /* 改前 */
  const discordGenericSelector = 'p, h1, h2, h3, h4, h5, h6, td, th, blockquote, figcaption, dt, dd, caption';
  if (node.matches && node.matches(discordGenericSelector)) {

  /* 改后 — 删除局部变量，直接用常量 */
  if (node.matches && node.matches(DISCORD_GENERIC_SELECTORS)) {
  ```

  行为说明：
  - 三个常量与当前硬编码字符串完全一致，语义零变化
  - `DISCORD_GENERIC_SELECTORS` 与 `GENERIC_SELECTORS` 的唯一区别是没有 `li`（081 修复）
  - 后续添加新标签只需改一处常量

#### A2. Stale translation helper 函数

- [x] 在 `filterContainedImmersiveElements` 之后（约 line 49），添加以下 helper：

  ```javascript
  const translatedSources = new WeakMap();

  function hashText(text) {
      let h = 5381;
      for (let i = 0; i < text.length; i++) {
          h = ((h << 5) + h + text.charCodeAt(i)) | 0;
      }
      return h;
  }

  // own-artifact 语义：只检查当前元素自己的注入产物（直接子元素 + 兄弟 wrapper）
  function hasOwnTranslationArtifacts(el) {
      const hasDirectChild = Array.from(el.children).some(child =>
          child.classList?.contains('st-immersive-translation') ||
          child.classList?.contains('st-translation-separator')
      );
      const hasWrapperSibling = el.nextElementSibling?.classList.contains('st-immersive-wrapper') || false;
      return hasDirectChild || hasWrapperSibling;
  }

  // own-artifact 语义：只剥离直接子元素中的译文，不动后代树
  function getOwnCleanSourceText(el) {
      const hasDirectTranslation = Array.from(el.children).some(child =>
          child.classList?.contains('st-immersive-translation') ||
          child.classList?.contains('st-translation-separator')
      );
      if (hasDirectTranslation) {
          const clone = el.cloneNode(true);
          Array.from(clone.children)
              .filter(child =>
                  child.classList?.contains('st-immersive-translation') ||
                  child.classList?.contains('st-translation-separator')
              )
              .forEach(child => child.remove());
          return clone.innerText.trim();
      }
      return el.innerText.trim();
  }

  // own-artifact 语义：只删当前元素自己的注入产物
  function removeOwnTranslationArtifacts(el) {
      Array.from(el.children)
          .filter(child =>
              child.classList?.contains('st-immersive-translation') ||
              child.classList?.contains('st-translation-separator')
          )
          .forEach(child => child.remove());
      const next = el.nextElementSibling;
      if (next && next.classList.contains('st-immersive-wrapper')) {
          next.remove();
      }
  }
  ```

  行为说明：
  - `translatedSources` — WeakMap，element → source text hash。元素被 GC 时自动清理
  - `hashText` — djb2 hash，快速非加密。用于源文本指纹
  - **三个 helper 统一使用 own-artifact 语义**：只面向当前元素自己的直接子元素 + 兄弟 wrapper，不用 `querySelector` / `querySelectorAll` 遍历后代树
  - 这样可以避免：未翻译父元素内部有已翻译子元素时，被误判为 stale
  - `hasOwnTranslationArtifacts` — 检测当前元素是否有自己的翻译产物
  - `getOwnCleanSourceText` — 获取当前元素的"干净"源文本（剥离自己的直接 translation/separator 子元素，保留嵌套子元素的翻译产物）
  - `removeOwnTranslationArtifacts` — 移除当前元素自己的翻译产物

#### A3. Scroll rescan + rescanInFlight

- [x] 在 `startMutationObserver` 函数中，`ST.observers.mutation.observe(...)` 调用之后（约 line 414），追加 scroll rescan：

  ```javascript
  // --- scroll rescan ---
  const RESCAN_INTERVAL = 3000;
  let lastRescanTime = 0;
  let rescanInFlight = false;

  const handleImmersiveScroll = () => {
      if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== observerRunId) {
          window.removeEventListener('scroll', handleImmersiveScroll);
          return;
      }
      if (rescanInFlight) return;

      const now = Date.now();
      if (now - lastRescanTime < RESCAN_INTERVAL) return;
      lastRescanTime = now;
      rescanInFlight = true;

      rescanUntranslatedElements(observerRunId, targetLang, isTwitter, isDiscord, isTelegram)
          .finally(() => { rescanInFlight = false; });
  };

  window.addEventListener('scroll', handleImmersiveScroll, { passive: true });
  ST.observers.scrollHandler = handleImmersiveScroll;
  ```

- [x] 在 `startMutationObserver` 之前（模块级），添加 `rescanUntranslatedElements` 函数：

  ```javascript
  async function rescanUntranslatedElements(observerRunId, targetLang, isTwitter, isDiscord, isTelegram) {
      if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== observerRunId) return;

      let selectors;
      if (isTwitter) {
          selectors = '[data-testid="tweetText"]';
      } else if (isDiscord) {
          selectors = '[id^="message-content-"], ' + DISCORD_GENERIC_SELECTORS;
      } else if (isTelegram) {
          selectors = '.translatable-message';
      } else {
          selectors = GENERIC_SELECTORS;
      }

      const candidates = Array.from(document.querySelectorAll(selectors))
          .filter(el => {
              // stale translation 检测（own-artifact 语义）
              if (hasOwnTranslationArtifacts(el)) {
                  const currentText = getOwnCleanSourceText(el);
                  const storedHash = translatedSources.get(el);
                  if (storedHash === hashText(currentText)) return false; // 仍然新鲜 → 跳过
                  removeOwnTranslationArtifacts(el);
                  // own artifacts 已移除，继续检查下方 descendant 保护
              }

              // 与 injectTranslation() 的 descendant 保护对齐：
              // 内部有已翻译子元素 → 跳过（避免白跑翻译）
              // 覆盖两种场景：
              //   1. 父元素无 own artifact，但子元素已翻译 → 不重复翻译父级
              //   2. own stale artifact 刚被移除，但子元素仍有翻译 → 子元素已覆盖
              if (el.querySelector('.st-immersive-translation')) {
                  return false;
              }

              if (ST.pendingTranslations.has(el)) return false;
              if (el.isContentEditable) return false;
              if (!isTwitter && !isTelegram) {
                  if (isExcludedByImmersiveContext(el)) return false;
                  if (ST.isPluginElement(el)) return false;
              }

              const text = el.innerText.trim();
              if (!text) return false;
              if (/^[\d\s.,!?@#$%^&*()\-+=]+$/.test(text)) return false;

              const minLen = (isTelegram && el.matches('.translatable-message')) ? 2 : getImmersiveMinLength(el, isTwitter);
              if (text.length < minLen) return false;
              if (ST.detectLanguage(text) === targetLang) return false;

              const style = window.getComputedStyle(el);
              if (style.display === 'none' || style.visibility === 'hidden') return false;

              return true;
          });

      const filtered = filterContainedImmersiveElements(candidates);
      if (filtered.length === 0) return;

      for (let i = 0; i < filtered.length; i += IMMERSIVE_BATCH_SIZE) {
          if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== observerRunId) break;

          const batch = filtered.slice(i, i + IMMERSIVE_BATCH_SIZE);
          batch.forEach(el => ST.pendingTranslations.add(el));
          const texts = batch.map(el => el.innerText.trim());

          try {
              const response = await ST.sendMessage({
                  action: 'translateBatch',
                  texts: texts,
                  to: targetLang
              }, 60000, '批量翻译超时');

              if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== observerRunId) break;

              if (response && response.results) {
                  batch.forEach((el, index) => {
                      const translation = response.results[index];
                      if (translation) {
                          const sourceText = el.innerText.trim();
                          ST.injectTranslation(el, translation);
                          translatedSources.set(el, hashText(sourceText));
                      }
                  });
              }
          } catch (err) {
              console.error('[智译] 滚动重扫描翻译失败:', err);
          } finally {
              batch.forEach(el => ST.pendingTranslations.delete(el));
          }

          if (i + IMMERSIVE_BATCH_SIZE < filtered.length) {
              await new Promise(resolve => setTimeout(resolve, 100));
          }
      }
  }
  ```

  行为说明：
  - `rescanInFlight` + `lastRescanTime` 双重守卫：频率节流 3s + 异步重入阻止
  - stale 检测在过滤链最前面：发现旧译文 hash 不匹配 → `removeTranslationArtifacts` → 元素进入翻译队列
  - 选择器使用 A1 的共享常量，不硬编码
  - 批量翻译逻辑与 Observer（079-A）一致：`IMMERSIVE_BATCH_SIZE` 分批 + per-batch `pendingTranslations` + runId 检查
  - `getComputedStyle` 在过滤链末尾（080 模式）
  - `{ passive: true }` — 不阻塞滚动

#### A4. stopMutationObserver 清理 scroll 监听

- [x] 在 `stopMutationObserver`（约 line 422-429）中追加 scroll handler 清理：

  ```javascript
  ST.stopMutationObserver = function () {
      if (ST.observers.mutation) {
          ST.observers.mutation.disconnect();
          ST.observers.mutation = null;
          ST.pendingTranslations.clear();
          console.log('[智译] DOM 观察器已停止');
      }
      /* 新增 */
      if (ST.observers.scrollHandler) {
          window.removeEventListener('scroll', ST.observers.scrollHandler);
          ST.observers.scrollHandler = null;
      }
  };
  ```

#### A5. 初始扫描/Observer 存储源文本指纹

- [x] 在初始扫描翻译成功后（约 line 186-189，`ST.injectTranslation(p, translation)` 调用处），添加指纹存储：

  ```javascript
  /* 改前 */
  if (translation) {
      ST.injectTranslation(p, translation);
  }

  /* 改后 */
  if (translation) {
      const sourceText = p.innerText.trim();
      ST.injectTranslation(p, translation);
      translatedSources.set(p, hashText(sourceText));
  }
  ```

- [x] 在 Observer 翻译成功后（约 line 392-395，`ST.injectTranslation(el, translation)` 调用处），添加相同的指纹存储：

  ```javascript
  /* 改前 */
  if (translation) {
      ST.injectTranslation(el, translation);
  }

  /* 改后 */
  if (translation) {
      const sourceText = el.innerText.trim();
      ST.injectTranslation(el, translation);
      translatedSources.set(el, hashText(sourceText));
  }
  ```

  行为说明：
  - 在 `injectTranslation` 之前取 `innerText`（注入后 inline/cell 路径的 innerText 会包含译文）
  - 三个翻译路径（初始扫描、Observer、rescan）都存储指纹 → rescan 能检测任何路径产生的 stale translation
  - 不修改 `injectTranslation` 函数本身

#### A6. 回归测试

- [x] 新建 `tests/083-scroll-rescan.test.mjs`，至少覆盖：

  **静态断言（结构验证）**：

  1. **A1 — 选择器常量**：静态断言 `immersive.js` 包含 `GENERIC_SELECTORS`、`DISCORD_GENERIC_SELECTORS`、`INITIAL_SCAN_EXTRA_SELECTORS` 常量定义
  2. **A3 — rescanInFlight 防重入**：静态断言 `immersive.js` 包含 `rescanInFlight` 守卫逻辑
  3. **A3 — rescan 使用共享常量**：静态断言 `rescanUntranslatedElements` 函数体中引用 `GENERIC_SELECTORS` 或 `DISCORD_GENERIC_SELECTORS`，不包含硬编码的完整选择器字符串
  4. **A4 — scroll handler 清理**：静态断言 `stopMutationObserver` 包含 `scrollHandler` 清理
  5. **A5 — 源文本指纹存储**：静态断言初始扫描和 Observer 翻译成功路径包含 `translatedSources.set`

  **动态 harness 测试（runtime 行为验证）**：

  6. **A2 — hashText 确定性**：验证相同文本产生相同 hash，不同文本产生不同 hash
  7. **A2 — getOwnCleanSourceText**：模拟包含 `.st-immersive-translation` 直接子元素的 DOM 节点，验证返回剥离自身译文后的文本
  8. **A2 — removeOwnTranslationArtifacts 只删直接子元素**：
     - 构造一个父元素 `<p>`，内部有 `.st-immersive-translation` 直接子元素 + 一个嵌套子元素 `<span>` 内部也有 `.st-immersive-translation`
     - 调用 `removeOwnTranslationArtifacts(p)` 后，验证 `<p>` 的直接 translation 子元素被移除，但嵌套 `<span>` 内的 translation 子元素保留
  9. **A2 — 未翻译父元素 + 已翻译子元素不误判 stale**：
     - 构造 `<blockquote>` 内包含 `<p>Original</p>` + `<p>` 的直接子元素 `<span class="st-immersive-translation">译文</span>`
     - `<blockquote>` 自身未翻译（`translatedSources` 无此 entry）
     - 验证 `hasOwnTranslationArtifacts(blockquote)` 返回 `false`（子元素的 translation 不算父元素自己的）
     - 验证 `<blockquote>` 不会被送进翻译队列作为 stale 处理
  10. **stale block wrapper 完整生命周期**：
     - 构造元素 `<p>Original text</p>` + 兄弟 `<div class="st-immersive-wrapper">` 模拟已翻译状态
     - 将 `translatedSources.set(p, hashText("Original text"))` 存储旧指纹
     - 修改 `<p>` 的 textContent 为 `"New text"` 模拟虚拟滚动复用
     - 验证 stale 检测：`hashText(getOwnCleanSourceText(p)) !== translatedSources.get(p)` → true
     - 调用 `removeOwnTranslationArtifacts(p)` → 验证旧 wrapper 被删除
     - 验证元素可以进入翻译队列（不被"已翻译"检查跳过）
  11. **父元素无 own artifact 但有 translated child → 不进翻译队列**：
      - 构造 `<blockquote>` 内含 `<p>text<span class="st-immersive-translation">译文</span></p>`
      - `<blockquote>` 自身无 own artifact（`.st-immersive-translation` 是 `<p>` 的直接子元素，不是 `<blockquote>` 的）
      - 但 `blockquote.querySelector('.st-immersive-translation')` 返回 true（descendant 语义）
      - 验证 rescan 过滤后 `<blockquote>` 不在待翻译列表中
      - 这与 `injectTranslation()` 的 `container.querySelector('.st-immersive-translation')` 保护对齐
  12. **rescanInFlight 防重入**：
      - 模拟 `rescanInFlight = true` 时的 scroll handler 行为
      - 构造 `handleImmersiveScroll` 等效逻辑：设 `rescanInFlight = true`，验证第二次调用直接 return 不触发 `rescanUntranslatedElements`
      - 验证 rescan 完成后（`.finally`）`rescanInFlight` 重置为 `false`

**不要做的事**：
- 不要修改 `injectTranslation` — 指纹存储在调用侧，不在 inject 内部
- 不要修改 `filterContainedImmersiveElements` — 080 已优化
- 不要修改 `getImmersiveMinLength` — Telegram/Discord/Twitter 各有专用门槛
- 不要修改 MutationObserver 配置 — 不添加 `attributes` 或 `characterData`
- 不要修改 Twitter/Discord/Telegram 的 Observer 收集逻辑 — 只重构选择器字符串为常量引用
- 不要抽取共享过滤函数 — 三个路径的过滤逻辑有意不同
- 不要抽取共享批量翻译函数 — 初始扫描有 progress tracking，形式不同
- 不要碰 popup.js、selection.js、sidebar.js、float-window.js、content.js、utils.js、tts.js、options.js、floating-ball.js、ad-blocker.js、storage.js、translator.js、message-router.js、service-worker.js、offscreen.js、manifest.json、menus.js、popup.css、content.css

## 不做的事

- **不做** IntersectionObserver — 071-B1 已被 Codex 拒绝
- **不做** MutationObserver attributeFilter — 071-B2 已被 Codex 拒绝
- **不做** 修改 Observer 的 childList 处理 — 079-A 已正确
- **不做** 视口范围限制（getBoundingClientRect 过滤）— 增加复杂度，3s 节流已够限制频率

## 验证要求

- [x] `node --test tests/083-scroll-rescan.test.mjs` 通过
- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check content/modules/immersive.js` 通过
- [x] `git diff --check` 无输出
