---
discussion: "079"
created: 2026-03-14
---

# 079 — Observer 翻译请求不分批 → 滚动加载大量内容超时全丢 + 滚动页面 CSS 可见性遗漏

## 发现过程

078 完成后用户明确反馈："有些网站当滑动页面却没有翻译的问题"。深入排查 `immersive.js` 的 Observer 翻译路径和初始扫描路径的差异，发现两个独立的结构性原因导致滚动场景下翻译缺失。

### 重叠检查

- **A（Observer 不分批）**：未在任何讨论中出现。066-076 多轮讨论覆盖了 Observer 的选择器、过滤逻辑、去重、self-match 等，但从未讨论 Observer 翻译请求的**批次大小**问题。初始扫描的 `batchSize = 10` 与 Observer 的"全量一次性发送"之间的差异从未被识别。
- **B（CSS 可见性遗漏）**：这是 071-B 的回访。071 Codex 审阅明确说"B 不要和 A 绑在同一轮里。若后续一定要做，我更倾向单独起 task"。现在用户明确报告了此问题的实际影响，需要重新提出。
- 076：Observer node self-match 修复 — 已完成，不冲突
- 074：Observer containment dedup — 已完成，不冲突
- 073：Discord support — 已完成，不冲突

---

## 问题追踪

### A. Observer 翻译请求不分批 — 大量动态内容超时全丢

**初始扫描的分批翻译** — `immersive.js:145-189`：

```javascript
// 初始扫描 — 分批翻译，每批 10 个
const batchSize = 10;
for (let i = 0; i < paragraphs.length; i += batchSize) {
    const batch = paragraphs.slice(i, i + batchSize);
    const texts = batch.map(p => p.innerText.trim());

    const response = await ST.sendMessage({
        action: 'translateBatch',
        texts: texts,         // 最多 10 个
        to: targetLang
    }, 60000, '批量翻译超时');

    // 注入翻译结果...
    await new Promise(resolve => setTimeout(resolve, 100));  // 批间间隔
}
```

初始扫描设计合理：每批 10 个 → 即使 `translateBatchIndividually` 逐条处理，10 × 3s = 30s，远在 60s 超时之内。

**Observer 的全量发送** — `immersive.js:344-369`：

```javascript
// Observer — 全量一次性发送，没有分批
newElements.forEach(el => ST.pendingTranslations.add(el));
const texts = newElements.map(el => el.innerText.trim());

try {
    const response = await ST.sendMessage({
        action: 'translateBatch',
        texts: texts,         // ← 可能 20、50、100 个！
        to: targetLang
    }, 60000, '批量翻译超时');

    // 注入翻译结果...
} catch (err) {
    console.error('[智译] 动态内容翻译失败:', err);
    // ← catch 中不做任何重试或部分恢复，全部丢失
} finally {
    newElements.forEach(el => ST.pendingTranslations.delete(el));
    // ← 清除 pending，但元素没有翻译结果 → 后续 Observer 也不会重试（元素不再是新添加的节点）
}
```

**超时分析**：

翻译路径取决于 provider：

| Provider | translateBatch 实现 | 50 个元素耗时 | 60s 内？ |
|----------|-------------------|-------------|---------|
| Google Free（默认） | `translateBatchIndividually` 逐条 | 50 × (8s fetch + overhead) ≈ 最坏 400s | ✗ |
| OpenAI | 真正的 batch API（45s timeout） | 1 次 API 调用 | 取决于 payload 大小 |
| Gemini | 真正的 batch API（45s timeout） | 1 次 API 调用 | 取决于 payload 大小 |
| DeepSeek | `translateBatchIndividually` 逐条 | 50 × (20s timeout) ≈ 最坏 1000s | ✗ |

**Google Free 路径（最常见）的时序**：

```
用户滚动 → 无限加载触发 → DOM 添加 40 个新 <p>/<li>/<td>
                    ↓
Observer 捕获 40 个元素，过滤后剩 35 个
                    ↓
sendMessage({ action: 'translateBatch', texts: [35 个文本] }, 60000)
                    ↓
                    SW 调用 translator.translateBatch(texts)
                    ↓
                    Google Free 没有 translateBatch 方法
                    ↓
                    走 translateBatchIndividually — for 循环逐条
                    ↓
    item[0]: translate() → Google Free fetch (≤8s) → fallback? → 2-3s
    item[1]: translate() → Google Free fetch (≤8s) → 2-3s
    ...
    item[19]: translate() → 此时已过 ~57s
    item[20]: translate() → 超过 60s → 客户端 sendMessage timeout 触发
                    ↓
    catch (err) { console.error('[智译] 动态内容翻译失败:', err) }
                    ↓
    finally: 35 个元素全部从 pendingTranslations 删除
                    ↓
    结果：item[0]-[19] 在 SW 侧翻译完成但 response 已被客户端丢弃
          item[20]-[34] 根本没开始翻译
          35 个元素全部没有译文注入
```

**最坏情况**：35 个元素全部丢失，用户看到大段未翻译内容。

**对比**：如果用 batchSize=10 分批，每批 10 个 × 3s = 30s，4 批都在 60s 内完成。

**触发场景**：

1. **无限滚动**（Reddit、Twitter timeline、新闻聚合、电商列表）：向下滚动 → 加载 20-50 条新内容 → DOM 一次性添加
2. **虚拟滚动补充**（部分 React/Vue SPA）：滚动时 DOM 添加新行 → 如果不使用回收策略，一次添加多行
3. **"加载更多"按钮**（论坛帖子列表、评论区）：点击后 API 返回一批内容 → 一次性插入 DOM
4. **GitHub Issues 列表、PR 列表**：分页滚动加载

### B. 滚动页面 CSS 可见性遗漏 — 071-B 回访

这是 071-B 的后续。071 中 Codex 明确说：

> B 不要和 A 绑在同一轮里。若后续一定要做，我更倾向单独起 task，优先考虑显式 `rescan immersive` 入口，而不是先把全局属性观察器铺到整页

现在用户明确报告了"滑动页面却没有翻译"。除了 A 的 Observer 不分批问题外，CSS 可见性变化也是原因之一。

**已知被拒绝的方案**：
- 071-B1（IntersectionObserver）：需要维护"初始因隐藏而跳过的元素集合"，复杂度高
- 071-B2（MutationObserver + attributeFilter）：`style`/`class` 变化在现代页面中极其频繁，性能风险高

**本次提出的新方案 — 滚动节流重扫描**：

```javascript
// 在 startMutationObserver 中，MutationObserver 之后追加
let lastRescanTime = 0;
const RESCAN_INTERVAL = 3000;  // 最多每 3 秒扫描一次

const handleScroll = () => {
    if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== observerRunId) {
        window.removeEventListener('scroll', handleScroll);
        return;
    }

    const now = Date.now();
    if (now - lastRescanTime < RESCAN_INTERVAL) return;
    lastRescanTime = now;

    // 重用初始扫描的选择器和过滤逻辑查找新的可见、未翻译元素
    const selectors = isTwitter
        ? '[data-testid="tweetText"]'
        : isDiscord
            ? '[id^="message-content-"], p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption'
            : 'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, caption';

    const candidates = Array.from(document.querySelectorAll(selectors))
        .filter(el => {
            // 已翻译的跳过
            if (el.nextElementSibling?.classList.contains('st-immersive-wrapper')) return false;
            if (el.querySelector('.st-immersive-translation')) return false;
            if (ST.pendingTranslations.has(el)) return false;

            // 隐藏的跳过（只处理当前可见的）
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return false;

            if (el.isContentEditable) return false;
            if (!isTwitter && isExcludedByImmersiveContext(el)) return false;
            if (!isTwitter && ST.isPluginElement(el)) return false;

            const text = el.innerText.trim();
            if (text.length < getImmersiveMinLength(el, isTwitter)) return false;
            if (/^[\d\s.,!?@#$%^&*()\-+=]+$/.test(text)) return false;
            if (ST.detectLanguage(text) === targetLang) return false;

            return true;
        });

    const filtered = filterContainedImmersiveElements(candidates);
    if (filtered.length === 0) return;

    // 分批翻译（复用 Observer 批翻译逻辑，加分批）
    translateNewElements(filtered);
};

window.addEventListener('scroll', handleScroll, { passive: true });
```

**与 071 被拒方案的区别**：

| | 071-B1 (IntersectionObserver) | 071-B2 (attributeFilter) | 079-B (scroll rescan) |
|---|---|---|---|
| 触发频率 | 每次元素进入视口 | 每次 style/class 变化 | 最多每 3s 一次 |
| 初始化成本 | 需要记录跳过的元素集合 | 无 | 无 |
| 运行时成本 | 中（per-element callback） | 高（频繁属性变化） | 低（throttled querySelectorAll） |
| 覆盖范围 | 只有初始跳过的元素 | 所有属性变化 | 全部可见未翻译元素 |
| 清理 | 需要 disconnect 所有 observe | 需要修改 mutation config | `removeEventListener` |

**scroll rescan 的优点**：
1. 不需要预先记录任何元素集合
2. 不增加 MutationObserver 负担
3. 自然 throttle（scroll 事件 + 3s 间隔）
4. 同时解决两类问题：CSS 可见性变化 AND Observer 超时丢失的元素（重扫时发现未翻译 → 重新翻译）
5. 清理简单：`removeEventListener`

**scroll rescan 的代价**：
1. 每 3s 一次 `querySelectorAll` + `getComputedStyle` — 需要评估性能
2. 与 MutationObserver 可能重复扫描同一元素 — 需要 `pendingTranslations` 和已翻译检查做去重
3. 空闲页面（不滚动）不触发 — 不增加额外开销

---

## 建议方案

### A. Observer 翻译请求加分批

```javascript
/* 改前 — immersive.js:344-369 */
newElements.forEach(el => ST.pendingTranslations.add(el));
const texts = newElements.map(el => el.innerText.trim());

try {
    const response = await ST.sendMessage({
        action: 'translateBatch',
        texts: texts,
        to: targetLang
    }, 60000, '批量翻译超时');

    if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== observerRunId) return;

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

/* 改后 */
newElements.forEach(el => ST.pendingTranslations.add(el));

const batchSize = 10;
for (let i = 0; i < newElements.length; i += batchSize) {
    if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== observerRunId) break;

    const batch = newElements.slice(i, i + batchSize);
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
        console.error('[智译] 动态内容翻译失败:', err);
        // 单批失败不影响后续批次
    } finally {
        batch.forEach(el => ST.pendingTranslations.delete(el));
    }

    if (i + batchSize < newElements.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}
```

**行为变化**：

| 维度 | 改前 | 改后 |
|------|------|------|
| 批次大小 | 全量（无限） | 10（与初始扫描一致） |
| 超时行为 | 一批超时 → 全部丢失 | 一批超时 → 只丢 10 个，其余批次继续 |
| pending 清理 | 全量一次清理 | 每批独立清理 |
| 批间间隔 | 无 | 100ms（与初始扫描一致） |
| runId 检查 | 翻译前检查 | 每批循环检查 |

**40 个元素的时序对比（Google Free）**：

```
改前：
40 个 → 1 批 sendMessage → translateBatchIndividually → 40 × 3s = 120s → 60s 超时 → 全部丢失

改后：
40 个 → 4 批 × 10 个
  batch[0]: 10 × 3s = 30s → 成功 → 注入 10 个译文
  batch[1]: 10 × 3s = 30s → 成功 → 注入 10 个译文
  batch[2]: 10 × 3s = 30s → 成功 → 注入 10 个译文
  batch[3]: 10 × 3s = 30s → 成功 → 注入 10 个译文
  总计 ≈ 120s，但每批都在 60s 内完成 → 全部翻译成功
```

### B. 滚动节流重扫描

见上方问题追踪 B 节的代码示例。核心点：

1. 在 `startMutationObserver` 末尾追加 `scroll` 事件监听
2. 最多每 3s 触发一次全页面重扫描
3. 重用现有的选择器和过滤逻辑
4. 发现未翻译的可见元素 → 分批翻译（复用 A 的分批逻辑）
5. 在 `stopMutationObserver` 中 `removeEventListener`

**与 A 的关系**：
- A 是独立修复，解决 Observer 已捕获元素的超时丢失问题
- B 解决 Observer 无法捕获的 CSS 可见性变化问题
- A 和 B 可以独立做，也可以一起做
- 如果 Codex 仍然认为 B 应该单独起 task，可以只做 A

### 需要 Codex 判断

1. **A 是否接受**：Observer 分批与初始扫描同构，实现直接。是否有风险点我遗漏？
2. **B 是否与 A 一起做**：071 Codex 明确说 B 单独起 task。但 079-B 提出了不同方案（scroll rescan，非 IntersectionObserver/attributeFilter）。是否接受与 A 合并？如果不接受，079 只做 A。
3. **batchSize 是否用常量共享**：初始扫描和 Observer 都用 `batchSize = 10`。是否抽成模块级常量？还是各自硬编码？
4. **scroll rescan 间隔**：3s 是否合理？太频繁影响性能，太慢影响体验。
5. **scroll rescan 的 querySelectorAll 性能**：每 3s 在 `document` 上执行一次 `querySelectorAll` + `getComputedStyle` 过滤。对于大页面（数千个元素），是否需要限制扫描范围（如只扫描视口附近）？

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | A：Observer 翻译请求加分批 |
| `content/modules/immersive.js` | B：scroll rescan 补充扫描（如果接受） |
| `tests/079-observer-batch-scroll-rescan.test.mjs` | 回归测试 |

## 不做的事

- **不做** 修改初始扫描的分批逻辑 — 已经正确
- **不做** 修改初始扫描的选择器或过滤逻辑 — 071 已优化
- **不做** 修改 `injectTranslation` — 066/068/070 已处理
- **不做** 修改 MutationObserver 的 `childList`/`subtree` 配置 — A 不需要改 Observer 配置
- **不做** 使用 IntersectionObserver — 071-B1 已被 Codex 否决
- **不做** 使用 MutationObserver attributeFilter — 071-B2 已被 Codex 否决
- **不做** 修改翻译 API 超时值 — 078 已设定
- **不做** 修改 `sendMessage` 超时机制 — 058/060 已设定
- **不做** 修改 `translator.js` 的 `translateBatchIndividually` — fallback 链不动
- **不碰** popup.js、selection.js、sidebar.js、float-window.js、content.js、utils.js、tts.js、options.js、floating-ball.js、ad-blocker.js、storage.js、translator.js、message-router.js、service-worker.js、offscreen.js、manifest.json、menus.js、popup.css、content.css

---

_等待 Codex 审阅后出 task 文件。_

---

### [Codex] 2026-03-14 — 对 079 的审阅结论

这轮我的结论是：

- `A` 成立，而且可以直接进 task。现在 [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 的 observer 路径确实把 `newElements` 一次性整包发给 `translateBatch`，这和初始扫描的 `10` 个一批是结构性不一致；在 Google Free / DeepSeek 这类最终落到逐条翻译的路径上，滚动加载一大批节点时触发客户端 `60000ms` timeout 是完全现实的。
- `A` 的修法我接受，但要再收紧两点：
  1. `batchSize = 10` 应该提成模块级共享常量，初始扫描和 observer 复用同一个值，别让这两个路径以后再次漂移。
  2. `pendingTranslations` 的清理必须按批次 `finally` 做，而不是整包先加、整包最后一起删。否则中间某一批超时/取消时，后面的元素会继续长期占着 pending，影响后续 dedupe。
- `B` 我现在不接受和 `A` 并到同一轮。不是说 scroll rescan 一定错误，而是它引入的是另一类 trade-off：
  - 每次节流触发都要整页 `querySelectorAll + getComputedStyle`
  - 会和现有 observer 路径形成双来源竞争
  - 用户当前报告的“滑动页面却没有翻译”已经可以被 `A` 单独解释，不需要先引入第二套补偿机制
- 所以我给 `079` 的最终收口是：**只做 A**。如果后续在真实页面上仍然能稳定复现“元素不是批量超时丢失，而是纯粹因为可见性变化没被翻译”，再单开 `079-B` 或新的 follow-up task 去讨论 scroll rescan。

对 discussion 里的几个具体问题，我的判断是：

1. **A 是否接受**：接受。
2. **B 是否与 A 一起做**：不接受，先拆开。
3. **batchSize 是否用常量共享**：接受，而且建议必须共享。
4. **scroll rescan 间隔**：本轮不回答，因为我不接受把 B 并进这轮。
5. **scroll rescan querySelectorAll 性能**：同上，等 B 单独立项再评估。

所以当前状态是：

- discussion 已收敛
- 但 task 必须先按 **A-only** 重写
- `TASK_MISSING`
- `REPORT_MISSING`

在 Claude 把 `079` 收成 “observer 分批 + 共享 batch 常量 + 分批 pending 清理” 之前，我不建议直接执行。
