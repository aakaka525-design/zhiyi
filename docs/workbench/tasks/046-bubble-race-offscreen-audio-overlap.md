---
status: done
priority: P2
created: 2026-03-13
---

# 046 — 划词气泡翻译竞态守卫 & Offscreen 单实例音频

- 来源讨论: [discussions/046-bubble-race-offscreen-audio-overlap.md](../discussions/046-bubble-race-offscreen-audio-overlap.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/046-bubble-race-offscreen-audio-overlap.md](../discussions/046-bubble-race-offscreen-audio-overlap.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/selection.js` | A：showBubble() 加 myBubble 守卫 |
| `offscreen/offscreen.js` | B：playAudio() 改为单实例 + cancelCurrent |
| `tests/bubble-race-offscreen-audio.test.mjs` | A + B |

## 任务清单

### 必做

#### A. showBubble() 加 bubble instance 守卫

快速重选文本时，旧翻译请求恢复后把结果写入新气泡、触发错误的 addHistory、绑定错误的 copy 按钮。

- [x] `content/modules/selection.js` — `showBubble()` 函数，在 `document.body.appendChild(ST.ui.bubble);`（当前 line 136）之后，capture 当前 bubble：
  ```javascript
  // 改前（line 136 之后直接是 rect 判断）
  document.body.appendChild(ST.ui.bubble);

  if (rect) {

  // 改后
  document.body.appendChild(ST.ui.bubble);

  const myBubble = ST.ui.bubble;

  if (rect) {
  ```

- [x] `content/modules/selection.js` — `await ST.sendMessage` 之后（当前 line 165），加守卫 + 替换后续所有 `ST.ui.bubble` 为 `myBubble`：
  ```javascript
  // 改前（line 165-167）
  });

  const resultDiv = ST.ui.bubble?.querySelector('.st-bubble-result');
  if (!resultDiv) return;

  // 改后
  });

  if (ST.ui.bubble !== myBubble) return;

  const resultDiv = myBubble.querySelector('.st-bubble-result');
  if (!resultDiv) return;
  ```

- [x] `content/modules/selection.js` — 成功路径中的 `ST.ui.bubble.querySelector` 替换为 `myBubble.querySelector`：
  ```javascript
  // 改前（line 171）
  const actionsEl = ST.ui.bubble.querySelector('.st-bubble-actions');

  // 改后
  const actionsEl = myBubble.querySelector('.st-bubble-actions');
  ```

  ```javascript
  // 改前（line 186）
  const copyBtn = ST.ui.bubble.querySelector('#st-copy-btn');

  // 改后
  const copyBtn = myBubble.querySelector('#st-copy-btn');
  ```

- [x] `content/modules/selection.js` — 成功路径的 error 分支（`response` 无 text 时），替换 `ST.ui.bubble?.querySelector`：
  ```javascript
  // 改前（line 200）
  const actionsEl = ST.ui.bubble?.querySelector('.st-bubble-actions');

  // 改后
  const actionsEl = myBubble.querySelector('.st-bubble-actions');
  ```

- [x] `content/modules/selection.js` — catch 块（当前 line 203-210），加守卫 + 替换引用：
  ```javascript
  // 改前（line 203-210）
  } catch (err) {
      const resultDiv = ST.ui.bubble?.querySelector('.st-bubble-result');
      if (resultDiv) {
          renderBubbleMessage(resultDiv, `请求失败: ${err.message || '未知错误'}`, true);
      }
      const actionsEl = ST.ui.bubble?.querySelector('.st-bubble-actions');
      if (actionsEl) actionsEl.style.display = 'none';
  }

  // 改后
  } catch (err) {
      if (ST.ui.bubble !== myBubble) return;
      const resultDiv = myBubble.querySelector('.st-bubble-result');
      if (resultDiv) {
          renderBubbleMessage(resultDiv, `请求失败: ${err.message || '未知错误'}`, true);
      }
      const actionsEl = myBubble.querySelector('.st-bubble-actions');
      if (actionsEl) actionsEl.style.display = 'none';
  }
  ```

**覆盖矩阵**：

| 场景 | await 前 | await 后守卫 | 结果 |
|------|----------|-------------|------|
| 正常使用（无重选） | bubble-A 创建 | `ST.ui.bubble === myBubble` ✓ | 正常渲染 |
| 重选（bubble-B 替换） | bubble-A 在 await 中 | `ST.ui.bubble !== myBubble` → return | 旧结果被丢弃 |
| 气泡被关闭（mousedown） | bubble-A 在 await 中 | `ST.ui.bubble` 为 null → `!== myBubble` → return | 旧结果被丢弃 |

**不要做的事**：
- 不要改 await 前的代码（DOM 创建、定位逻辑）
- 不要改 `removeBubble()` 的实现
- 不要改 `renderBubbleMessage()` 的实现
- 不要改 `calculateBubblePosition()` 或其他辅助函数
- 不要给 `showBubble` 加取消机制（AbortController 等）— capture + guard 足够
- 不要改 `handleMouseDown` / `handleMouseUp` / `handleDoubleClick`

### 必做

#### B. Offscreen playAudio() 改为单实例 + cancelCurrent

`offscreen.js` 每次 `new Audio()` 不停止旧的，不同按钮/不同面板的 TTS 请求导致多段音频同时播放。

**关键约束**：新请求取消旧音频时，必须 settle 旧 `playAudio()` 的 Promise。否则旧的 `chrome.runtime.sendMessage({action: 'playAudio'})` 永远不返回，045 的 `runSpeak()` 按钮永久禁用。

**Settlement 方式**：用 `resolve()`（而非 `reject()`）。原因：如果 reject 了'Playback interrupted'，这个错误会通过 sendResponse → playAudioViaOffscreen → playAudioFromDataUrl → speak() catch → 触发 `speakSystem()` fallback，导致被打断的文本用系统语音重新播放。`resolve()` 让旧调用静默完成，不触发 error/fallback。

- [x] `offscreen/offscreen.js` — 将整个 `playAudio` 函数（当前 line 15-24）替换为单实例版本：
  ```javascript
  // 改前（line 15-24）
  async function playAudio(dataUrl, speed = 1.0) {
      const audio = new Audio(dataUrl);
      audio.playbackRate = speed;

      return new Promise((resolve, reject) => {
          audio.onended = () => resolve();
          audio.onerror = (e) => reject(new Error('Audio playback failed'));
          audio.play().catch(reject);
      });
  }

  // 改后
  let currentAudio = null;
  let cancelCurrent = null;

  async function playAudio(dataUrl, speed = 1.0) {
      if (cancelCurrent) cancelCurrent();

      const audio = new Audio(dataUrl);
      audio.playbackRate = speed;

      return new Promise((resolve, reject) => {
          currentAudio = audio;
          cancelCurrent = () => {
              audio.pause();
              currentAudio = null;
              cancelCurrent = null;
              resolve();
          };

          audio.onended = () => {
              if (currentAudio === audio) { currentAudio = null; cancelCurrent = null; }
              resolve();
          };
          audio.onerror = () => {
              if (currentAudio === audio) { currentAudio = null; cancelCurrent = null; }
              reject(new Error('Audio playback failed'));
          };
          audio.play().catch((err) => {
              if (currentAudio === audio) { currentAudio = null; cancelCurrent = null; }
              reject(err);
          });
      });
  }
  ```

  行为说明：
  - `cancelCurrent` 封装了 pause + resolve + 引用清理，在新请求到达时调用
  - `onended` / `onerror` / `play().catch` 只在 `currentAudio === audio` 时清理全局引用，防止第三个请求进来时被误清
  - `resolve()` / `reject()` 对已 settled 的 Promise 是 no-op，多次调用安全
  - `currentAudio` 和 `cancelCurrent` 声明在函数外（模块级），与 message listener 同级

**不要做的事**：
- 不要用 `reject(new Error('Playback interrupted'))` — 会触发上层 speak 函数的 system TTS fallback
- 不要改 message listener 的结构（`chrome.runtime.onMessage.addListener`）
- 不要改 `playAudioViaOffscreen()` 或 `tts.js` 中的任何函数
- 不要加 `stopAudio` action — 那是 B2 的范围，留后续轮次
- 不要改 sidebar/float-window/popup 的 speak 函数

## 不做的事

- **不做** B2 系统 TTS 与 offscreen 的双通道互斥 — 需要新增 action，留后续轮次
- **不做** speak 超时保护 — 045 显式推迟
- **不改** speak 按钮 disabled 逻辑 — 045-B 已完成
- **不碰** sidebar.js、float-window.js、popup.js、popup.html、popup.css、content.css、immersive.js、menus.js、content.js、service-worker.js、message-router.js、tts.js、storage.js、translator.js、options.js、options.html、ad-blocker.js、floating-ball.js、manifest.json

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check content/modules/selection.js` 通过
- [x] `node --check offscreen/offscreen.js` 通过
- [x] `git diff --check` 无输出
