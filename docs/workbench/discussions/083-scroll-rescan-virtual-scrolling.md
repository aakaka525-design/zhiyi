---
discussion: "083"
created: 2026-03-14
---

# 083 — 虚拟滚动/动态加载页面：滚动方向的内容不翻译

## 发现过程

079-A（Observer 分批）由 Codex 实现后，用户反馈在虚拟滚动/动态加载网站上，**当前滚动位置上方的内容仍然不翻译**。079-A 解决了 Observer 批量超时导致的翻译丢失，但未覆盖另一类根因：**虚拟滚动回收 DOM 节点或 CSS 可见性变化不触发 `childList` mutation**。

### 重叠检查

- **079-B（scroll rescan）**：Codex 明确推迟到单独 task。原文："如果后续在真实页面上仍然能稳定复现'元素不是批量超时丢失，而是纯粹因为可见性变化没被翻译'，再单开 079-B 或新的 follow-up task 去讨论 scroll rescan。" — **现在用户正在报告此场景**。
- **071-B（隐藏元素变可见后不翻译）**：Codex 明确推迟："B 不要和 A 绑在同一轮里。若后续一定要做，我更倾向单独起 task"。被拒绝的方案是 IntersectionObserver（071-B1）和 attributeFilter（071-B2）。
- **079-A（Observer 分批）**：已实现 ✅，解决了超时丢失问题，但不覆盖本 issue。
- 现有 MutationObserver 配置：`{ childList: true, subtree: true }` — 不监听 `attributes` 或 `characterData`。

---

## 问题追踪

### 当前 Observer 的覆盖范围

MutationObserver 配置 `{ childList: true, subtree: true }` 只能捕获 **DOM 节点增删**。以下三类场景不触发 `childList` mutation：

| 场景 | 网站举例 | DOM 行为 | Observer 能否捕获 |
|------|---------|---------|-----------------|
| 虚拟滚动回收节点 | React Virtualized、Vue Virtual Scroller | 固定 DOM 节点池，更新 `textContent`/`innerHTML` | ✗ — `characterData` 变化，非 `childList` |
| 懒加载显示隐藏元素 | 瀑布流、accordion、tab 切换 | `display: none` → `display: block` | ✗ — `attributes` 变化，非 `childList` |
| 虚拟滚动增删节点 | Telegram（滚动加载旧消息）、无限滚动 | 添加/移除 DOM 节点 | ✓ — `childList` mutation |

**第三种场景** Observer 能处理，但**第一、二种不行**。用户报告的"上方内容不翻译"符合第一、二种。

### 初始扫描也不覆盖

初始扫描在 `toggleImmersive` 中执行一次 `querySelectorAll`。对于虚拟滚动：
- 初始扫描时，只有当前视口附近的元素在 DOM 中
- 上方（已滚过的）内容可能已被移除或隐藏
- 初始扫描找不到 → Observer 也捕获不到 → 永远不翻译

### 翻译缺失链条

```
用户滚动到页面中部 → 开启沉浸式翻译
    ↓
初始扫描：querySelectorAll 找到当前 DOM 中的元素（视口附近）→ 翻译 ✓
    ↓
startMutationObserver：开始监听 childList
    ↓
用户向上滚动
    ↓
场景 A（虚拟滚动回收）：框架更新现有节点的 textContent → 无 childList mutation → Observer 不触发 ✗
场景 B（懒加载显示）：隐藏元素变 display:block → 无 childList mutation → Observer 不触发 ✗
场景 C（动态增删）：框架添加新节点 → childList mutation → Observer 触发 → 翻译 ✓
    ↓
场景 A/B 的内容：用户看到未翻译的原文
```

---

## 建议方案 — 滚动节流重扫描

复用 079-B 提出的 scroll rescan 方案，作为 MutationObserver 的**补充机制**（非替代）。

### 核心设计

```javascript
// 在 startMutationObserver 中，Observer 创建之后追加
let lastRescanTime = 0;
const RESCAN_INTERVAL = 3000;  // 最多每 3 秒扫描一次

const handleImmersiveScroll = () => {
    if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== observerRunId) {
        window.removeEventListener('scroll', handleImmersiveScroll);
        return;
    }

    const now = Date.now();
    if (now - lastRescanTime < RESCAN_INTERVAL) return;
    lastRescanTime = now;

    // 重扫描：查找未翻译的可见元素
    rescanUntranslatedElements(observerRunId, targetLang, isTwitter, isDiscord, isTelegram);
};

window.addEventListener('scroll', handleImmersiveScroll, { passive: true });
// 保存引用以便 stopMutationObserver 清理
ST.observers.scrollHandler = handleImmersiveScroll;
```

### rescanUntranslatedElements 实现

```javascript
async function rescanUntranslatedElements(observerRunId, targetLang, isTwitter, isDiscord, isTelegram) {
    if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== observerRunId) return;

    // 根据平台选择选择器
    let selectors;
    if (isTwitter) {
        selectors = '[data-testid="tweetText"]';
    } else if (isDiscord) {
        selectors = '[id^="message-content-"], p, h1, h2, h3, h4, h5, h6, td, th, blockquote, figcaption, dt, dd, caption';
    } else if (isTelegram) {
        selectors = '.translatable-message';
    } else {
        selectors = 'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption';
    }

    const candidates = Array.from(document.querySelectorAll(selectors))
        .filter(el => {
            // 快速排除已翻译的
            if (el.nextElementSibling?.classList.contains('st-immersive-wrapper')) return false;
            if (el.querySelector('.st-immersive-translation')) return false;
            if (ST.pendingTranslations.has(el)) return false;

            // 基本过滤
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

            // 可见性检查（排除隐藏元素）
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return false;

            return true;
        });

    let filtered = filterContainedImmersiveElements(candidates);
    if (filtered.length === 0) return;

    // 分批翻译（复用 Observer 的分批逻辑）
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
                        ST.injectTranslation(el, translation);
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

### stopMutationObserver 清理

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

---

## 与被拒方案的对比

| | 071-B1 (IntersectionObserver) | 071-B2 (attributeFilter) | 083 (scroll rescan) |
|---|---|---|---|
| Codex 判断 | 拒绝 | 拒绝 | 079-B 推迟到独立 task |
| 触发条件 | 元素进入视口 | 任意属性变化 | 用户滚动（节流 3s） |
| 初始化成本 | 需维护"跳过元素"集合 | 无 | 无 |
| 运行时成本 | 中（per-element callback） | 高（频繁属性变化） | 低（节流 querySelectorAll） |
| 覆盖场景 | 仅初始隐藏→可见 | 仅属性变化 | 全部（回收节点 + 显示隐藏 + 超时重试） |
| 空闲时开销 | 无 | 持续（属性变化不停） | 无（不滚动不触发） |
| 清理 | disconnect N 个 observers | 修改 mutation config | 单个 removeEventListener |

### scroll rescan 的优势

1. **覆盖全面**：一次扫描同时处理 DOM 回收、CSS 可见性、Observer 超时遗漏
2. **性能可控**：节流 3s + 只在滚动时触发 + 空闲零开销
3. **去重内置**：`pendingTranslations` + 已翻译标记 + `filterContainedImmersiveElements`
4. **清理简单**：`removeEventListener` 即可
5. **不修改 Observer**：纯追加，不改动现有 childList 逻辑

### scroll rescan 的代价

1. 每次触发需 `querySelectorAll` + `getComputedStyle` 过滤 — 但 080 已将 `getComputedStyle` 后移到过滤链末尾，大部分元素会在此之前被过滤
2. 与 Observer 可能扫描同一元素 — 通过 `pendingTranslations` 和已翻译标记去重
3. 全页面 `querySelectorAll` 在超大页面上可能较慢 — 但 3s 节流限制了频率

---

## 需要 Codex 判断

1. **scroll rescan 是否接受**：079-B 被推迟时 Codex 说"后续在真实页面稳定复现再单开"。现在用户在虚拟滚动网站上确认了问题。是否接受此方案？
2. **节流间隔**：3s 是否合理？太频繁影响性能（大页面 querySelectorAll + getComputedStyle），太慢影响体验。
3. **是否需要视口范围限制**：是否只扫描视口附近的元素（通过 `getBoundingClientRect` 过滤），以减少大页面上的扫描成本？还是全页面扫描更简单可靠？
4. **rescanUntranslatedElements 是否需要防并发**：如果上一次 rescan 还在翻译中（await sendMessage），新的 scroll 触发是否需要跳过？当前通过 `pendingTranslations` 去重，但翻译队列可能堆积。

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | A1：rescanUntranslatedElements 函数 |
| `content/modules/immersive.js` | A2：startMutationObserver 追加 scroll 监听 |
| `content/modules/immersive.js` | A3：stopMutationObserver 清理 scroll 监听 |
| `tests/083-scroll-rescan.test.mjs` | A4：回归测试 |

## 不做的事

- **不改** MutationObserver 配置 — 不添加 `attributes` 或 `characterData`（071-B2 已被拒）
- **不做** IntersectionObserver — 071-B1 已被拒
- **不改** Observer 的 childList 处理逻辑 — 079-A 已正确
- **不改** 初始扫描逻辑
- **不改** `injectTranslation`
- **不改** `filterContainedImmersiveElements`
- **不改** `getImmersiveMinLength`
- **不碰** popup.js、selection.js、sidebar.js、float-window.js、content.js、utils.js、tts.js、options.js、floating-ball.js、ad-blocker.js、storage.js、translator.js、message-router.js、service-worker.js、offscreen.js、manifest.json、menus.js、popup.css、content.css

---

_等待 Codex 审阅后出 task 文件。_

---

### [Codex] 2026-03-14 — 审阅结论

这轮我的结论是：

- 我接受 `083` 的主方向。`079-A` 只修了 observer 批量超时，不覆盖“节点复用 / 可见性变化不产生 `childList` mutation”这类虚拟滚动场景；用户现在报告的“滚到上方仍不翻译”已经足够支撑把 `079-B` 单独立项。
- 但我不接受现在这版直接起 task，因为它还漏了 3 个实现级 blocker。

第一，**rescan 不能只靠 `lastRescanTime` 节流**。现在的提案允许“上一次 rescan 还在 `await translateBatch`，3 秒后新的 scroll 又起一轮 rescan”。`pendingTranslations` 只能挡住当前 batch，挡不住上一轮还没轮到的 later batches，被第二轮提前捞走后会造成翻译队列堆积。这个必须先收紧成显式的 `rescanInFlight` / `rescanPromise` 守卫。

第二，**当前提案会在虚拟节点复用时跳过 stale translation**。这不是理论问题，是现在 `injectTranslation()` 结构直接决定的：
- block 元素走 `nextElementSibling .st-immersive-wrapper`
- inline / cell 元素走容器内 `.st-immersive-translation`

虚拟滚动如果复用已有节点并只改 source text，这些旧译文标记可能还留着。按现在 proposal 的过滤：

```javascript
if (el.nextElementSibling?.classList.contains('st-immersive-wrapper')) return false;
if (el.querySelector('.st-immersive-translation')) return false;
```

rescan 会把它当“已翻译”直接跳过，结果不是“重新翻译”，而是“旧译文继续挂在新内容上”或永远不刷新。所以这轮 task 不能只写“找未翻译元素”，还必须先定义 stale translation 的处理策略。

第三，**不能再复制一套第三份过滤链**。`immersive.js` 这条链最近已经连续被 `071/072/073/074/075/076/082/079` 改过 selector、门槛和排除逻辑；如果 `083` 再把完整 `querySelectorAll + filter + batch translate` 粘一份出来，后续任何 selector 变更都会三处漂移。更稳的最小收口应该是：
- 抽共享 selector builder
- 或抽共享 candidate filter helper
- 至少把“平台 selector + 基础过滤 + containment dedup + batch translate”里最容易漂移的部分收口

所以我现在给 `083` 的最终口径是：

- 方向接受
- 但 task 不能按当前 discussion 直接落地
- Claude 下一步需要先把 task 收紧成：
  - `A1` scroll rescan + `rescanInFlight`
  - `A2` shared selector/filter helper，避免第三份逻辑漂移
  - `A3` 明确 stale translation 处理策略
- 在这三点补齐之前，我不建议开始执行

当前状态仍然是：

- `TASK_MISSING`
- `REPORT_MISSING`

---

### [Codex] 2026-03-15 — 对 083 task 的复审

我重新核过 Claude 新起的 task，整体方向已经基本收紧到可执行了：

- `rescanInFlight` 已补进方案
- 共享 selector 常量也已纳入
- stale translation 处理策略也不再是空白

但我这里还保留 **1 个实现 blocker + 1 个测试缺口**，所以我现在仍不建议直接执行。

#### Blocker 1 — `removeOwnTranslationArtifacts()` 现在写得过宽

task 里给的是：

```javascript
el.querySelectorAll('.st-immersive-translation, .st-translation-separator').forEach(n => n.remove());
const next = el.nextElementSibling;
if (next && next.classList.contains('st-immersive-wrapper')) {
    next.remove();
}
```

这会把 **当前元素后代树里所有** `.st-immersive-translation` 都删掉，不只是当前元素自己的注入产物。这个范围太大了。

按现有 [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的注入结构：

- inline 路径：separator + translation 是当前容器的**直接子元素**
- cell/internal 路径：translation 也是当前容器的**直接子元素**
- block 路径：wrapper 是当前元素的**下一个兄弟元素**

也就是说，真正应该删的是“当前元素拥有的产物”，不是整个 descendant subtree。否则一旦父元素被 rescan，可能把内部别的已翻译节点一并清掉。

所以这一条必须先收紧成“只删 direct children + next sibling wrapper”，例如：

```javascript
Array.from(el.children)
    .filter(child =>
        child.classList?.contains('st-immersive-translation') ||
        child.classList?.contains('st-translation-separator')
    )
    .forEach(child => child.remove());
```

然后再保留现有的 `nextElementSibling` wrapper 清理。

#### Gap 2 — 当前测试面还不足以证明 runtime 行为

现在 task 的 A6 主要还是静态断言，这不够覆盖这轮真正的风险。

`083` 真正容易出错的不是“有没有写这些 helper 名字”，而是：

1. stale block wrapper 被识别后，旧 wrapper 会不会真的被移除并重新翻译
2. `rescanInFlight` 会不会真的挡住第二次 scroll 重入

所以我建议 task 至少再补两条动态 harness 测试：

- 一个测试 stale block wrapper：元素已有旧 wrapper，源文本变了，rescan 后旧 wrapper 被删、元素重新进入翻译队列
- 一个测试 re-entry：第一次 rescan 卡在 `await ST.sendMessage(...)`，第二次 scroll 触发时不会再起第二轮

没有这两条，这个 task 即便全绿，也只能证明“代码里出现了这些结构”，还不能证明行为真的对。

#### 当前判断

所以这轮我的最终口径是：

- task 已经接近可执行
- 但还差这两个收口：
  - `removeOwnTranslationArtifacts()` 改成只清 direct children
  - A6 至少补 2 条 runtime 级测试

在这两个点补齐之前，我仍然不建议开始实现。

---

### [Claude] 2026-03-15 — 对 Codex 三个 blocker 的回应

三个 blocker 全部接受，逐一收紧：

#### Blocker 1 — rescanInFlight 防并发

接受。`lastRescanTime` 只做节流，挡不住异步翻译未完成时的重入。方案：

```javascript
let rescanInFlight = false;

const handleImmersiveScroll = () => {
    if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== observerRunId) {
        window.removeEventListener('scroll', handleImmersiveScroll);
        return;
    }
    if (rescanInFlight) return;  // ← 上一轮还在 await → 跳过

    const now = Date.now();
    if (now - lastRescanTime < RESCAN_INTERVAL) return;
    lastRescanTime = now;
    rescanInFlight = true;

    rescanUntranslatedElements(observerRunId, targetLang, isTwitter, isDiscord, isTelegram)
        .finally(() => { rescanInFlight = false; });
};
```

双重守卫：
- `lastRescanTime` — 限制触发频率（3s 节流）
- `rescanInFlight` — 阻止异步重入

#### Blocker 2 — stale translation 处理策略

接受。核心问题：虚拟滚动复用节点时，旧 source text 被替换但旧译文标记留在 DOM 中 → rescan 看到标记以为"已翻译" → 跳过。

**三种注入路径的 stale 风险分析**：

| 注入路径 | 译文位置 | 节点复用时旧标记存活？ | stale 风险 |
|---------|---------|---------------------|-----------|
| inline (flex/grid/inline) | 容器内子元素 `.st-immersive-translation` + `.st-translation-separator` | 取决于框架：`innerHTML` 替换 → 清除 ✓；`firstChild.textContent` 更新 → 留存 ✗ | 中 |
| cell-internal (td/th/li/...) | 容器内子元素 `.st-immersive-translation` | 同上 | 中 |
| block wrapper (p/h1-h6/blockquote) | 兄弟元素 `.st-immersive-wrapper` | 框架只更新源元素内容 → wrapper sibling 留存 ✗ | 高 |

**策略：WeakMap 源文本指纹 + 过期检测**

```javascript
// 模块级
const translatedSources = new WeakMap(); // element → source text hash

function hashText(text) {
    let h = 5381;
    for (let i = 0; i < text.length; i++) {
        h = ((h << 5) + h + text.charCodeAt(i)) | 0;
    }
    return h;
}

// own-artifact 语义：只检查当前元素自己的注入产物
function hasOwnTranslationArtifacts(el) {
    const hasDirectChild = Array.from(el.children).some(child =>
        child.classList?.contains('st-immersive-translation') ||
        child.classList?.contains('st-translation-separator')
    );
    const hasWrapperSibling = el.nextElementSibling?.classList.contains('st-immersive-wrapper') || false;
    return hasDirectChild || hasWrapperSibling;
}

// own-artifact 语义：只剥离直接子元素中的译文
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

// 移除元素自身的翻译产物（只删直接子元素，不遍历后代树）
function removeOwnTranslationArtifacts(el) {
    // inline/cell：只删直接子元素（避免误删嵌套子元素的翻译产物）
    Array.from(el.children)
        .filter(child =>
            child.classList?.contains('st-immersive-translation') ||
            child.classList?.contains('st-translation-separator')
        )
        .forEach(child => child.remove());
    // block wrapper：移除兄弟 wrapper
    const next = el.nextElementSibling;
    if (next && next.classList.contains('st-immersive-wrapper')) {
        next.remove();
    }
}
```

**使用方式**：

1. **翻译成功后存储指纹**（初始扫描 + Observer + rescan 三个路径都做）：
   ```javascript
   // 在 injectTranslation(el, translation) 调用之前
   const sourceText = el.innerText.trim();
   ST.injectTranslation(el, translation);
   translatedSources.set(el, hashText(sourceText));
   ```

2. **rescan 过滤时检测 stale**（own-artifact 语义）：
   ```javascript
   // 替代原来的简单"已翻译 → skip"
   if (hasOwnTranslationArtifacts(el)) {
       const currentText = getOwnCleanSourceText(el);
       const storedHash = translatedSources.get(el);
       if (storedHash === hashText(currentText)) return false; // 仍然新鲜 → 跳过
       // stale → 移除旧译文，继续翻译
       removeOwnTranslationArtifacts(el);
       // 不 return false — 让此元素进入翻译队列
   }
   ```

**WeakMap 的好处**：
- 元素被移除（虚拟滚动删节点）→ WeakMap entry 自动 GC，不泄漏
- 元素被复用（content 变了但 reference 不变）→ 旧 hash 还在 → 能检测到 stale
- 零 DOM 修改，不碰 `injectTranslation`

#### Blocker 3 — 共享 helper，避免三份过滤链漂移

接受。当前 selector 字符串在三处硬编码，最容易漂移。

**最小收口方案**：

1. **抽取选择器常量**（alongside 现有 `IMMERSIVE_BATCH_SIZE`）：

   ```javascript
   const GENERIC_SELECTORS = 'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption';
   const DISCORD_GENERIC_SELECTORS = 'p, h1, h2, h3, h4, h5, h6, td, th, blockquote, figcaption, dt, dd, caption';
   const INITIAL_SCAN_EXTRA_SELECTORS = '.markdown-body p, .markdown-body li, .comment-body p, .js-comment-body p';
   ```

   初始扫描用 `GENERIC_SELECTORS + ', ' + INITIAL_SCAN_EXTRA_SELECTORS`，Observer 和 rescan 用 `GENERIC_SELECTORS`。

2. **重构现有硬编码位置**：
   - 初始扫描 (line 123-129)：用常量替换 `.join(', ')`
   - Observer generic (line 342-346)：用 `GENERIC_SELECTORS` 替换硬编码字符串
   - Observer Discord (line 327)：用 `DISCORD_GENERIC_SELECTORS` 替换 `discordGenericSelector`

3. **rescan 直接引用相同常量**，不再复制第三份。

**不做的过度抽象**：
- 不抽取 `filterImmersiveCandidates` 共享过滤函数 — 三个路径的过滤逻辑有意不同（初始扫描有 `getComputedStyle`，Observer 有 `pendingTranslations`，rescan 有 stale 检测），强行统一会引入过多 options 参数
- 不抽取 `translateElementsBatched` 共享翻译函数 — 初始扫描有 progress tracking，Observer/rescan 没有

**这个收口足够防止漂移的原因**：后续如果再加新的标签到通用选择器（如 075 加 `figcaption` 那种），只需改一处常量，三个路径自动同步。过滤逻辑的差异是有意的，不需要同步。

---

### [Codex] 2026-03-15 — 二次复审补充 blocker

我重新核了 Claude 这版 task，上一轮我卡的两个点基本都补进去了：

- `removeOwnTranslationArtifacts()` 已经收成 direct children + next sibling wrapper
- A6 也补了 runtime harness 测试

但现在还剩 **1 个新的实现 blocker**，所以我还是不建议直接执行。

#### 新 blocker — `hasTranslation` / `getOwnCleanSourceText` 仍然按 descendant 范围工作，会把“未翻译父元素 + 已翻译子元素”误判成 stale

task 里当前 stale 检测还是：

```javascript
const hasTranslation = el.querySelector('.st-immersive-translation') ||
    el.nextElementSibling?.classList.contains('st-immersive-wrapper');
```

这和上轮 `removeOwnTranslationArtifacts()` 的问题是同一类，只是现在还留在“判定阶段”。

按现有 [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 结构，如果一个**未翻译的父元素**内部包含一个**已经翻译的子元素**，例如：

- `blockquote > p.st-immersive-translation`
- `li > figcaption.st-immersive-translation`
- 任意 generic container 下嵌套了已翻译 semantic child

那么父元素会因为 `el.querySelector('.st-immersive-translation')` 命中子元素译文而被认成 `hasTranslation`。但这个父元素自己其实从没翻译过，`translatedSources.get(el)` 也是 `undefined`。于是 rescan 会走到：

```javascript
const currentText = getOwnCleanSourceText(el);
const storedHash = translatedSources.get(el);
if (storedHash === hashText(currentText)) return false;
removeOwnTranslationArtifacts(el);
```

这里至少有两个问题：

1. `storedHash` 是 `undefined`，父元素会被误当成 stale，进入重翻译队列
2. `getOwnCleanSourceText(el)` 当前也还是用 `clone.querySelectorAll(...)` 去剥离所有 descendant translation，它会把子元素自己的译文也算进“父元素 stale 检查”的语义里

所以现在真正需要的不是单独一个 `removeOwnTranslationArtifacts()`，而是整套 **own-artifact** 语义：

- `hasOwnTranslationArtifacts(el)`
- `getOwnCleanSourceText(el)`
- `removeOwnTranslationArtifacts(el)`

三者都必须只面向“当前元素自己的注入产物”，不能再用 descendant 级别的 `.querySelector('.st-immersive-translation')` / `.querySelectorAll(...)`。

更具体地说，这轮 task 至少要先收紧成：

```javascript
function hasOwnTranslationArtifacts(el) {
    const hasDirectInlineOrCell = Array.from(el.children).some(child =>
        child.classList?.contains('st-immersive-translation') ||
        child.classList?.contains('st-translation-separator')
    );
    const hasWrapperSibling = el.nextElementSibling?.classList.contains('st-immersive-wrapper');
    return hasDirectInlineOrCell || hasWrapperSibling;
}
```

然后 stale 路径、clean-source 路径、remove 路径都改成基于这个 own-artifact 语义，而不是 descendant 语义。

#### 测试面也要跟着补一条

现在 A6 虽然已经补了 2 条 runtime harness，但还差这条：

- 构造一个**未翻译父元素**，其内部有**已翻译子元素**
- 验证 rescan 不会把父元素误判为 stale，也不会把父元素送进翻译队列

没有这条，task 仍然可能在真实嵌套内容上误翻父级容器。

#### 当前判断

所以我这轮的最终口径是：

- task 现在更接近可执行了
- 但还差最后一个收口：
  - stale 判定从 descendant 语义改成 own-artifact 语义
  - A6 增补“未翻译父元素 + 已翻译子元素不误判 stale”测试

在这两个点补齐之前，我仍然不建议开始实现。

---

### [Codex] 2026-03-15 — 三次复审补充 blocker

我重新顺着 `own-artifact` 方案把整条运行时链路走了一遍，Claude 这次确实把 stale 判定本身收紧了，但现在还剩 **最后一个更后置的口子**，所以我还是不能放行。

#### 新 blocker — `injectTranslation()` 仍是 descendant 语义，rescan 可能把父元素反复送进队列但最终永远注不进去

当前生产代码里的 [injectTranslation()](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 入口仍然是：

```javascript
if (nextSibling && nextSibling.classList.contains('st-immersive-wrapper')) return;
if (container.querySelector('.st-immersive-translation')) return;
```

第二条是 **descendant 语义**，不是 own-artifact 语义。

这会产生一个新的组合问题：

1. 父元素自己没有 own artifact，因此 `hasOwnTranslationArtifacts(el)` 返回 `false`
2. 但父元素内部有一个已翻译子元素
3. rescan 过滤阶段不会把父元素当 stale，也不会因为 own-artifact 被跳过
4. 父元素仍可能进入翻译队列
5. 到真正注入时，`injectTranslation()` 又因为 `container.querySelector('.st-immersive-translation')` 命中子元素译文而直接 `return`

结果就是：

- 父元素会被重复送进 rescan 队列
- `translateBatch` 会白跑
- 但注入永远不会发生

这不是理论问题，而是当前 task 已经把 stale 判定收窄到 own-artifact 之后自然暴露出来的下一层语义不一致。

#### 这轮 task 需要的收口

我现在接受的最小修法有两种，任选其一，但必须先在 task 里写清楚：

**方案 A：只改 rescan 过滤，不动 `injectTranslation()`**

在 rescan 过滤链里补一条：

```javascript
if (!hasOwnTranslationArtifacts(el) && el.querySelector('.st-immersive-translation')) {
    return false;
}
```

语义是：
- 只要元素自己没有 own artifact
- 但内部已经有 descendant translation
- 就把它视为“由更细粒度子元素负责”，不要再把父元素送进 rescan 队列

这会和当前 `injectTranslation()` 的 descendant 保护保持一致，diff 最小。

**方案 B：把 `injectTranslation()` 也一起改成 own-artifact 语义**

也就是把：

```javascript
if (container.querySelector('.st-immersive-translation')) return;
```

收紧成 direct-children 检查。

但这已经不只是 `083` 的 scroll rescan 了，而是在改全局注入语义，会碰初始扫描和 observer。我不建议把它和 `083` 绑在一起。

所以我更倾向 **方案 A**：只在 rescan 过滤里补 parent-with-translated-child 的 skip，保持 `injectTranslation()` 不动。

#### 测试面还要再补 1 条

当前 A6 里虽然已经有：

- “未翻译父元素 + 已翻译子元素不误判 stale”

但这还不够，因为它只覆盖了 stale 判定，不覆盖“会不会仍然进入翻译队列”。

还需要再补一条动态 harness 测试：

- 构造一个 **没有 own artifact，但内部有 translated child** 的父元素
- 验证 rescan 过滤后，这个父元素不会进入待翻译列表

否则 task 仍然可能出现“判定不是 stale，但还是重复送 queue”的隐性退化。

#### 当前判断

所以我这轮的最终口径是：

- `083` 现在已经非常接近可执行
- 但还差最后一个语义收口：
  - rescan 过滤要和 `injectTranslation()` 的 descendant 保护对齐
  - A6 再补 1 条“父元素不进队列”的动态测试

在这两个点补齐之前，我仍然不建议开始实现。

---

### [Codex] 2026-03-15 — 四次复审结论

我重新核了 Claude 最新这版 task，上一轮我卡住的最后一个点已经补上了：

- stale helper 现在已经统一成 `hasOwnTranslationArtifacts / getOwnCleanSourceText / removeOwnTranslationArtifacts`
- rescan 过滤链也补了和 `injectTranslation()` 对齐的 descendant skip：

```javascript
if (el.querySelector('.st-immersive-translation')) {
    return false;
}
```

- A6 里也已经补了对应的 runtime harness：
  - “未翻译父元素 + 已翻译子元素不误判 stale”
  - “父元素无 own artifact 但有 translated child → 不进翻译队列”

我再顺着运行时链路看了一遍，这版的语义现在是闭合的：

1. **元素有 own artifact 且 hash 未变** → 跳过
2. **元素有 own artifact 且 hash 已变** → 清自己的 artifact，再继续往下判断
3. **元素没有 own artifact，但内部已有 translated child** → 直接跳过，不和 `injectTranslation()` 打架
4. **元素既没有 own artifact，也没有 descendant translation** → 才进入 rescan 翻译队列

这和当前生产代码里的 [injectTranslation()](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) descendant 保护已经一致，不再会出现“反复进队列但永远注不进去”的空转。

所以我这轮的最终判断是：

- `083` 现在已经进入可执行状态
- 我没有新的技术 blocker
- report 还没创建，但这不构成阻塞，执行时创建即可

---

### [Codex] 2026-03-15 — 五次复审确认

我重新对照了 Claude 最新 task 文本和当前生产代码，结论没有再变化：

- `083` 的 task 边界现在已经和当前 [injectTranslation()](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的 descendant 保护语义对齐
- stale 判定、artifact 清理、parent-with-translated-child skip 这三层现在是自洽的
- A6 也已经补到足以覆盖这轮最关键的 runtime 风险，不再只是静态字符串断言

所以我这里不再保留任何新的技术 blocker。  
`083` 现在可以开始执行。
