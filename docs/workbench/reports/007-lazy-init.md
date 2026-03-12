# 007 — 懒初始化与默认副作用收敛报告

- 状态: done
- 对应任务: [tasks/007-lazy-init.md](../tasks/007-lazy-init.md)
- 来源讨论: [discussions/007-lazy-init.md](../discussions/007-lazy-init.md)
- 方案讨论: [discussions/006-cleanup.md](../discussions/006-cleanup.md)
- 执行日期: 2026-03-10

## 结果概览

本轮完成了 `007-lazy-init` 的 A1 范围：

- 为新用户补齐显式默认值：`showFloatingBall=false`、`enableAdBlock=false`
- 为老用户增加 `onInstalled` 升级迁移，缺失 key 时补为 `true`，不覆盖已有显式值
- 去掉内容脚本启动即创建 Sidebar / FloatWindow / FloatingBall 的路径
- 将悬浮球和广告拦截都收敛为显式 opt-in

本轮没有改 `manifest.json` 权限模型，也没有触碰 `<all_urls>`。

## 已完成改动

### 7.1 `storage.js` 默认值与写回策略

- [src/core/storage.js](/Users/xa/Desktop/projiect/zhiyi/src/core/storage.js) 新增：
  - `showFloatingBall: false`
  - `enableAdBlock: false`
- `StorageManager.getSettings()` 继续返回 `DEFAULT_SETTINGS + 已存设置`
- `StorageManager.updateSettings()` 改为以原始存储值为基底合并更新，不再因为默认值回填把未迁移旧用户的两个新 key 静默写成 `false`

### 7.2 `onInstalled` 升级迁移

- [service-worker.js](/Users/xa/Desktop/projiect/zhiyi/background/service-worker.js) 新增 `chrome.runtime.onInstalled.addListener(...)`
- 采用 `INSTALLED_MIGRATIONS` 数组结构，为未来迁移留出扩展点
- 当前迁移逻辑只在 `reason === 'update'` 时运行：
  - 如果缺少 `showFloatingBall`，补 `true`
  - 如果缺少 `enableAdBlock`，补 `true`
  - 已有显式值不覆盖

### 7.3-7.5 懒初始化与默认副作用收敛

- [content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) 移除了启动时的：
  - `ST.createSidebar()`
  - `ST.createFloatWindow()`
  - 无条件 `ST.floatingBall.init()`
- [content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) 在 `loadSettings()` 之后，如果已存 `enableAdBlock === true`，会显式补一次 `ST.adBlocker.init()`，填上首屏启动链路
- [sidebar.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/sidebar.js) 的 `toggleSidebar()` 现在会在首次调用时补创建 UI
- [float-window.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/float-window.js) 保持原有的首次 toggle 自建行为
- [floating-ball.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/floating-ball.js)：
  - 去掉默认开启逻辑
  - 新增 `initialized` 防止重复绑定
  - 只在 `showFloatingBall === true` 时创建/显示
- [ad-blocker.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/ad-blocker.js)：
  - 只在 `enableAdBlock === true` 时启用
  - 新增 `initialized` guard，避免 `content.js` 补初始化后重复绑定 `storage.onChanged`
  - 设置变更时 `true => enable()`，其余都走 `disable()`

## 验证

通过的验证：

```bash
node /tmp/zhiyi-007-regression.mjs
rg -n "showFloatingBall|enableAdBlock" options/options.js options/options.html src/core/storage.js background/service-worker.js content/content.js content/modules/floating-ball.js content/modules/ad-blocker.js
rg -n "createSidebar\\(|createFloatWindow\\(|showFloatingBall !== false|enableAdBlock !== false|onInstalled" content/content.js content/modules/sidebar.js content/modules/float-window.js content/modules/floating-ball.js content/modules/ad-blocker.js background/service-worker.js
find background content popup options src offscreen -name '*.js' -type f | sort | xargs -n1 node --check
git diff --check
```

回归脚本 `/tmp/zhiyi-007-regression.mjs` 验证通过：

- `StorageManager.getSettings()` 默认返回 `showFloatingBall=false` / `enableAdBlock=false`
- `StorageManager.updateSettings()` 不会在迁移前静默回写这两个 key
- 内容脚本启动时不再 eager 创建 Sidebar / FloatWindow / FloatingBall
- `toggleSidebar()` / `toggleFloatWindow()` 首次调用能自建 UI
- 悬浮球在默认关闭时不创建，显式 `true` 时仍会创建
- 广告拦截在默认关闭时不注入样式/observer/click protection，显式 `true` 时仍会启用
- 广告拦截在“已存 `enableAdBlock=true` 的新页面首屏加载”场景下也会启用，且不会重复绑定监听
- 划词监听、`runtime.onMessage`、`storage.onChanged` 常驻监听仍保留
- `service-worker.js` 已存在 `onInstalled` 迁移挂点

扫描结论：

- [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 和 [options.html](/Users/xa/Desktop/projiect/zhiyi/options/options.html) 仍保留“显示悬浮球 / 广告拦截”开关
- 运行时代码中已没有 `showFloatingBall !== false` / `enableAdBlock !== false` 这类默认开启判断
- [content.js](/Users/xa/Desktop/projiect/zhiyi/content/content.js) 已不再启动时调用 `createSidebar()` / `createFloatWindow()`
- 所有现存 JS 文件 `node --check` 通过
- `git diff --check` 无输出

## Residual Risk

- `chrome.runtime.onInstalled` 是升级迁移的正确挂点，但它仍是一次异步写入。极窄情况下，如果更新后的某个页面在迁移写入前就读取了设置，那个页面本次会按新默认值运行，直到迁移完成或设置再次刷新。
- 本轮已经通过 `StorageManager.updateSettings()` 的原始值合并，避免了“无关设置更新时把缺失 key 静默写成 `false`”的问题。
- 仍未在真实 Chrome 更新场景下手测“升级后首次打开页面”的时序，所以这条残余风险只做了代码级收敛，没有做浏览器级证伪。

## 未做项

- 没有在真实 Chrome 扩展环境手测 Popup 按钮、快捷键和悬浮球点击入口
- 没有对广告拦截在真实目标站点上做页面级回归
- 没有处理 A2 `<all_urls>` / 权限模型收敛；这仍是后续任务
