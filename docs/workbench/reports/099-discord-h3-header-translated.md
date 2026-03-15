---
report: "099"
status: done
created: 2026-03-15
---

# 099 — Discord 消息头部 h3 被翻译

## 变更摘要

新增 `DISCORD_CHAT_GENERIC_SELECTORS`（去掉 h1/h2/h3），在 `/channels` 路径下的 observer 和 rescan 使用。非聊天页保留完整 `DISCORD_GENERIC_SELECTORS`。

## 改动文件

| 文件 | 改动 |
|------|------|
| `content/modules/immersive.js` | 新增常量 + isDiscordChat + 选择器分支 |
| `tests/099-discord-h3-header.test.mjs` | 静态断言 |

## 验证

- `/opt/homebrew/bin/node --test tests/099-discord-h3-header.test.mjs tests/073-immersive-discord.test.mjs`：`10/10`
- `/opt/homebrew/bin/node --test tests/*.test.mjs`：`343/343`
- `git diff --check`：无输出

## 备注

- 这轮只收窄 Discord `/channels` 聊天页的 generic fallback
- `DISCORD_GENERIC_SELECTORS` 原值保留，非聊天 Discord 页面不受影响
- 真实 Discord Web 手测仍未执行
