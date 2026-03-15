---
report: "081"
created: 2026-03-14
status: fixed
---

# 081 — Discord Observer `<li>` 泄露消息元数据到翻译结果

## 问题

Discord 沉浸式翻译结果包含用户名、时间戳、徽章等元数据。根因：Observer Discord 路径同时收集 `[id^="message-content-"]` 和通用选择器（含 `<li>`）。Discord 用 `<li>` 包裹整个消息行（含元数据），`filterContainedImmersiveElements` 保留外层 `<li>` 丢弃内层消息内容元素 → 翻译整行 `innerText`。

## 修复

Discord Observer 通用选择器中移除 `li`，保留 `p, h1-h6, td, th, blockquote, figcaption, dt, dd, caption`。`<li>` 在 Discord 是消息容器，不应翻译；嵌入内容的 `<p>/<blockquote>` 仍保留。

## 验证

- `node --check content/modules/immersive.js` ✅
- `node --test tests/*.test.mjs` — 276/276 通过 ✅
