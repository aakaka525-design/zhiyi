---
status: done
priority: P1
created: 2026-03-14
---

# 081 — Discord Observer `<li>` 泄露消息元数据到翻译结果

- 来源讨论: [discussions/081-discord-observer-li-metadata-leak.md](../discussions/081-discord-observer-li-metadata-leak.md)

## 背景

Discord 沉浸式翻译排版异常：翻译结果包含用户名、时间戳、徽章等元数据。根因：Observer Discord 路径的通用选择器包含 `li`，Discord 用 `<li>` 作消息行容器（含元数据），与 `[id^="message-content-"]` 冲突后 `filterContainedImmersiveElements` 保留外层 `<li>` → 翻译整行 innerText。

## 涉及文件

| 文件 | 改动 |
|------|------|
| `content/modules/immersive.js:303-316` | Discord Observer 通用选择器移除 `li` |

## 任务清单

- [x] Discord Observer 通用选择器从 `p, h1-h6, li, td, th, blockquote, figcaption, dt, dd, caption` 中移除 `li`

## 验证要求

- [x] `node --check content/modules/immersive.js` 通过
- [x] `node --test tests/*.test.mjs` — 276/276 全部通过
