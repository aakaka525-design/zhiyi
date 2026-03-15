---
status: done
priority: P2
created: 2026-03-14
---

# 074 — Observer 嵌套去重缺失 — 父子元素同批翻译导致重复译文

- 来源讨论: [discussions/074-observer-containment-dedup-missing.md](../discussions/074-observer-containment-dedup-missing.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/074-observer-containment-dedup-missing.md](../discussions/074-observer-containment-dedup-missing.md)（完整讨论记录 + Codex 审阅）

## 背景

初始扫描通用路径在 `immersive.js:120-124` 有嵌套去重过滤（`other.contains(el)`），确保父子元素不会同时被翻译。但 Observer 过滤链（`immersive.js:312-327`）完全缺失此过滤，导致 mutation 同时添加父子元素时（如 `<blockquote>` 内含 `<p>`，或 Discord 消息 div 内含 Markdown 段落），两者都被翻译，用户看到重复译文。

Codex 审阅结论：
- 方向成立，`pendingTranslations` / `querySelector` / `nextElementSibling` 现有去重都不能替代父子包含关系去重
- 不接受直接复制粘贴同一段 `arr.some(other.contains(el))` — 必须抽共享 helper，初始扫描和 Observer 都复用，避免再次出现"一处改了另一处忘同步"
- dedup 放在 Observer 现有过滤之后、`pendingTranslations.add()` 之前
- Twitter 不需特判 — 共享 helper 无条件跑在候选集上，对 Twitter 是低成本 no-op
- O(n²) 不是 blocker — 候选集规模小，不需要祖先索引/Set 优化

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | A1：新增共享 helper `filterContainedImmersiveElements` |
| `content/modules/immersive.js` | A2：初始扫描通用路径复用 helper |
| `content/modules/immersive.js` | A3：Observer 过滤链末尾调用 helper |
| `tests/074-observer-containment-dedup.test.mjs` | A4：回归测试 |

## 任务清单

### 必做

#### A1. 新增共享 helper `filterContainedImmersiveElements`

- [x] `immersive.js:38` — 在 `isExcludedByImmersiveContext` 函数之后、`ST.toggleImmersive` 之前，添加共享 helper：

  ```javascript
  /* 新增（在 isExcludedByImmersiveContext 之后） */
  function filterContainedImmersiveElements(elements) {
      return elements.filter((el, index, arr) => {
          return !arr.some((other, otherIndex) =>
              otherIndex !== index && other.contains(el) && other !== el
          );
      });
  }
  ```

  行为说明：
  - 接收元素数组，返回过滤后的数组
  - 移除被数组中其他元素包含的内层元素，只保留最外层
  - 例如 `[blockquote, p]` 且 `blockquote.contains(p)` → 返回 `[blockquote]`
  - 不修改原数组 — `.filter()` 返回新数组
  - O(n²) 复杂度，对 Observer 批次规模足够

#### A2. 初始扫描通用路径复用 helper

- [x] `immersive.js:119-124` — 将内联的嵌套去重 `.filter()` 替换为 helper 调用：

  ```javascript
  /* 改前（line 118-124） */
                  return true;
              })
              .filter((el, index, arr) => {
                  return !arr.some((other, otherIndex) =>
                      otherIndex !== index && other.contains(el) && other !== el
                  );
              });

  /* 改后 */
                  return true;
              });
          paragraphs = filterContainedImmersiveElements(paragraphs);
  ```

  行为说明：
  - 行为完全不变 — 只是把内联逻辑替换为 helper 调用
  - 注意：原来的 `.filter()` 链式调用变成先赋值 `paragraphs` 再调 helper，因为 `querySelectorAll` → `.filter()` → `.filter()` 的链式写法改成两步
  - 也可以保持链式：`paragraphs = filterContainedImmersiveElements(Array.from(...).filter(...));` — 只要最终效果相同即可

#### A3. Observer 过滤链末尾调用 helper

- [x] `immersive.js:327-331` — 在现有过滤之后、`pendingTranslations.add()` 之前，添加嵌套去重：

  ```javascript
  /* 改前（line 327-331） */
        });

        if (newElements.length === 0) return;

        newElements.forEach(el => ST.pendingTranslations.add(el));

  /* 改后 */
        });

        // 嵌套去重：移除被其他候选元素包含的内层元素
        newElements = filterContainedImmersiveElements(newElements);

        if (newElements.length === 0) return;

        newElements.forEach(el => ST.pendingTranslations.add(el));
  ```

  行为说明：
  - 位置关键：在所有条件过滤之后、`pendingTranslations.add()` 和 `translateBatch` 之前
  - 过滤顺序：文本长度 → contenteditable → EXCLUDE → plugin → wrapper/translation/pending 去重 → 语言检测 → **嵌套去重** → pendingTranslations → API 调用
  - 对 Twitter 路径：tweet 元素使用 `[data-testid="tweetText"]` 选择器，不存在父子嵌套，helper 是 no-op
  - 对 Discord 路径：消息 div + 通用元素同时收集，helper 会移除消息 div 内的 `<p>`/`<li>` 等子元素
  - 对通用路径：`<blockquote>` 内的 `<p>`、`<li>` 内的 `<blockquote>` 等嵌套场景，只保留外层

#### A4. 回归测试

- [x] 新建 `tests/074-observer-containment-dedup.test.mjs`，至少覆盖：
  1. **A1 — helper 基本行为**：`[blockquote, p]` 且 blockquote 包含 p → 只返回 blockquote
  2. **A1 — helper 无嵌套时不过滤**：`[p1, p2]` 互不包含 → 返回 `[p1, p2]`
  3. **A1 — helper 空数组**：`[]` → 返回 `[]`
  4. **A1 — helper 多层嵌套**：`[div, blockquote, p]` 且 div > blockquote > p → 只返回 div
  5. **A2 — 初始扫描通用路径去重仍生效**：页面有 `<blockquote><p>text</p></blockquote>` → 只翻译 blockquote
  6. **A3 — Observer 去重生效**：模拟 mutation 添加含 `<blockquote><p>text</p></blockquote>` 的节点 → 只有 blockquote 进入 translateBatch
  7. **A3 — Observer Discord 路径去重**：模拟 mutation 添加含 `<p>` 的 Discord 消息 div → 只有消息 div 进入 translateBatch
  8. **A3 — Observer 无嵌套时不误过滤**：模拟 mutation 添加多个平级 `<p>` → 全部进入 translateBatch

**不要做的事**：
- 不要修改 Observer 的元素收集逻辑 — 收集宽、过滤严是正确模式
- 不要修改 `getImmersiveMinLength` — 071/073 已处理
- 不要修改 `isExcludedByImmersiveContext` — 072 已处理
- 不要修改 `injectTranslation` 注入逻辑
- 不要为 Twitter 添加特殊嵌套去重逻辑 — 共享 helper 无条件运行即可
- 不要添加 debounce — 独立的性能优化议题
- 不要添加 O(n²) 性能优化（祖先索引/Set）— Codex 明确本轮不需要
- 不要碰 popup.js、selection.js、sidebar.js、float-window.js、content.js、utils.js、tts.js、options.js、floating-ball.js、ad-blocker.js、storage.js、translator.js、message-router.js、service-worker.js、offscreen.js、manifest.json、menus.js、popup.css、content.css

## 不做的事

- **不做** 修改 Observer 的元素收集逻辑
- **不做** 添加 debounce 到 Observer
- **不做** 为 Twitter 路径特判
- **不做** 性能优化（O(n²) → O(n)）
- **不做** 修改初始扫描 Discord/Twitter 专用路径的过滤逻辑

## 验证要求

- [x] `node --test tests/074-observer-containment-dedup.test.mjs` 通过
- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `git diff --check` 无输出
