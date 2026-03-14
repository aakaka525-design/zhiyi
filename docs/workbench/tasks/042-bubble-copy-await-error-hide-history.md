---
status: done
priority: P2
created: 2026-03-13
---

# 042 — Selection bubble 复制 await + 错误态隐藏 + 历史保存

- 来源讨论: [discussions/042-bubble-copy-await-error-hide-history.md](../discussions/042-bubble-copy-await-error-hide-history.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/042-bubble-copy-await-error-hide-history.md](../discussions/042-bubble-copy-await-error-hide-history.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/selection.js` | A + B + C：全部改动集中在 showBubble() |
| `tests/bubble-copy-error-history.test.mjs` | A + B + C |

## 任务清单

### 前置重构（C 约束：sourceLang/targetLang 提取）

在 A/B/C 改动之前，先把 `showBubble()` 中内联计算的语言变量提取为局部变量，让 translate 请求和 addHistory 复用同一组值。

- [x] `content/modules/selection.js` — `showBubble()`（当前 line 108-187），在 translate 调用前提取变量：
  ```javascript
  // 改前（line 155-161）
  try {
      const response = await ST.sendMessage({
          action: 'translate',
          text: text,
          from: ST.detectLanguage(text),
          to: ST.state.settings?.targetLang || 'zh'
      });

  // 改后
  const sourceLang = ST.detectLanguage(text);
  const targetLang = ST.state.settings?.targetLang || 'zh';

  try {
      const response = await ST.sendMessage({
          action: 'translate',
          text: text,
          from: sourceLang,
          to: targetLang
      });
  ```

**不要做的事**：
- 不要改 `ST.detectLanguage` 的逻辑
- 不要改 `ST.state.settings` 的读取方式
- 不要在 `try` 块内部声明这两个变量 — 它们需要在 `try` 之前声明，以便成功路径中 addHistory 能访问

### 推荐

#### A. Bubble 复制按钮 await clipboard

copy handler 改为 async，await 剪贴板写入成功后再变色。

- [x] `content/modules/selection.js` — copy handler（当前 line 170-177），改为 async：
  ```javascript
  // 改前
  const copyBtn = ST.ui.bubble.querySelector('#st-copy-btn');
  if (copyBtn) {
      copyBtn.onclick = () => {
          navigator.clipboard.writeText(response.text);
          copyBtn.style.color = 'var(--accent)';
          setTimeout(() => copyBtn.style.color = '', 1000);
      };
  }

  // 改后
  const copyBtn = ST.ui.bubble.querySelector('#st-copy-btn');
  if (copyBtn) {
      copyBtn.onclick = async () => {
          try {
              await navigator.clipboard.writeText(response.text);
              copyBtn.style.color = 'var(--accent)';
              setTimeout(() => copyBtn.style.color = '', 1000);
          } catch (err) {
              console.error('复制失败:', err);
          }
      };
  }
  ```

**不要做的事**：
- 不要把变色反馈改成 innerHTML 替换 — 气泡的 copy 按钮是 SVG 图标，变色即可
- 不要改变色恢复时间 1000ms
- 不要给 catch 加 toast 或用户可见的错误提示 — 与其他组件一致，静默处理

### 推荐

#### B. Bubble 错误态隐藏复制按钮

翻译失败时隐藏 `.st-bubble-actions`，成功时确保可见。

- [x] `content/modules/selection.js` — 成功路径（当前 line 166-177），在 `renderBubbleMessage` 之后确保 actions 可见：
  ```javascript
  // 改后（成功路径）
  if (response && response.text) {
      renderBubbleMessage(resultDiv, response.text);
      const actionsEl = ST.ui.bubble.querySelector('.st-bubble-actions');
      if (actionsEl) actionsEl.style.display = '';

      // 绑定复制 ...（A 的改动）
  ```

- [x] `content/modules/selection.js` — 错误路径 1（当前 line 178-180），隐藏 actions：
  ```javascript
  // 改前
  } else {
      renderBubbleMessage(resultDiv, `翻译失败: ${response?.error || '未知错误'}`, true);
  }

  // 改后
  } else {
      renderBubbleMessage(resultDiv, `翻译失败: ${response?.error || '未知错误'}`, true);
      const actionsEl = ST.ui.bubble?.querySelector('.st-bubble-actions');
      if (actionsEl) actionsEl.style.display = 'none';
  }
  ```

- [x] `content/modules/selection.js` — 错误路径 2/catch（当前 line 181-186），隐藏 actions：
  ```javascript
  // 改前
  } catch (err) {
      const resultDiv = ST.ui.bubble?.querySelector('.st-bubble-result');
      if (resultDiv) {
          renderBubbleMessage(resultDiv, `请求失败: ${err.message || '未知错误'}`, true);
      }
  }

  // 改后
  } catch (err) {
      const resultDiv = ST.ui.bubble?.querySelector('.st-bubble-result');
      if (resultDiv) {
          renderBubbleMessage(resultDiv, `请求失败: ${err.message || '未知错误'}`, true);
      }
      const actionsEl = ST.ui.bubble?.querySelector('.st-bubble-actions');
      if (actionsEl) actionsEl.style.display = 'none';
  }
  ```

**不要做的事**：
- 不要加 `error-state` CSS class — 气泡每次重建 DOM，JS 直接控制 display 更简洁
- 不要在 content.css 里新增气泡相关的 CSS 规则
- 不要改 `renderBubbleMessage()` 的接口

### 必做

#### C. Bubble 翻译保存历史

成功路径加 fire-and-forget 的 addHistory 调用，复用前置重构中提取的 sourceLang/targetLang。

- [x] `content/modules/selection.js` — 成功路径（紧跟 `renderBubbleMessage` 和 actions 显示之后），加 addHistory：
  ```javascript
  if (response && response.text) {
      renderBubbleMessage(resultDiv, response.text);
      const actionsEl = ST.ui.bubble.querySelector('.st-bubble-actions');
      if (actionsEl) actionsEl.style.display = '';

      // 保存历史（fire-and-forget，与 float-window 对齐）
      ST.sendMessage({
          action: 'addHistory',
          item: {
              source: text,
              target: response.text,
              sourceLang,
              targetLang,
              provider: response.provider || '',
          }
      });

      // 绑定复制 ...（A 的改动）
  ```

**不要做的事**：
- 不要 await addHistory — 气泡是瞬态 UI，fire-and-forget 与 float-window 一致
- 不要在 addHistory 之后刷新 sidebar 历史（`ST.refreshSidebarHistory`）— 气泡不知道 sidebar 是否存在
- 不要在错误路径保存历史

## 不做的事

- **不做** bubble 的朗读按钮 — 气泡保持轻量
- **不做** bubble 的收藏按钮 — 同上
- **不做** bubble addHistory 的 await — fire-and-forget
- **不做** content.css 新增气泡 CSS 规则 — JS 直接控制
- **不碰** manifest、immersive、floating-ball、ad-blocker、content.js、float-window.js、sidebar.js、popup.js、popup.html、popup.css、options.js、options.html、storage.js、translator.js、message-router.js、content.css

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check content/modules/selection.js` 通过
- [x] `git diff --check` 无输出
