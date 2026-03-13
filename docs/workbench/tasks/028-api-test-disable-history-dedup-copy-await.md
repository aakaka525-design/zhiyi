---
status: done
priority: P2
created: 2026-03-13
---

# 028 — Options API 测试防重复 + 历史去重加 targetLang + Sidebar 复制 await

- 来源讨论: [discussions/028-api-test-disable-history-dedup-copy-await.md](../discussions/028-api-test-disable-history-dedup-copy-await.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/028-api-test-disable-history-dedup-copy-await.md](../discussions/028-api-test-disable-history-dedup-copy-await.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `options/options.js` | A: testApiConnection 加 btn.disabled |
| `src/core/storage.js` | B: addHistory 去重加 targetLang |
| `content/modules/sidebar.js` | C: copy handler 加 async/await |
| `tests/api-test-dedup-copy.test.mjs` | A + B + C |

## 任务清单

### 推荐

#### A. Options API 测试按钮 disable 守卫

`testApiConnection()` 加载期间禁用按钮，与 `testTTS()` 行为对齐。

- [x] `options/options.js` — `testApiConnection()`（当前 line 206-294），在 `.loading` class 切换旁加 disable：
  ```javascript
  // 改前
  btn.classList.add('loading');
  statusEl.textContent = '';
  statusEl.className = 'test-status';

  // 改后
  btn.classList.add('loading');
  btn.disabled = true;
  statusEl.textContent = '';
  statusEl.className = 'test-status';
  ```

  ```javascript
  // 改前（finally）
  } finally {
      btn.classList.remove('loading');
  }

  // 改后（finally）
  } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
  }
  ```

**不要做的事**：
- 不要加前置 `if (btn.disabled) return` 判断 — DOM `disabled` 本身阻止点击
- 不要改 `testTTS()` — 它已正确处理
- 不要改按钮的 CSS `.loading` 样式

### 必做

#### B. 历史记录去重加 targetLang 条件

`addHistory()` 去重条件从只匹配 `source` 改为匹配 `source + targetLang`，避免不同目标语言的翻译被错误覆盖。

**B1. `src/core/storage.js` — addHistory 去重逻辑**

- [x] `addHistory()`（当前 line 152），修改 filter 条件：
  ```javascript
  // 改前
  const filtered = history.filter(h => h.source !== item.source);

  // 改后
  const filtered = history.filter(h => !(h.source === item.source && h.targetLang === item.targetLang));
  ```

  去重语义变化：
  - 改前：同 `source` 的所有历史条目都被移除
  - 改后：只移除 `source` 和 `targetLang` 都匹配的条目
  - `sourceLang` 不参与去重 — "auto" 和 "en" 翻译同一文本语义相同

**B2. 回归测试（在测试文件中）**

- [x] 测试必须覆盖两个场景：
  1. **同 source + 同 targetLang → 去重**：添加 `{ source: "hello", targetLang: "zh" }` 两次，历史中只保留一条（最新的）
  2. **同 source + 不同 targetLang → 并存**：添加 `{ source: "hello", targetLang: "zh" }` 再添加 `{ source: "hello", targetLang: "ja" }`，历史中保留两条

**不要做的事**：
- 不要改 `addHistory()` 的其他逻辑（id 生成、timestamp、MAX_HISTORY 限制）
- 不要改 `addFavorite()` 的去重逻辑 — 收藏只按 `source` 去重是正确的
- 不要在去重中加入 `sourceLang` — 会导致 "auto" 和 "en" 翻译 "hello" 产生重复

### 推荐

#### C. Sidebar 复制按钮 await clipboard

copy handler 改为 async，await 剪贴板写入成功后再显示"已复制"反馈。

- [x] `content/modules/sidebar.js` — copy handler（当前 line 318-324），改为 async：
  ```javascript
  // 改前
  const originalIcon = copyBtn.innerHTML;
  copyBtn.onclick = () => {
      navigator.clipboard.writeText(resultContent.innerText);
      copyBtn.innerHTML = '<span style="font-size: 10px; color: var(--accent);">已复制</span>';
      setTimeout(() => {
          copyBtn.innerHTML = originalIcon;
      }, 1500);
  };

  // 改后
  const originalIcon = copyBtn.innerHTML;
  copyBtn.onclick = async () => {
      try {
          await navigator.clipboard.writeText(resultContent.innerText);
          copyBtn.innerHTML = '<span style="font-size: 10px; color: var(--accent);">已复制</span>';
          setTimeout(() => {
              copyBtn.innerHTML = originalIcon;
          }, 1500);
      } catch (err) {
          console.error('复制失败:', err);
      }
  };
  ```

**不要做的事**：
- 不要加失败时的 toast 提示 — 与 popup 行为一致，静默处理
- 不要改 popup 的 copy handler — 它已正确处理
- 不要改 `originalIcon` 的捕获逻辑
- 不要改 1500ms 的恢复时间

## 不做的事

- **不做** API 测试错误码到友好消息的映射 — 状态码足够直观
- **不做** 收藏去重逻辑变更 — 收藏按 source 去重是正确的
- **不做** sidebar 复制失败 toast — 与 popup 一致
- **不做** float-window 添加复制按钮 — UI 功能扩展
- **不碰** manifest、immersive、selection、floating-ball、ad-blocker、content.css、popup.css、popup.html、options.html、content.js、translator.js、message-router.js

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check options/options.js` 通过
- [x] `node --check src/core/storage.js` 通过
- [x] `node --check content/modules/sidebar.js` 通过
- [x] `git diff --check` 无输出
