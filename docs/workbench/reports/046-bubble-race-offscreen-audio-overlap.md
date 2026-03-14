# 046 — 划词气泡竞态守卫与 Offscreen 单实例音频报告

- 状态: done
- 对应任务: [tasks/046-bubble-race-offscreen-audio-overlap.md](../tasks/046-bubble-race-offscreen-audio-overlap.md)
- 来源讨论: [discussions/046-bubble-race-offscreen-audio-overlap.md](../discussions/046-bubble-race-offscreen-audio-overlap.md)
- 执行日期: 2026-03-13

## 结果概览

本轮完成了 `A/B`：

- `A` 划词气泡的异步翻译现在带本次 bubble 实例守卫，快速重选时旧请求不会再写进新气泡
- `B` offscreen 音频播放现在改成单实例模型，新播放会静默结束旧播放，避免跨按钮/跨面板的远程 TTS 叠播

## 已完成改动

### 46.1 A `showBubble()` 改为 capture + guard

[selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) 的 `showBubble()` 现在在 `document.body.appendChild(ST.ui.bubble)` 后立即 capture：

```javascript
const myBubble = ST.ui.bubble;
```

然后在 `await ST.sendMessage(...)` 返回后先做：

```javascript
if (ST.ui.bubble !== myBubble) return;
```

后续的这些引用也全部改成了从 `myBubble` 取：

- `.st-bubble-result`
- `.st-bubble-actions`
- `#st-copy-btn`

catch 路径也同样加了：

```javascript
if (ST.ui.bubble !== myBubble) return;
```

所以现在：

- 旧请求恢复后不会把结果写进新 bubble
- 旧请求不会错误触发 `addHistory`
- 旧请求不会把复制按钮绑定到错误结果上

本轮没有改：

- bubble 创建前的选择、定位逻辑
- `removeBubble()`
- `renderBubbleMessage()`
- `handleMouseDown / handleMouseUp / handleDoubleClick`

### 46.2 B Offscreen `playAudio()` 改为单实例 + cancelCurrent

[offscreen.js](/Users/xa/Desktop/projiect/zhiyi/offscreen/offscreen.js) 现在新增了两个模块级引用：

- `currentAudio`
- `cancelCurrent`

`playAudio()` 的入口先执行：

```javascript
if (cancelCurrent) cancelCurrent();
```

新的 Promise 创建后，会把当前 audio 注册成单实例，并定义：

```javascript
cancelCurrent = () => {
    audio.pause();
    currentAudio = null;
    cancelCurrent = null;
    resolve();
};
```

这里按 discussion 收敛用了 `resolve()`，不是 `reject()`。原因是：

- 如果 reject 旧播放
- 上层 `chrome.runtime.sendMessage({ action: 'playAudio' })` 会返回错误
- `045` 刚加的 `runSpeak()` / `btnSpeak` guard 所在链路会把它当成失败
- 然后触发不该发生的 fallback 或错误提示

用 `resolve()` 后，旧播放会被静默结束，新播放继续接管。

`onended / onerror / play().catch(...)` 都做了：

```javascript
if (currentAudio === audio) { currentAudio = null; cancelCurrent = null; }
```

避免第三个请求进来后被旧回调误清理全局引用。

本轮没有改：

- message listener 结构
- [tts.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/tts.js) 的 `playAudioViaOffscreen()`
- `sidebar / float-window / popup` 的 `speak()` 逻辑
- `B2` 的系统 TTS / offscreen 双通道互斥

## TDD 记录

本轮按 test-first 执行，先新增了 [bubble-race-offscreen-audio.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/bubble-race-offscreen-audio.test.mjs)。

首次运行：

```bash
node --test tests/bubble-race-offscreen-audio.test.mjs
```

时 2 个子测试都失败，分别覆盖：

- `showBubble()` 还没有 `myBubble` capture 和 `await` 后守卫
- `offscreen.js` 还没有单实例 audio / `cancelCurrent` 模型

补丁完成后目标测试转绿。

## 兼容性测试更新

这轮顺手更新了 [bubble-copy-error-history.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/bubble-copy-error-history.test.mjs)。

原因不是行为变化，而是它原来把 `selection.js` 的错误态与 actions 显示逻辑钉死在全局 `ST.ui.bubble` 结构上。`046` 合法地把 async render 路径改成 `myBubble` guard 后，这条测试需要同步到新结构，真实语义仍然是：

- 成功时恢复 actions
- 失败时隐藏 actions
- 只是这些动作现在都必须在“当前 bubble 仍然是本次实例”前提下发生

## 验证

本轮实际跑过：

```bash
node --test tests/bubble-race-offscreen-audio.test.mjs
node --test tests/*.test.mjs
node --check content/modules/selection.js
node --check offscreen/offscreen.js
git diff --check
```

验证结果：

- [bubble-race-offscreen-audio.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/bubble-race-offscreen-audio.test.mjs)：2/2 通过
- `node --test tests/*.test.mjs`：167/167 通过
- [selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) `node --check` 通过
- [offscreen.js](/Users/xa/Desktop/projiect/zhiyi/offscreen/offscreen.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- 快速重选文本时，旧翻译不会再短暂写进新气泡
- 快速重选后，bubble 历史写入与复制绑定都只对应最终那次选择
- 在 popup / sidebar / float-window 之间切换远程 TTS 播放时，offscreen 只保留最后一段音频
