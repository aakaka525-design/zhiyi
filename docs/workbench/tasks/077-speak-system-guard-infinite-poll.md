---
status: done
priority: P2
created: 2026-03-14
---

# 077 — `speakSystemWithGuard` / `speakWithGuard` / `playSystemTtsTest` 无限轮询无最大超时

- 来源讨论: [discussions/077-speak-system-guard-infinite-poll.md](../discussions/077-speak-system-guard-infinite-poll.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/077-speak-system-guard-infinite-poll.md](../discussions/077-speak-system-guard-infinite-poll.md)（完整讨论记录 + Codex 审阅）

## 背景

三处系统 TTS helper 使用完全相同的「`onstart/onend/onerror + 无限 setInterval 轮询`」模型，没有任何轮询上限。当 `speechSynthesis.speak()` 静默失败（无可用语音、浏览器节流、后台标签页限制）时，`onstart` 不触发 → 轮询条件永不满足 → `setInterval` 永久运行 → Promise 永不 settle。

受影响的三处：
1. `content/modules/utils.js` — `ST.speakSystemWithGuard` → sidebar/float-window 朗读按钮永久禁用
2. `popup/popup.js` — `speakWithGuard` → popup 朗读按钮永久禁用
3. `options/options.js` — `playSystemTtsTest` → 虽有外层 `withTimeout(15s)` 兜底 UI，但内部 `setInterval` 永不清理（timer 泄漏）

Codex 审阅结论：
- 方向接受：从 helper 源头修，不在调用方包固定超时（与 058-B 拒绝的方案不冲突）
- 范围：三处必须同轮修，不接受半修状态
- 启动超时：可以固定，Codex 接受
- 总超时：不接受固定 120s 硬切 → 本次采用**残余风险接受**策略（启动超时 + 无总超时）

## 超时策略说明

### 只加启动超时，不设总超时

| 层级 | 阈值 | 条件 | 场景 |
|------|------|------|------|
| 启动超时 | 5s（10 次 × 500ms） | `!hasStarted && pollCount >= 10` | TTS 从未启动（无语音、被浏览器阻止） |
| 播放中 | 无硬限 | 依赖 polling 自然捕获 | TTS 已启动，等待正常结束 |

**为什么不设总超时**：
- TTS 启动后，`speaking` 最终会变 `false`（音频播放完毕），polling 自然捕获
- 固定硬限（如 120s）不看文本长度和语速，可能把合法长音频截断成假失败
- 动态推导（`text.length / speed`）增加代码复杂度，收益不大
- 「TTS 启动但 `speaking` 永远卡 `true`」是极端浏览器边界情况，概率极低
- 显式接受为**残余风险**：如果真的发生，用户关闭标签页 / 刷新即可恢复

**启动超时为什么够用**：
- 覆盖主要失败模式的 99%+（静默失败 = 从不启动）
- 5s 内 cancel + reject → `runSpeak` 的 `catch → finally` 正常恢复按钮
- 对 options.js：启动超时在 5s 触发（早于外层 15s），内部 interval 被清理 → 消除 timer 泄漏

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/modules/utils.js` | A：`speakSystemWithGuard` 添加启动超时 |
| `popup/popup.js` | B：`speakWithGuard` 添加启动超时 |
| `options/options.js` | C：`playSystemTtsTest` 添加启动超时 |
| `tests/077-speak-guard-timeout.test.mjs` | D：新回归测试 |
| `tests/063-system-tts-onend-immersive-batch-timeout.test.mjs` | E：可能需要更新正则 |
| `tests/darkmode-hardcode-tts-speak-guard.test.mjs` | E：可能需要更新正则 |
| `tests/065-options-system-tts-test-immersive-progress-race.test.mjs` | E：可能需要更新正则 |
| `tests/sidebar-lang-persist-options-tts-promise.test.mjs` | E：可能需要更新正则 |

## 任务清单

### 必做

#### A. `speakSystemWithGuard` 添加启动超时 — utils.js:202-206

- [x] 在 `setInterval` 回调中添加 `pollCount` 计数和启动超时检查：

  ```javascript
  /* 改前（utils.js:202-206） */
  pollId = setInterval(() => {
      if (hasStarted && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
          settle(resolve);
      }
  }, 500);

  /* 改后 */
  let pollCount = 0;
  pollId = setInterval(() => {
      pollCount++;
      if (hasStarted && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
          settle(resolve);
      } else if (!hasStarted && pollCount >= 10) {
          window.speechSynthesis.cancel();
          settle(() => reject(new Error('系统朗读启动超时')));
      }
  }, 500);
  ```

  行为说明：
  - `let pollCount = 0;` 放在 `setInterval` 之前（`pollId = setInterval(...)` 同级）
  - 每次 poll `pollCount++`
  - 正常路径不变：`hasStarted && !speaking && !pending` → `settle(resolve)`
  - 新增启动超时：`!hasStarted && pollCount >= 10`（5 秒）→ `cancel()` + `reject`
  - `speechSynthesis.cancel()`：超时时主动清理，避免遗留状态干扰后续调用
  - 不设总超时：TTS 启动后依赖 polling 自然捕获完成，无硬限
  - **不改任何调用方**：sidebar.js / float-window.js 的 `runSpeak` 完全不动

#### B. popup `speakWithGuard` 添加启动超时 — popup.js:466-470

- [x] 与 A 完全同构：

  ```javascript
  /* 改前（popup.js:466-470） */
  pollId = setInterval(() => {
      if (hasStarted && !speechSynthesis.speaking && !speechSynthesis.pending) {
          settle(resolve);
      }
  }, 500);

  /* 改后 */
  let pollCount = 0;
  pollId = setInterval(() => {
      pollCount++;
      if (hasStarted && !speechSynthesis.speaking && !speechSynthesis.pending) {
          settle(resolve);
      } else if (!hasStarted && pollCount >= 10) {
          speechSynthesis.cancel();
          settle(() => reject(new Error('系统朗读启动超时')));
      }
  }, 500);
  ```

  行为说明：
  - 与 A 完全同构，注意 popup 不带 `window.` 前缀（`speechSynthesis` 而非 `window.speechSynthesis`）
  - 超时后 reject → popup `speak` 函数的 `catch` 调用 `showToast(err.message)` → 用户看到「系统朗读启动超时」提示
  - `elements.btnSpeak.disabled = false` 在 `finally` 中恢复

#### C. options `playSystemTtsTest` 添加启动超时 — options.js:398-402

- [x] 与 A/B 完全同构：

  ```javascript
  /* 改前（options.js:398-402） */
  pollId = setInterval(() => {
      if (hasStarted && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
          settle(resolve);
      }
  }, 500);

  /* 改后 */
  let pollCount = 0;
  pollId = setInterval(() => {
      pollCount++;
      if (hasStarted && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
          settle(resolve);
      } else if (!hasStarted && pollCount >= 10) {
          window.speechSynthesis.cancel();
          settle(() => reject(new Error('系统朗读启动超时')));
      }
  }, 500);
  ```

  行为说明：
  - 与 A 完全同构（带 `window.` 前缀）
  - 修复 timer 泄漏：启动超时在 5s 触发（早于外层 `withTimeout(15s)`），`settle()` 调用 `clearInterval` 清理 interval
  - 外层 `withTimeout(15s)` 仍保留不动 — 它是 UI 级兜底，不需要修改
  - 测试文本固定为「测试语音播放」（6 字符），正常情况下 1-2s 内完成

#### D. 新回归测试

- [x] 新建 `tests/077-speak-guard-timeout.test.mjs`，至少覆盖：
  1. **A — utils `speakSystemWithGuard` 包含 `pollCount` 和启动超时检查**：静态断言 utils.js 包含 `pollCount` 变量和 `!hasStarted && pollCount >= 10` 分支
  2. **A — 超时时调用 `speechSynthesis.cancel()`**：静态断言 utils.js 在启动超时分支中调用 `window.speechSynthesis.cancel()`
  3. **A — 超时时 reject 而非 resolve**：静态断言 utils.js 在启动超时分支中调用 `settle(() => reject(...))`
  4. **B — popup `speakWithGuard` 包含 `pollCount` 和启动超时检查**：静态断言 popup.js 包含相同结构
  5. **C — options `playSystemTtsTest` 包含 `pollCount` 和启动超时检查**：静态断言 options.js 包含相同结构
  6. **三处结构一致**：断言三个函数都包含 `let pollCount = 0` 和 `pollCount >= 10`
  7. **原有功能不变**：断言 `hasStarted && !speaking && !pending` → `settle(resolve)` 路径仍存在

#### E. 现有测试兼容性

- [x] 修改完 A/B/C 后运行 `node --test tests/*.test.mjs`，如果以下测试因正则不匹配而失败，需要更新它们的正则以兼容新增的 `pollCount` / `else if` 分支：
  - `tests/063-system-tts-onend-immersive-batch-timeout.test.mjs`
  - `tests/darkmode-hardcode-tts-speak-guard.test.mjs`
  - `tests/065-options-system-tts-test-immersive-progress-race.test.mjs`
  - `tests/sidebar-lang-persist-options-tts-promise.test.mjs`

  更新原则：
  - 保留原有断言意图（验证 `hasStarted` polling guard 存在）
  - 在已有正则中使用 `[\s\S]*` 或放宽 `\s*` 来跳过新增代码
  - 不删除原有断言，只扩展正则兼容范围
  - 如果原有正则已经足够宽松（使用 `[\s\S]*` 跳过中间代码），则不需要改

**不要做的事**：
- 不要修改 sidebar.js / float-window.js / content.js — 不改调用方
- 不要修改 `runSpeak` 函数 — 058-B 被拒方案就是改调用方
- 不要添加总超时硬限（120s 或任何固定值）— Codex 明确拒绝
- 不要基于文本长度推导动态总超时 — 复杂度高收益低，本轮采用残余风险接受
- 不要修改 options.js 的外层 `withTimeout(15s)` — 它是 UI 级兜底，保持不动
- 不要合并三处 helper 为一个共享函数 — 代码复用重构不属于本轮
- 不要添加 TTS 取消按钮 — 功能需求，非本轮范围
- 不要修改 API TTS 超时 — 060 已添加 15s sendMessage 超时，够用
- 不要碰 immersive.js、content.js、sidebar.js、float-window.js、selection.js、content.css、popup.css、popup.html、options.html、floating-ball.js、ad-blocker.js、storage.js、translator.js、message-router.js、tts.js、service-worker.js、offscreen.js、manifest.json、menus.js

## 不做的事

- **不做** 修改调用方 `runSpeak`
- **不做** 添加总超时硬限
- **不做** 合并三处 helper 为共享函数
- **不做** 修改外层 `withTimeout`

## 验证要求

- [x] `node --test tests/077-speak-guard-timeout.test.mjs` 通过
- [x] `node --test tests/*.test.mjs` 全部通过（含受影响的现有测试）
- [x] `node --check content/modules/utils.js` 通过
- [x] `node --check popup/popup.js` 通过
- [x] `node --check options/options.js` 通过
- [x] `git diff --check` 无输出
