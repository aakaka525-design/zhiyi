---
status: done
priority: P2
created: 2026-03-13
discussion: 033-history-gap-and-batch-error
---

# 033 — Sidebar 翻译历史写入缺口修复

## 背景

033 讨论经 Codex 复核后收敛。Sidebar 有历史 UI 和 `refreshSidebarHistory()` 刷新逻辑，但翻译成功后无法写入历史，因为 message-router 缺少 `addHistory` action。

本 task 只修 sidebar。float-window 和 selection 本轮不做。

---

## 任务 A：message-router 新增 `addHistory` action

**文件**：`background/modules/message-router.js`

在 `switch (request.action)` 中新增：

```javascript
case 'addHistory':
    return storage.addHistory(request.item);
```

`StorageManager.addHistory()` 已存在（`storage.js:127`），接受 `{ source, target, sourceLang, targetLang, provider }` 对象，返回含 `id` 和 `timestamp` 的完整记录。

---

## 任务 B：Sidebar 翻译成功后调用 `addHistory`

**文件**：`content/modules/sidebar.js`

**当前**（line 276-283）：

```javascript
if (response && response.text) {
    resultCard.classList.add('active');
    resultContent.innerText = response.text;
    resultContent.style.color = '';
    resultLang.innerText = `翻译结果 (${targetLangSelect.value})`;
    // 刷新历史记录
    setTimeout(() => ST.refreshSidebarHistory(), 500);
}
```

**修复**：在 `resultLang.innerText = ...` 之后、`setTimeout` 之前加入：

```javascript
ST.sendMessage({
    action: 'addHistory',
    item: {
        source: text,
        target: response.text,
        sourceLang: sourceLangSelect.value,
        targetLang: targetLangSelect.value,
        provider: response.provider || ''
    }
});
```

注意：
- `response.provider` 由 `translator.translate()` 返回，message-router 的 `translate` case 会将完整返回对象传回
- `addHistory` 不需要 await（历史写入不阻塞 UI）
- `refreshSidebarHistory()` 的 500ms 延迟足够让 addHistory 先完成写入

---

## 任务 C：补测试

### C1. message-router 测试

**文件**：`tests/message-router.test.mjs`（或已有测试文件中追加）

验证 `addHistory` action：
- 发送 `{ action: 'addHistory', item: { source: 'hello', target: '你好', sourceLang: 'en', targetLang: 'zh', provider: 'google' } }`
- 断言返回对象包含 `id` 和 `timestamp`
- 断言 `getHistory` 能读到刚写入的记录

### C2. docs/reference/architecture.md Action 清单同步

将 `addHistory` 加入消息 Action 清单表：

| Action | 来源 | 目标模块 | 说明 |
|--------|------|----------|------|
| `addHistory` | Sidebar | `src/core/storage.js` | 写入翻译历史 |

---

## 不做的事

- 不改 popup 的 addHistory 逻辑（它直接调用 StorageManager，工作正常）
- 不给 float-window 加历史写入（无代码证据表明应该入历史）
- 不给 selection 气泡加历史写入（临时 UI，噪音大）
- 不改 `translate` action 的副作用语义
- 不碰 CSS / TTS / immersive

## 验收标准

- [x] message-router 新增 `addHistory` action，调用 `storage.addHistory()`
- [x] sidebar 翻译成功后通过 `ST.sendMessage` 调用 `addHistory`
- [x] sidebar 翻译后 `refreshSidebarHistory()` 能看到刚完成的翻译
- [x] message-router 测试覆盖 `addHistory` action
- [x] architecture.md Action 清单包含 `addHistory`
