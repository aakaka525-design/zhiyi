---
status: done
priority: P2
created: 2026-03-14
---

# 065 — Options 系统 TTS 测试缺 Chromium onend 保护 & 沉浸式进度条快速切换竞态

- 来源讨论: [discussions/065-options-system-tts-test-immersive-progress-race.md](../discussions/065-options-system-tts-test-immersive-progress-race.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/065-options-system-tts-test-immersive-progress-race.md](../discussions/065-options-system-tts-test-immersive-progress-race.md)（完整讨论记录 + Codex 审阅）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `options/options.js` | A：`playSystemTtsTest` 加 polling workaround + 调用处加 `withTimeout` |
| `content/modules/immersive.js` | B1：`hideProgress` 调用加 `runId` 守卫 |
| `content/modules/utils.js` | B2：`showProgress`/`hideProgress` 存储并清除定时器 ID |
| `tests/065-options-system-tts-test-immersive-progress-race.test.mjs` | 回归测试 |

## 任务清单

### 必做

#### A. options `playSystemTtsTest` 加 Chromium onend polling workaround + 调用处加 `withTimeout`

- [x] `options/options.js:377-387` — 重写 `playSystemTtsTest`，复用 063 已验证的 `hasStarted + speaking/pending poll` 模式：
  ```javascript
  // 改前（line 377-387）
  function playSystemTtsTest(text, speed) {
      return new Promise((resolve, reject) => {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'zh-CN';
          utterance.rate = speed;
          utterance.onend = () => resolve();
          utterance.onerror = (e) => reject(new Error(e.error || '播放失败'));
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
      });
  }

  // 改后
  function playSystemTtsTest(text, speed) {
      return new Promise((resolve, reject) => {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'zh-CN';
          utterance.rate = speed;

          let settled = false;
          let hasStarted = false;
          let pollId = null;

          const settle = (fn) => {
              if (settled) return;
              settled = true;
              if (pollId) clearInterval(pollId);
              fn();
          };

          utterance.onstart = () => { hasStarted = true; };
          utterance.onend = () => settle(resolve);
          utterance.onerror = (e) => settle(() => reject(new Error(e.error || '播放失败')));

          pollId = setInterval(() => {
              if (hasStarted && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
                  settle(resolve);
              }
          }, 500);

          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
      });
  }
  ```

- [x] `options/options.js:342-347` — 调用处加 `withTimeout`（15000ms，与 API TTS 行 350 保持一致）：
  ```javascript
  // 改前（line 342-347）
  if (provider === 'system') {
      statusEl.textContent = '播放中...';
      await playSystemTtsTest(testText, speed);
      statusEl.textContent = '✓ 播放完成';
      statusEl.classList.add('success');
      return;
  }

  // 改后
  if (provider === 'system') {
      statusEl.textContent = '播放中...';
      await withTimeout(playSystemTtsTest(testText, speed), 15000, '系统语音播放超时');
      statusEl.textContent = '✓ 播放完成';
      statusEl.classList.add('success');
      return;
  }
  ```

  行为说明：
  - **正常情况**（onend 正常触发）：与之前完全相同
  - **Chromium onend bug 触发**：polling 检测到 `hasStarted && !speaking && !pending` → `settle(resolve)` → 正常完成
  - **极端情况**（polling 也不触发）：15s 后 `withTimeout` reject → `catch` 显示"✗ 系统语音播放超时" → `finally` 恢复按钮
  - 不在 `playSystemTtsTest` 内部加超时 — 外层 `withTimeout` 已覆盖，内部只负责正确 settle

#### B1. immersive.js `hideProgress` 调用加 `runId` 守卫

- [x] `content/modules/immersive.js:144` — 加 `runId` 守卫：
  ```javascript
  // 改前（line 144）
      ST.hideProgress();

  // 改后
      if (ST.state.immersiveRunId === myRunId) {
          ST.hideProgress();
      }
  ```

  行为说明：
  - **正常完成**（runId 匹配）：与之前相同，翻译完成后隐藏进度条
  - **用户 OFF**（runId 匹配、isImmersiveEnabled=false）：正确隐藏进度条
  - **快速 ON→OFF→ON**（runId 不匹配）：跳过 hideProgress，新循环管理进度条

#### B2. utils.js `showProgress`/`hideProgress` 存储并清除定时器 ID

- [x] `content/modules/utils.js:140-166` — 加模块级定时器变量，`showProgress` 清除挂起定时器，`hideProgress` 存储定时器 ID：
  ```javascript
  // 改前（line 140-166）
  /**
   * 进度条控制
   */
  ST.showProgress = function () {
      if (!ST.ui.progress) {
          ST.ui.progress = document.createElement('div');
          ST.ui.progress.id = 'st-page-progress';
          document.body.appendChild(ST.ui.progress);
      }
      ST.ui.progress.style.width = '0%';
      ST.ui.progress.style.display = 'block';
  };

  ST.updateProgress = function (percent) {
      if (ST.ui.progress) {
          ST.ui.progress.style.width = `${percent}%`;
      }
  };

  ST.hideProgress = function () {
      if (ST.ui.progress) {
          ST.ui.progress.style.width = '100%';
          setTimeout(() => {
              ST.ui.progress.style.display = 'none';
          }, 500);
      }
  };

  // 改后
  /**
   * 进度条控制
   */
  let _hideProgressTimerId = null;

  ST.showProgress = function () {
      if (_hideProgressTimerId) {
          clearTimeout(_hideProgressTimerId);
          _hideProgressTimerId = null;
      }
      if (!ST.ui.progress) {
          ST.ui.progress = document.createElement('div');
          ST.ui.progress.id = 'st-page-progress';
          document.body.appendChild(ST.ui.progress);
      }
      ST.ui.progress.style.width = '0%';
      ST.ui.progress.style.display = 'block';
  };

  ST.updateProgress = function (percent) {
      if (ST.ui.progress) {
          ST.ui.progress.style.width = `${percent}%`;
      }
  };

  ST.hideProgress = function () {
      if (ST.ui.progress) {
          ST.ui.progress.style.width = '100%';
          _hideProgressTimerId = setTimeout(() => {
              ST.ui.progress.style.display = 'none';
              _hideProgressTimerId = null;
          }, 500);
      }
  };
  ```

  行为说明：
  - **正常场景**：与之前完全相同
  - **快速切换**：如果旧 hideProgress 的 500ms 定时器还挂着，新 showProgress 会先 `clearTimeout` 再显示 — 进度条不会被旧定时器意外隐藏
  - B1 + B2 配套：B1 阻止旧循环调用 hideProgress，B2 兜底即使 hideProgress 被调用后又立即 showProgress 也不会被旧定时器覆盖

#### C. 回归测试

- [x] 新建 `tests/065-options-system-tts-test-immersive-progress-race.test.mjs`，至少覆盖：
  1. **A — playSystemTtsTest 使用 polling 模式**：options.js 的 `playSystemTtsTest` 包含 `onstart`、`setInterval`、`hasStarted`、`settle` 模式（非旧 `onend` 直接 resolve）
  2. **A — 调用处有 withTimeout**：`testTTS` 的 system 分支使用 `withTimeout(playSystemTtsTest(...), 15000, ...)` 调用
  3. **B1 — hideProgress 有 runId 守卫**：immersive.js 中 `hideProgress` 调用被 `immersiveRunId === myRunId` 守卫包裹
  4. **B2 — showProgress 清除 hideProgress 定时器**：utils.js 的 `showProgress` 调用 `clearTimeout`，`hideProgress` 将 setTimeout 返回值赋给变量

**不要做的事**：
- 不要在 `playSystemTtsTest` 内部加超时 — 外层 `withTimeout` 已覆盖
- 不要改 `utterance.lang` 为动态读取 — 测试文本固定中文，`zh-CN` 合理
- 不要改 sidebar/float-window 的 `runSpeak` — 063 的 `speakSystemWithGuard` 已覆盖
- 不要改 immersive.js 的 OFF 路径（line 19-25）加 hideProgress — 旧循环 break 后自然到达
- 不要碰 content.js、sidebar.js、float-window.js、tts.js、selection.js、popup.js、floating-ball.js、ad-blocker.js、storage.js、translator.js、message-router.js、service-worker.js、manifest.json、menus.js、offscreen.js、state.js

## 不做的事

- **不做** `playSystemTtsTest` 内部超时 — Codex 明确：外层 `withTimeout` 已够，内部只负责 settle
- **不做** `utterance.lang` 动态化 — Codex 确认保持 `zh-CN`
- **不做** sidebar/float-window `runSpeak` 超时 — 063 的 polling workaround 已覆盖
- **不做** B1 单独不做 B2 — Codex 明确：B2 不是可选，而是与 B1 配套的必做防御

## 验证要求

- [x] `node --test tests/065-options-system-tts-test-immersive-progress-race.test.mjs` 通过
- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check options/options.js` 通过
- [x] `node --check content/modules/immersive.js` 通过
- [x] `node --check content/modules/utils.js` 通过
- [x] `git diff --check` 无输出
