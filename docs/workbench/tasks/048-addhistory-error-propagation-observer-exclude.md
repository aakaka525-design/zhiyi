---
status: done
priority: P2
created: 2026-03-13
---

# 048 — addHistory 错误隔离 & 沉浸式观察器排除过滤

- 来源讨论: [discussions/048-addhistory-error-propagation-observer-exclude.md](../discussions/048-addhistory-error-propagation-observer-exclude.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/048-addhistory-error-propagation-observer-exclude.md](../discussions/048-addhistory-error-propagation-observer-exclude.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/sidebar.js` | A1：隔离 addHistory 的 await |
| `popup/popup.js` | A2：隔离 addHistory + syncFavoriteState |
| `content/modules/immersive.js` | B：观察器补 excludeSelectors + isPluginElement |
| `tests/addhistory-error-observer-exclude.test.mjs` | A + B |

## 任务清单

### 必做

#### A. addHistory 错误隔离 — 成功翻译不被覆盖

翻译成功后，`addHistory` / `syncFavoriteState` 在同一个 try-catch 内 await，如果这些辅助操作抛错，catch 块会用错误信息覆盖已显示的翻译结果。

**A1. Sidebar — 隔离 addHistory 的 await**

`ST.refreshSidebarHistory()` 已有内部 try-catch（line 356-412），不会传播错误。只有 `addHistory`（line 311-320）需要隔离。

- [x] `content/modules/sidebar.js` — 在 `translateBtn.onclick` 的成功路径中（当前 line 311-321），用独立 try-catch 包裹 `addHistory`：
  ```javascript
  // 改前（line 310-321）
              resultLang.innerText = `翻译结果 (${targetLangSelect.value})`;
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
              await ST.refreshSidebarHistory();

  // 改后
              resultLang.innerText = `翻译结果 (${targetLangSelect.value})`;
              try {
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
              } catch (historyErr) {
                  console.error('[智译] 保存历史失败:', historyErr);
              }
              await ST.refreshSidebarHistory();
  ```

  行为说明：
  - `addHistory` 抛错时仅 console.error，不传播到外层 catch
  - `refreshSidebarHistory()` 在 `addHistory` 之后继续执行（无论成功失败），它有自己的 try-catch
  - 外层 catch 只处理翻译请求本身的错误
  - 翻译结果已显示在 `resultContent` 中，不会被覆盖

**A2. Popup — 隔离 addHistory + syncFavoriteState**

`StorageManager.addHistory` 和 `syncFavoriteState` 都没有内部 try-catch，两个都需要隔离。

- [x] `popup/popup.js` — 在 `handleTranslate()` 的成功路径中（当前 line 280-290），用独立 try-catch 包裹 addHistory 和 syncFavoriteState：
  ```javascript
  // 改前（line 280-290）
        currentResult = result.text;
        showResult(result.text);

        // 保存到历史记录
        await StorageManager.addHistory({
            source: text,
            target: result.text,
            sourceLang,
            targetLang,
            provider: result.provider,
        });
        await syncFavoriteState();

  // 改后
        currentResult = result.text;
        showResult(result.text);

        try {
            await StorageManager.addHistory({
                source: text,
                target: result.text,
                sourceLang,
                targetLang,
                provider: result.provider,
            });
            await syncFavoriteState();
        } catch (auxErr) {
            console.error('[智译] 辅助操作失败:', auxErr);
        }
  ```

  行为说明：
  - `addHistory` 或 `syncFavoriteState` 抛错时仅 console.error
  - `showResult(result.text)` 已在独立 try-catch 之前执行，翻译结果不会被覆盖
  - 外层 catch 只处理 `translator.translate()` 本身的错误
  - `currentResult` 已赋值，朗读/复制功能不受影响

**不要做的事**：
- 不要把 `addHistory` 改为 fire-and-forget（去掉 await）— sidebar 需要先保存再刷新历史列表，popup 需要先保存再同步收藏状态
- 不要改翻译请求的 try-catch 结构
- 不要改 `setLoading()` / finally 块的时机 — 按钮延迟恢复是独立优化，不纳入本轮
- 不要改 float-window.js / selection.js — 已经是 fire-and-forget
- 不要改 `ST.refreshSidebarHistory` 函数本身
- 不要改 `syncFavoriteState` 函数本身
- 不要改 `StorageManager.addHistory` 函数本身

### 必做

#### B. 沉浸式观察器补齐排除过滤

初始扫描（`toggleImmersive` 通用分支）应用了 `excludeSelectors` 和 `ST.isPluginElement` 两层过滤，但 `startMutationObserver` 的回调都缺失。

**关键约束**：`excludeSelectors` 当前是 `toggleImmersive()` 内的局部变量（line 52-58），`startMutationObserver` 是独立函数（line 206），无法直接访问。需要把排除列表提取到模块级常量。

- [x] `content/modules/immersive.js` — 在文件顶部 `var ST = window.SmartTranslator;` 之后（line 6 之后），新增模块级常量：
  ```javascript
  // 改前（line 6 之后直接是 ST.toggleImmersive）

  // 改后（line 6 之后新增）
  const EXCLUDE_SELECTORS = [
      'nav', 'header', 'footer', 'aside',
      'button', 'a', 'input', 'select', 'label',
      '.Header', '.AppHeader', '.pagehead',
      '.btn', '.Button', '.Counter', '.Label',
      '.sidebar', '.menu', '.toolbar'
  ];
  ```

- [x] `content/modules/immersive.js` — 将 `toggleImmersive()` 内的局部 `excludeSelectors`（当前 line 52-58）替换为引用模块级常量：
  ```javascript
  // 改前（line 52-58）
        const excludeSelectors = [
            'nav', 'header', 'footer', 'aside',
            'button', 'a', 'input', 'select', 'label',
            '.Header', '.AppHeader', '.pagehead',
            '.btn', '.Button', '.Counter', '.Label',
            '.sidebar', '.menu', '.toolbar'
        ];

  // 改后（删除局部声明，改用模块级常量）
  ```
  同时将 line 65 的 `for (const selector of excludeSelectors)` 改为 `for (const selector of EXCLUDE_SELECTORS)`。

- [x] `content/modules/immersive.js` — 在观察器的 `newElements.filter` 回调中（当前 line 244-252），在 `if (text.length < minLength) return false;` 之后、`if (el.nextElementSibling...)` 之前，新增两层过滤：
  ```javascript
  // 改前（line 244-252）
        newElements = newElements.filter(el => {
            if (!el || !el.innerText) return false;
            const text = el.innerText.trim();
            const minLength = isTwitter ? 5 : 20;
            if (text.length < minLength) return false;
            if (el.nextElementSibling?.classList.contains('st-immersive-wrapper')) return false;
            if (ST.pendingTranslations.has(el)) return false;
            if (ST.detectLanguage(text) === targetLang) return false;
            return true;
        });

  // 改后
        newElements = newElements.filter(el => {
            if (!el || !el.innerText) return false;
            const text = el.innerText.trim();
            const minLength = isTwitter ? 5 : 20;
            if (text.length < minLength) return false;
            if (!isTwitter) {
                for (const selector of EXCLUDE_SELECTORS) {
                    if (el.closest(selector) || el.matches(selector)) return false;
                }
                if (ST.isPluginElement(el)) return false;
            }
            if (el.nextElementSibling?.classList.contains('st-immersive-wrapper')) return false;
            if (ST.pendingTranslations.has(el)) return false;
            if (ST.detectLanguage(text) === targetLang) return false;
            return true;
        });
  ```

  行为说明：
  - `EXCLUDE_SELECTORS` 提取到模块级，初始扫描和观察器共用同一份列表
  - 观察器的通用分支（`!isTwitter`）现在同时检查 `EXCLUDE_SELECTORS` 和 `ST.isPluginElement`，与初始扫描一致
  - Twitter 路径（`isTwitter`）不受影响 — Twitter 模式只收集 `[data-testid="tweetText"]`，不需要排除 nav/header
  - `!isTwitter` 守卫确保只有通用分支走排除逻辑，Twitter 分支跳过
  - 排除检查放在长度过滤之后（避免对短文本元素做不必要的 DOM 遍历）、重复/pending 检查之前

**不要做的事**：
- 不要改初始扫描的过滤逻辑（除了用 `EXCLUDE_SELECTORS` 替换局部变量）
- 不要改 Twitter 路径的选择器或过滤
- 不要改 `injectTranslation()` 函数
- 不要改 `startMutationObserver` 的 `observerRunId` 守卫
- 不要改 `pendingTranslations` 逻辑
- 不要改 `stopMutationObserver` 函数
- 不要给观察器加 visibility/display 检查（观察器处理的是新增节点，可能尚未渲染）

## 不做的事

- **不做** 按钮延迟恢复优化（sidebar/popup 的 finally 时机）— 独立问题，留后续轮次
- **不做** float-window / selection 的 addHistory 改动 — 已经是 fire-and-forget
- **不做** 观察器 throttle/debounce — 当前无性能问题
- **不碰** options.js、options.html、options.css、manifest.json、service-worker.js、message-router.js、tts.js、offscreen.js、storage.js、translator.js、ad-blocker.js、floating-ball.js、content.js、content.css、float-window.js、selection.js

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check content/modules/sidebar.js` 通过
- [x] `node --check popup/popup.js` 通过
- [x] `node --check content/modules/immersive.js` 通过
- [x] `git diff --check` 无输出
