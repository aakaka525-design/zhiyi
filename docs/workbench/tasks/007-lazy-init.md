---
status: done
priority: P1
created: 2026-03-10
supersedes: 006-performance-compat
---

# 007 — 懒初始化与默认副作用收敛

## 背景

003 审核发现内容脚本在所有 `<all_urls>` 页面上启动即创建大量 UI 和高副作用逻辑。004-006 修复了安全、功能和死代码问题后，这是当前最突出的运行时问题。

本任务是原 `006-performance-compat` 的 A1 阶段：只收敛默认启动副作用，不改 `<all_urls>` 权限模型。

## 相关讨论

- 技术方案讨论: [discussions/006-cleanup.md](../discussions/006-cleanup.md)（方案 2 + 方案 4 迁移策略）
- 原始草稿: [tasks/006-performance-compat.md](../tasks/006-performance-compat.md)（已被本任务取代）

## 当前问题

`content/content.js:90-99` 的 `init()` 函数：

```javascript
ST.createSidebar();        // 无条件创建
ST.createFloatWindow();    // 无条件创建
ST.floatingBall.init();    // 无条件创建
```

加上 `storage.js` 的 `DEFAULT_SETTINGS` 缺少 `showFloatingBall` 和 `enableAdBlock`，导致：

- `floating-ball.js` 在 `showFloatingBall !== false` 时创建 → 事实上默认开
- `ad-blocker.js` 在 `enableAdBlock !== false` 时启用 → 事实上默认开（挂 `window.open` 劫持、`MutationObserver`、覆盖层清理 interval）

**结果**：每个页面加载时都创建 3 个 UI 容器 + 广告拦截全套副作用，即使用户从未使用这些功能。

## 完成标准

1. **默认启动不再创建 Sidebar / FloatWindow / FloatingBall DOM**
2. **默认启动不再启用 ad-blocker 的高副作用路径**

## 修复清单

### 7.1 显式默认值

- [x] `src/core/storage.js` `DEFAULT_SETTINGS` 中新增：
  - `showFloatingBall: false`
  - `enableAdBlock: false`

### 7.2 onInstalled 升级迁移

**目的**：新用户拿到 `false` 默认值（干净非侵入），老用户保留当前行为（不感知变更）。

- [x] `background/service-worker.js` 新增 `chrome.runtime.onInstalled` 监听器
- [x] `reason === 'install'`：不需要额外操作，DEFAULT_SETTINGS 中的 `false` 生效
- [x] `reason === 'update'`：读取当前存储的 settings，如果缺少 `showFloatingBall` key，补为 `true`；如果缺少 `enableAdBlock` key，补为 `true`。已有显式值的不覆盖
- [x] 迁移逻辑必须**幂等**——多次执行不改变结果
- [x] 运行时代码（`getSettings()` 等）在遇到"迁移前旧设置"（缺少这两个 key）时，不能写坏用户已有的显式配置
- [x] 如果仍存在安装/升级时序上的残余风险（比如 content script 先于迁移读取设置），记录到报告的 residual risk 中，不要在代码里做不可验证的时序保证

**注意**：这是项目第一个 `onInstalled` 迁移挂点。实现时建议结构化（比如版本号 + 迁移函数数组），方便未来复用。

### 7.3 Sidebar / FloatWindow 懒初始化

- [x] `content/content.js` `init()` 中移除 `ST.createSidebar()` 和 `ST.createFloatWindow()`
- [x] `ST.toggleSidebar()` 首次调用时检测并创建 Sidebar DOM（如果尚未创建）
- [x] `ST.toggleFloatWindow()` 首次调用时检测并创建 FloatWindow DOM（如果尚未创建）
- [x] 确认以下入口仍然可用：
  - Popup 的侧边栏/小窗按钮（通过 `chrome.tabs.sendMessage` → `toggleSidebar` / `toggleFloatWindow`）
  - 快捷键（通过 `chrome.commands.onCommand` → 内容脚本）
  - 悬浮球点击（如果悬浮球已启用）

### 7.4 FloatingBall 受设置控制

- [x] `content/content.js` `init()` 中，`floatingBall.init()` 改为先读取 `settings.showFloatingBall`，仅当为 `true` 时才初始化
- [x] `floating-ball.js` 内部的 `showFloatingBall !== false` 检查同步更新为读取真实设置值
- [x] 确认 Options 页中有对应的"显示悬浮球"开关，用户可以主动开启

### 7.5 Ad-blocker 默认关闭

- [x] `ad-blocker.js` 的启用逻辑改为只在 `enableAdBlock === true` 时生效，不再用 `!== false`
- [x] 确认 `disable()` 时完整清理所有副作用（004 已修过，验证即可）
- [x] 确认 Options 页中有对应的"广告拦截"开关

### 7.6 保留的常驻能力

以下能力必须在默认启动时保留，不受懒初始化影响：

- [x] 划词翻译事件监听（`mouseup`、`mousedown`、`dblclick`）
- [x] 来自 popup / background 的消息接收（`chrome.runtime.onMessage`）
- [x] `chrome.storage.onChanged` 设置自动刷新
- [x] 沉浸式翻译相关逻辑（如果当前默认不启动则无需改动）

### 7.7 回归检查

- [x] 懒初始化后确认 `toggleSidebar()` 首次调用能正确创建并显示侧边栏
- [x] 懒初始化后确认 `toggleFloatWindow()` 首次调用能正确创建并显示小窗
- [x] 显式开启 `showFloatingBall: true` 后悬浮球正常显示和交互
- [x] 显式开启 `enableAdBlock: true` 后广告拦截正常工作
- [x] 划词翻译、快捷键、Popup 功能不受影响

---

## 非目标

- 不改 `<all_urls>` 权限策略（那是 A2，需要产品决策）
- 不加白名单/黑名单配置（那是 A3）
- 不做自动化测试（那是 008）
- 不做 TTS 统一重构

## 执行要求

1. **先做 7.1 + 7.2**（默认值和迁移），再做 7.3-7.5（懒初始化），最后 7.6-7.7（验证）
2. **每项改完后 `node --check`**
3. **7.7 回归检查记录到报告中**——哪些通过了静态验证，哪些需要人工手测
4. **不要改 manifest.json 的权限声明**
5. **报告写入** `reports/007-lazy-init.md`

## 相关文档

- 006 讨论（方案讨论）: [discussions/006-cleanup.md](../discussions/006-cleanup.md)
- 原始草稿: [tasks/006-performance-compat.md](../tasks/006-performance-compat.md)
- 003 审核: [reports/003-full-audit.md](../reports/003-full-audit.md)
