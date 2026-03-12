---
status: done
priority: P1
created: 2026-03-10
---

# 008 — 最小可行测试基础设施

## 背景

001-007 的所有修改都只靠 `node --check` 和静态扫描验证。项目零测试覆盖，每次修改存在回归风险。本任务建立最小可行的自动化测试，覆盖修改最频繁、回归风险最高的两个模块。

## 相关讨论

- 方案讨论: [discussions/008-testing.md](../discussions/008-testing.md)
- 测试范围来源: [discussions/006-cleanup.md](../discussions/006-cleanup.md)（B1/B2/B3 MVP 讨论）

## 技术栈

- **测试框架**: Node 内置 `node:test` + `node:assert`（零依赖）
- **运行命令**: `node --test tests/*.test.mjs`
- **不引入**: Jest、Vitest、package.json、构建工具

## 产出文件

```
tests/
├── helpers/
│   └── chrome-stub.mjs
├── storage.test.mjs
└── translator.test.mjs
```

## 任务清单

### 8.1 Chrome API Stub

- [x] 创建 `tests/helpers/chrome-stub.mjs`
- [x] 实现内存版 `chrome.storage.local`：`get(key)`、`set(items)`、`remove(keys)`
- [x] 提供 `reset()` 方法清理状态
- [x] `get(key)` 支持字符串 key 参数（`storage.js` 当前只用字符串 key）
- [x] 导出 `installChromeStub()` 函数，在每个测试文件开头调用

### 8.2 storage.js 测试

**通过公开 API（`StorageManager`）间接覆盖内部逻辑，不导出 `sanitizeSettings` / `DEFAULT_SETTINGS`。**

- [x] **默认值完整性**
  - `getSettings()` 空存储 → 返回包含所有预期 key 的默认对象
  - 确认 `showFloatingBall === false`、`enableAdBlock === false`、`ttsProvider === 'system'`

- [x] **Legacy key 清理**
  - 存储中写入带 `mangaOcrEngine`、`fishAudioApiKey` 等 legacy key 的设置
  - `getSettings()` 返回时这些 key 已被移除

- [x] **TTS provider 迁移**
  - 存储 `ttsProvider: 'edge'` → `getSettings()` 返回 `'system'`
  - 存储 `ttsProvider: 'fish'` → `getSettings()` 返回 `'system'`
  - 存储 `ttsProvider: 'openai'` → 保持不变

- [x] **Settings 合并**
  - 存储有部分设置 → 合并结果中存储值优先于默认值
  - 存储缺少的 key → 从默认值补齐

- [x] **updateSettings()**
  - 更新单个 key → 只改目标 key，其他保留
  - 不会把未存储的新 key（如 `showFloatingBall`）静默回写为默认值 `false`（007 的关键行为）

- [x] **History CRUD**
  - addHistory → 新记录在最前
  - addHistory → 相同 `source` 去重（替换旧记录）
  - addHistory → 超过 500 条裁剪
  - removeHistory → 正确删除指定 id
  - clearHistory → 清空

- [x] **Favorites**
  - addFavorite → 已存在返回 null
  - addFavorite → 超过 200 条裁剪
  - removeFavorite → 正确删除
  - isFavorite → 正确判断

### 8.3 translator.js 测试

**直接 import 真实 `Translator` 类（已验证 Node 下可加载），不调 `init()`，通过注入 `t.settings` 和 `t.providers` 测试编排逻辑。**

- [x] **Provider 构造**
  - 创建带 fake provider 的 Translator 实例
  - fake provider 实现 `translate(text, from, to)` 返回可区分的结果

- [x] **Provider 选择**
  - settings.provider 为 'google' → 调用 google provider
  - 显式 provider 参数 → 覆盖 settings
  - 未知 provider → 抛出错误

- [x] **API Key 缺失回退**
  - openai 无 key → 回退 Google
  - gemini 无 key → 回退 Google
  - deepseek 无 key → 回退 Google

- [x] **翻译失败回退**
  - 主 provider 抛错 → 回退 Google
  - Google 抛错 → 尝试 offline
  - offline 也抛错 → 抛出 Google 原始错误
  - 显式选择 offline 失败 → 直接 throw，不回退

- [x] **detectLanguage()**（纯函数）
  - 中文字符 → `'zh'`
  - 日文假名 → `'ja'`
  - 韩文 → `'ko'`
  - 纯英文 → `'en'`

- [x] **translateBatch()**
  - openai/gemini 且有 `translateBatch` 方法 → 调用批量方法
  - 其他 provider → 逐个翻译

---

## 非目标

- 不测试 Service Worker 消息路由（留给 009，需先抽 seam）
- 不测试内容脚本 DOM 行为
- 不为测试导出 `storage.js` 的内部函数
- 不引入 `package.json`
- 不做覆盖率统计

## 执行要求

1. **先写 8.1 stub，再写 8.2，最后 8.3**
2. **每个测试文件写完后立即运行确认全绿**
3. **测试必须在 `node --test tests/*.test.mjs` 下全部通过**
4. **优先不修改 `src/` 下的源代码**——本轮执行中仅对 `src/core/translator.js` 做了 1 处最小 bugfix（韩文 `detectLanguage()` 漏返回），因为测试实际暴露了真实缺陷
5. **报告写入** `reports/008-testing.md`，包含测试数量和通过状态

## 相关文档

- 讨论: [discussions/008-testing.md](../discussions/008-testing.md)
- 007 报告（回归脚本参考）: [reports/007-lazy-init.md](../reports/007-lazy-init.md)
