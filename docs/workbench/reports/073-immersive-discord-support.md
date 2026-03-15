# 073 — 沉浸式翻译 Discord 聊天内容支持报告

- 状态: done
- 对应任务: [tasks/073-immersive-discord-support.md](../tasks/073-immersive-discord-support.md)
- 来源讨论: [discussions/073-immersive-discord-support.md](../discussions/073-immersive-discord-support.md)
- 执行日期: 2026-03-14

## 结果概览

本轮按收窄后的边界完成了 `A1 + A2 + A3 + A4 + A5`：

- [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 新增了严格的 `isDiscord` host 判断，只匹配 `discord.com`、`ptb.discord.com`、`canary.discord.com`。
- 同一文件的 `getImmersiveMinLength(el, isTwitter)` 现在把 Discord 消息节点 `[id^="message-content-"]` 纳入 `2` 字门槛。
- 初始扫描和 observer 都新增了 Discord 专用收集路径，但保留了 generic fallback；Discord 非聊天页和 `support.discord.com` 仍会回退到通用逻辑。
- 新增了 [073-immersive-discord.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/073-immersive-discord.test.mjs)，并同步更新了 [observer-toast.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/observer-toast.test.mjs) 的旧静态断言以接受 `073` 的合法 helper 变化。

## 已完成改动

### 73.1 严格 Discord host 判断，不再用 `includes`

[immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 没有采用 `hostname.includes('discord.com')`，而是收口为：

```javascript
const isDiscord = window.location.hostname === 'discord.com' ||
    window.location.hostname === 'ptb.discord.com' ||
    window.location.hostname === 'canary.discord.com';
```

这样：

- `discord.com/channels/...` 会命中 Discord 路径
- `ptb.discord.com` / `canary.discord.com` 聊天应用也会命中
- `support.discord.com` / 其他子域不会误走 Discord 专用路径

### 73.2 Discord 消息节点共享短文本门槛

`getImmersiveMinLength(el, isTwitter)` 现在把 `[id^="message-content-"]` 并入低门槛分支：

```javascript
if (el.matches('[id^="message-content-"], h1, h2, h3, h4, h5, h6, li, td, th')) return 2;
```

这保证了：

- Discord 消息不会继续被通用 `20` 字门槛错误过滤
- 初始扫描和 observer 仍复用同一 helper，没有引入第二套门槛逻辑

### 73.3 Discord 路径优先，generic 路径兜底

初始扫描现在是：

1. Twitter 专用路径优先
2. Discord host 上优先尝试 `[id^="message-content-"]`
3. 如果 Discord 路径没找到消息节点，再回退到现有 generic selectors

这使得：

- Discord 聊天页优先翻译聊天消息内容
- Discord 营销页 / 下载页如果没有消息节点，仍按普通页面段落翻译
- 非 Discord 站点行为保持不变

### 73.4 Observer 也补齐了 Discord 收集路径

observer 不只修了初始扫描。它现在在 Discord host 上会：

- 收集直接新增的 `[id^="message-content-"]` 节点
- 收集新增节点内部的 `[id^="message-content-"]` 后代
- 同时补收 generic fallback 元素，覆盖 Discord 非聊天页的动态内容

过滤链仍复用现有逻辑：

- `isContentEditable`
- `getImmersiveMinLength(...)`
- `ST.detectLanguage(text) === targetLang`
- `.st-immersive-translation` 去重

### 73.5 测试先红后绿，并同步了 1 条旧静态断言

本轮先新增了 [073-immersive-discord.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/073-immersive-discord.test.mjs)，首次运行时 6 条子测试都按预期失败，暴露出：

- 没有严格 Discord host 判断
- Discord 消息节点仍走 `20` 字门槛
- 初始扫描没有 Discord 专用路径
- observer 不会收集直接新增的 Discord 消息节点

补上实现后，专项测试转绿。随后全量回归里打出 1 条旧静态断言失败：

- [observer-toast.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/observer-toast.test.mjs)

原因不是行为回归，而是这条测试还锁着 `073` 之前的 helper 正则；本轮已同步到新的 `[id^="message-content-"]` 结构。

## 验证

本轮实际 fresh 跑过：

```bash
node --test tests/073-immersive-discord.test.mjs
node --test tests/*.test.mjs
node --check content/modules/immersive.js
git diff --check
```

验证结果：

- [073-immersive-discord.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/073-immersive-discord.test.mjs)：6/6 通过
- `node --test tests/*.test.mjs`：244/244 通过
- `node --check content/modules/immersive.js`：通过
- `git diff --check`：无输出

## Residual Risk

这轮刻意没有做两件事：

- 没有把 Discord host 再进一步收窄到 `/channels` 路径；当前依赖的是“Discord selector 命中时走专用路径，未命中时自动 fallback”
- 没有改注入样式或消息节点更细粒度的内容切分

因此仍保留一个已知残余：

- Discord 页面上如果 DOM 结构未来改变，不再使用 `[id^="message-content-"]`，本轮专用路径会失效，但 generic fallback 仍在

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- `discord.com/channels/...` 中聊天消息会进入沉浸式翻译
- Discord 非聊天页在没有消息节点时会回退到通用段落翻译
- `support.discord.com` 继续走通用路径，不会误触 Discord 专用逻辑
- 动态新增的 Discord 消息在 observer 路径下也能被拾取
