# 038 — `ensureOffscreenDocument()` rejected-promise 卫生修复执行报告

- 日期: 2026-03-13
- 状态: 已完成
- 对应任务: [038-offscreen-promise-hygiene.md](../tasks/038-offscreen-promise-hygiene.md)
- 对应讨论: [038-offscreen-promise-and-manifest-cleanup.md](../discussions/038-offscreen-promise-and-manifest-cleanup.md)

## 执行结果

### 已修改

- `background/modules/tts.js`
  - `ensureOffscreenDocument()` 的 `creatingOffscreen` 清理从成功路径赋值改为 `try/finally`
  - `createDocument()` 无论成功还是失败，都会释放 in-flight promise
  - 后续调用会重新走 `getContexts()` 检测，不再卡在旧的 rejected promise 上

- `tests/tts.test.mjs`
  - 新增 `playAudioViaOffscreen retries offscreen creation after the first createDocument failure`
  - 直接通过 `playAudioViaOffscreen()` 复现第一次创建失败、第二次成功的行为，锁住 `ensureOffscreenDocument()` 的重试语义

### 过程说明

- 先补 `tests/tts.test.mjs` 失败测试，复现 offscreen 创建失败后第二次调用仍然拿到旧 rejected promise 的问题
- 首次运行 `node --test tests/tts.test.mjs tests/manifest-static.test.mjs` 时：
  - 第一次 `createDocument()` 抛错后，第二次 `playAudioViaOffscreen()` 仍直接抛同一个 `createDocument failed`
  - 说明 `creatingOffscreen` 没有被释放
- 随后只在 `tts.js` 里把成功路径清理改成 `try/finally`

## 验证

执行了：

```bash
node --test tests/tts.test.mjs tests/manifest-static.test.mjs
node --test tests/google-tts.test.mjs tests/tts.test.mjs tests/manifest-static.test.mjs
node --test tests/*.test.mjs
git diff --check -- background/modules/tts.js manifest.json tests/tts.test.mjs tests/manifest-static.test.mjs docs/workbench/tasks/038-offscreen-promise-hygiene.md docs/workbench/reports/038-offscreen-promise-hygiene.md docs/workbench/tasks/039-manifest-web-accessible-cleanup.md docs/workbench/reports/039-manifest-web-accessible-cleanup.md
```

结果：

- `node --test tests/tts.test.mjs tests/manifest-static.test.mjs`：`2/2` 通过
- `node --test tests/google-tts.test.mjs tests/tts.test.mjs tests/manifest-static.test.mjs`：`3/3` 通过
- `node --test tests/*.test.mjs`：`110/110` 通过
- `git diff --check -- ...`：无输出

## 结论摘要

1. offscreen document 创建失败后，不会再把 service worker 卡进永久坏状态。
2. 后续音频播放请求会重新尝试创建 offscreen document。
3. 现有 Google TTS 行为未受影响。
