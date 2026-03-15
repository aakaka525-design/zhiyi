---
status: done
priority: P2
created: 2026-03-14
---

# 079 — Observer 翻译请求不分批 → 滚动加载大量内容超时全丢

- 来源讨论: [discussions/079-observer-unbatched-scroll-rescan.md](../discussions/079-observer-unbatched-scroll-rescan.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/079-observer-unbatched-scroll-rescan.md](../discussions/079-observer-unbatched-scroll-rescan.md)（完整讨论记录 + Codex 审阅）

## 背景

Observer 翻译路径（`immersive.js:344-369`）将所有新捕获元素一次性发送给 `translateBatch`，没有分批。初始扫描使用 `batchSize = 10` 分批翻译（`immersive.js:145-189`），两条路径结构性不一致。

当无限滚动页面一次加载 30-50 个元素时：
- Google Free / DeepSeek 走 `translateBatchIndividually` 逐条翻译
- 40 × 3s = 120s → 超过客户端 60s sendMessage 超时
- 整批全部丢失，用户看到大段未翻译内容

Codex 审阅结论：
- A 接受：Observer 加分批，与初始扫描同构
- batchSize 必须提成模块级共享常量，初始扫描和 Observer 复用同一个值，防止两条路径以后再次漂移
- pendingTranslations 清理必须按批次 finally 做，不能整包先加后删 — 中间某批超时/取消时，后面的元素不应长期占着 pending 影响后续 dedupe
- B（scroll rescan）不进本轮，先拆开

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | A1：模块级 IMMERSIVE_BATCH_SIZE 常量 |
| `content/modules/immersive.js` | A2：初始扫描使用 IMMERSIVE_BATCH_SIZE |
| `content/modules/immersive.js` | A3：Observer 翻译请求加分批 + 分批 pending 清理 |
| `tests/079-observer-batch.test.mjs` | A4：回归测试 |

## 任务清单

### 必做

#### A1. 模块级 IMMERSIVE_BATCH_SIZE 常量

- [x] 在 `immersive.js` 模块作用域（`filterContainedImmersiveElements` 函数之后、`ST.toggleImmersive` 之前，约 line 46）新增：

  ```javascript
  const IMMERSIVE_BATCH_SIZE = 10;
  ```

  行为说明：
  - 共享常量，初始扫描和 Observer 复用同一个值
  - 命名用 `IMMERSIVE_BATCH_SIZE` 而非 `BATCH_SIZE`，避免与其他模块冲突
  - 值 10 不变 — 与当前初始扫描行为一致

#### A2. 初始扫描使用 IMMERSIVE_BATCH_SIZE

- [x] `immersive.js:145` — 删除局部变量，使用模块常量：

  ```javascript
  /* 改前（line 145） */
  const batchSize = 10;

  /* 改后 — 删除此行 */
  ```

- [x] `immersive.js:149` — 循环使用常量：

  ```javascript
  /* 改前 */
  for (let i = 0; i < paragraphs.length; i += batchSize) {

  /* 改后 */
  for (let i = 0; i < paragraphs.length; i += IMMERSIVE_BATCH_SIZE) {
  ```

- [x] `immersive.js:152` — slice 使用常量：

  ```javascript
  /* 改前 */
  const batch = paragraphs.slice(i, i + batchSize);

  /* 改后 */
  const batch = paragraphs.slice(i, i + IMMERSIVE_BATCH_SIZE);
  ```

- [x] `immersive.js:186` — 批间间隔检查使用常量：

  ```javascript
  /* 改前 */
  if (i + batchSize < paragraphs.length) {

  /* 改后 */
  if (i + IMMERSIVE_BATCH_SIZE < paragraphs.length) {
  ```

  行为不变，只是替换硬编码局部变量为模块级常量引用。

#### A3. Observer 翻译请求加分批 + 分批 pending 清理

- [x] 替换 `immersive.js:344-369` 的整块翻译逻辑：

  ```javascript
  /* 改前（immersive.js:344-369） */
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
  for (let i = 0; i < newElements.length; i += IMMERSIVE_BATCH_SIZE) {
      if (!ST.state.isImmersiveEnabled || ST.state.immersiveRunId !== observerRunId) break;

      const batch = newElements.slice(i, i + IMMERSIVE_BATCH_SIZE);
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
          console.error('[智译] 动态内容翻译失败:', err);
      } finally {
          batch.forEach(el => ST.pendingTranslations.delete(el));
      }

      if (i + IMMERSIVE_BATCH_SIZE < newElements.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
      }
  }
  ```

  行为说明：
  - **分批发送**：每批最多 IMMERSIVE_BATCH_SIZE (10) 个元素，与初始扫描同构
  - **分批 pending 管理**：每批开始时 `add`，每批 `finally` 时 `delete` — 中间某批失败/超时/取消时，后续批次的元素不会长期占着 pending 影响 dedupe
  - **单批失败不阻塞后续批次**：`catch` 只 `console.error`，循环继续下一批
  - **runId 检查**：每批循环开始和 response 返回后都检查 — 用户关闭沉浸式翻译时立即停止
  - **批间间隔**：100ms（与初始扫描一致）— 避免 burst 请求
  - **超时安全**：单批 10 个 × 3s = 30s → 远在 60s sendMessage 超时内

  **40 个元素的时序对比（Google Free）**：

  | | 改前 | 改后 |
  |---|---|---|
  | 批次 | 1 批 × 40 个 | 4 批 × 10 个 |
  | 耗时 | 40 × 3s = 120s → 超时 | 每批 30s → 均在超时内 |
  | 结果 | 全部丢失 | 全部翻译成功 |

#### A4. 回归测试

- [x] 新建 `tests/079-observer-batch.test.mjs`，至少覆盖：
  1. **A1 — 模块级常量存在**：静态断言 `immersive.js` 包含 `const IMMERSIVE_BATCH_SIZE = 10`
  2. **A2 — 初始扫描使用常量**：静态断言初始扫描循环使用 `IMMERSIVE_BATCH_SIZE` 而非硬编码 `batchSize`
  3. **A2 — 初始扫描不含局部 batchSize 变量**：静态断言 `immersive.js` 不包含 `const batchSize = 10`
  4. **A3 — Observer 使用分批循环**：静态断言 Observer 回调中包含 `for` 循环和 `IMMERSIVE_BATCH_SIZE`
  5. **A3 — Observer 分批 pending 清理**：静态断言 Observer 的 `finally` 块中有 `batch.forEach(el => ST.pendingTranslations.delete(el))` 且位于循环内部
  6. **A3 — Observer 批间间隔**：静态断言 Observer 循环包含 `setTimeout(resolve, 100)` 批间间隔
  7. **结构一致性**：断言初始扫描和 Observer 都使用 `IMMERSIVE_BATCH_SIZE`，不存在硬编码的 `batchSize` 局部变量

#### A5. 现有测试兼容性

- [x] 修改完 A1-A3 后运行 `node --test tests/*.test.mjs`，如果现有测试因正则变化而失败，需要更新

  更新原则：
  - 保留原有断言意图
  - 在正则中使用 `[\s\S]*` 或放宽匹配以兼容 `IMMERSIVE_BATCH_SIZE` 常量引用
  - 不删除原有断言

**不要做的事**：
- 不要实现 B（scroll rescan）— Codex 明确不接受与 A 并到同一轮
- 不要修改初始扫描的逻辑结构 — 只替换 batchSize 变量为常量
- 不要修改 Observer 的选择器或过滤逻辑 — 只改翻译请求的分批
- 不要修改 MutationObserver 的 `childList`/`subtree` 配置
- 不要修改 `injectTranslation`
- 不要修改翻译 API 超时值 — 078 已设定
- 不要修改 `sendMessage` 超时机制 — 058/060 已设定
- 不要修改 `translator.js` 的 `translateBatchIndividually` — fallback 链不动
- 不要碰 popup.js、selection.js、sidebar.js、float-window.js、content.js、utils.js、tts.js、options.js、floating-ball.js、ad-blocker.js、storage.js、translator.js、message-router.js、service-worker.js、offscreen.js、manifest.json、menus.js、popup.css、content.css

## 不做的事

- **不做** B（scroll rescan）— Codex 明确：先拆开，只做 A
- **不做** 修改 Observer 选择器/过滤逻辑
- **不做** 修改 MutationObserver 配置
- **不做** 修改翻译 API 超时

## 验证要求

- [x] `node --test tests/079-observer-batch.test.mjs` 通过
- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check content/modules/immersive.js` 通过
- [x] `git diff --check` 无输出
