---
status: done
priority: P3
created: 2026-03-13
discussion: 030-offscreen-promise-and-manifest-cleanup
---

# 030 — `ensureOffscreenDocument()` rejected-promise 卫生修复

## 背景

030 讨论确认：`tts.js` 的 `ensureOffscreenDocument()` 与 028 的 `ensureReady()` 同类问题 — `createDocument()` 失败后 `creatingOffscreen` 保留 rejected promise，后续所有 TTS 音频播放永久失败。

影响范围：sidebar / float-window / popup 有 system TTS fallback（用户仍能听到声音），但 options 页 TTS 测试不会 fallback，直接报错。

---

## 任务 A：`try/finally` 清理 `creatingOffscreen`

**文件**：`background/modules/tts.js:27-34`

**当前**：

```javascript
creatingOffscreen = chrome.offscreen.createDocument({
    url: offscreenUrl,
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Playing TTS audio for translation extension'
});

await creatingOffscreen;
creatingOffscreen = null;
```

**修复**：

```javascript
creatingOffscreen = chrome.offscreen.createDocument({
    url: offscreenUrl,
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Playing TTS audio for translation extension'
});

try {
    await creatingOffscreen;
} finally {
    creatingOffscreen = null;
}
```

注意：
- 使用 `try/finally` 而非 `catch` — 这里没有半初始化对象需要清理（与 028 不同）
- offscreen 是否已创建靠 `getContexts()` 检测，`creatingOffscreen` 只是 in-flight 守卫
- 无论成功失败都释放 promise，下次调用重新通过 `getContexts()` 判断

---

## 任务 B：补测试

**文件**：`tests/tts.test.mjs`（新建或追加）

### B1. `ensureOffscreenDocument` 创建失败后可重试

```javascript
// mock chrome.offscreen.createDocument 第一次 reject
// 调用 ensureOffscreenDocument() → 应该抛错
// mock chrome.offscreen.createDocument 第二次成功
// 再调用 ensureOffscreenDocument() → 应该成功（不再 await 旧的 rejected promise）
```

---

## 不做的事

- 不改 `handleTTSOpenAI` / `handleTTSGoogle` / `handleTTSGLM` 的逻辑
- 不给 options 页 TTS 测试加 system fallback（那是另一个话题）
- 不碰 manifest.json（独立 task 031）
- 不碰 service-worker / translator / content script

---

## 验收标准

- [x] `ensureOffscreenDocument()` 使用 `try/finally` 清理 `creatingOffscreen`
- [x] 创建失败后 `creatingOffscreen` 回到 `null`，下次调用可重试
- [x] 测试覆盖失败后重试场景
- [x] 现有 TTS 测试（如有）不受影响
