---
status: done
task: 082-immersive-telegram-support
date: 2026-03-14
---

# 082 — 沉浸式翻译支持 Telegram Web

## 完成结果

已完成 Telegram Web K 的沉浸式翻译专用路径，范围与 task 收窄版本一致：

- 在 [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 增加 `web.telegram.org` hostname 检测
- 初始扫描在 Discord 之后、generic fallback 之前增加 `.translatable-message` 专用路径
- Observer 在 Discord 分支之后增加 `.translatable-message` 专用收集
- Observer 过滤链对 Telegram `.translatable-message` 使用独立最小门槛 `2`，不修改 `getImmersiveMinLength(...)`
- 新增回归测试 [082-immersive-telegram.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/082-immersive-telegram.test.mjs)

## 实际修改文件

- [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js)
- [082-immersive-telegram.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/082-immersive-telegram.test.mjs)
- [observer-toast.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/observer-toast.test.mjs)

## 说明

- `observer-toast.test.mjs` 的更新只用于接受 `082` 合法新增的 Telegram observer 门槛分支，不改变原有行为断言目标。
- `082-immersive-telegram.test.mjs` 在红测阶段暴露了 test harness 的 `nodeType` 缺失；已在测试节点 stub 中补齐，生产代码未因此扩大修改范围。

## 验证

- `node --test tests/082-immersive-telegram.test.mjs`
- `node --test tests/*.test.mjs`
- `node --check content/modules/immersive.js`
- `git diff --check`

结果：

- Telegram 专项测试 `6/6`
- 全量测试 `282/282`
- 语法检查通过
- diff 检查无输出

## 残留风险

- 只覆盖 Telegram Web K，且只使用已验证的 `.translatable-message`
- 非聊天页仍依赖 “Telegram selector 为空时 fall through 到 generic 路径” 的约束
- 未做真实 Chrome/Telegram Web 手测
