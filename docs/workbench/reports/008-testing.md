# 008 — 最小可行测试基础设施报告

- 状态: done
- 对应任务: [tasks/008-testing.md](../tasks/008-testing.md)
- 来源讨论: [discussions/008-testing.md](../discussions/008-testing.md)
- 执行日期: 2026-03-10

## 结果概览

本轮完成了 `008-testing` 的最小测试基础设施：

- 新增 [chrome-stub.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/helpers/chrome-stub.mjs)
- 新增 [storage.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/storage.test.mjs)
- 新增 [translator.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/translator.test.mjs)
- 采用 Node 内置 `node:test`，不引入 `package.json`、Jest 或 Vitest

执行中还额外发现并修复了 1 个真实源代码问题：

- [translator.js](/Users/xa/Desktop/projiect/zhiyi/src/core/translator.js) 的 `detectLanguage()` 原本命中韩文正则后不会返回 `ko`，导致韩文文本回退成 `'en'`

## 已完成内容

### 8.1 Chrome Stub

- [chrome-stub.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/helpers/chrome-stub.mjs) 提供了内存版 `globalThis.chrome`
- 已支持：
  - `chrome.storage.local.get`
  - `chrome.storage.local.set`
  - `chrome.storage.local.remove`
  - `reset()`
- `get()` 同时兼容了字符串 key、数组 key、对象默认值和空参数，虽然当前 `storage.js` 主要只依赖字符串 key

### 8.2 storage.js 测试

[storage.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/storage.test.mjs) 当前覆盖了 10 个用例：

- `getSettings()` 默认值完整性
- legacy key 清理
- `ttsProvider` 的 edge/fish → system 迁移
- 设置合并
- `updateSettings()` 不静默回写新默认 key
- History 的 prepend / dedupe / 裁剪 / 删除 / 清空
- Favorites 的去重 / 裁剪 / 删除 / 命中判断

执行中按讨论约定，没有去断言 `Date.now()` 生成的精确值；只对顺序、数量、去重和业务字段做断言。

### 8.3 translator.js 测试

[translator.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/translator.test.mjs) 当前覆盖了 13 个用例：

- provider 默认选择与显式覆盖
- 未知 provider 抛错
- openai / gemini / deepseek 无 key 时回退 Google
- 主 provider 失败回退 Google
- Google 失败回退 offline
- offline 失败时返回 Google 原始错误
- 显式选择 offline 失败时直接抛错
- `detectLanguage()` 的 zh / ja / ko / en 判定
- `translateBatch()` 的批量分发与逐条回退

测试方式是直接 import 真实 [Translator](/Users/xa/Desktop/projiect/zhiyi/src/core/translator.js)，不调 `init()`，通过注入 `settings` 和 fake `providers` 只测编排逻辑。

## 执行中发现的真实问题

`translator.test.mjs` 首次运行时，韩文检测用例失败：

- 期望：`'ko'`
- 实际：`'en'`

根因在 [translator.js](/Users/xa/Desktop/projiect/zhiyi/src/core/translator.js)：

- `detectLanguage()` 命中韩文正则后，没有进入任何返回分支

本轮做了最小修复：

- 给韩文分支补上 `lang === 'ko'` 返回条件

这是 008 唯一一处 `src/` 修改，而且是测试真实揭露的逻辑缺陷，不是为了让测试“配合实现”。

## 验证

实际跑过的验证命令：

```bash
node --test tests/storage.test.mjs
node --test tests/translator.test.mjs
node --test tests/*.test.mjs
node --check src/core/translator.js
node --check tests/helpers/chrome-stub.mjs
node --check tests/storage.test.mjs
node --check tests/translator.test.mjs
git diff --check
```

验证结果：

- `tests/storage.test.mjs`：10/10 通过
- `tests/translator.test.mjs`：13/13 通过
- `node --test tests/*.test.mjs`：23/23 通过
- 所有新增/修改文件 `node --check` 通过
- `git diff --check` 无输出

## 未做项

- 没有纳入 Service Worker 测试；这仍留给后续 `009`
- 没有为内容脚本 DOM 行为建立自动化测试
- 没有引入覆盖率统计或 CI 集成
