# 013 — 深色模式缺失 & 健壮性问题修复报告

- 状态: done
- 对应任务: [tasks/013-dark-mode-and-robustness.md](../tasks/013-dark-mode-and-robustness.md)
- 来源讨论: [discussions/013-dark-mode-and-robustness.md](../discussions/013-dark-mode-and-robustness.md)
- 执行日期: 2026-03-13

## 结果概览

本轮先完成了任务里的前三项：

- `A` Popup 深色模式支持
- `B` Options 深色模式硬编码修复
- `C` 右键翻译 `rect === null` 崩溃修复

随后补完了剩余收敛项：

- `D` Popup 状态点默认改为中性色
- `E` Popup / Options 版本号动态读取 `chrome.runtime.getManifest().version`
- `B-顺手` Options select 箭头去掉硬编码灰色 data URL

## 已完成改动

### 13.1 A Popup 深色模式支持

[popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 的 `loadSettings()` 现在会读取 `settings.darkMode`，并通过新增的 `applyDarkMode()` 在 popup `body` 上切换 `dark-mode` 类。

[popup.css](/Users/xa/Desktop/projiect/zhiyi/popup/popup.css) 中会打断深色模式的 3 处白底已改成 theme 变量：

- `.input-section:focus-within` → `var(--bg-card-solid)`
- `.result-section` → `var(--bg-card-solid)`
- `.quick-btn` → `var(--bg-card-solid)`

这批没有引入新的 theme 文件，仍然沿用 popup 已加载的 [theme.css](/Users/xa/Desktop/projiect/zhiyi/options/theme.css)。

### 13.2 B Options 深色模式硬编码修复

[options.css](/Users/xa/Desktop/projiect/zhiyi/options/options.css) 中会压过深色变量的 5 处白底已替换为 theme 变量：

- `.nav-item:hover` → `var(--bg-card-solid)`
- `.nav-item.active` → `var(--bg-card-solid)`
- `.content-area` → `var(--bg-card-solid)`
- `.input` → `var(--bg-input)`
- `.history-item` → `var(--bg-card-solid)`

`slider:before` 的白色圆点保持不动。它属于控件视觉设计值，不在这轮“深色模式背景块错误”的修复范围内。

### 13.3 C 右键翻译 rect null 崩溃修复

[selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) 的 `showBubble()` 不再假定 `ST.state.selection.rect` 一定存在。

现在的定位逻辑是：

1. 先用缓存的 `ST.state.selection.rect`
2. 如果没有，再尝试 `window.getSelection()` 的首个 range rect，并要求 `width/height > 0`
3. 如果仍然拿不到有效 rect，则回退到一个安全的固定视口位置

这样右键菜单路径或缺少 `mouseup/dblclick` 前置状态的场景不会再因为空 rect 直接崩溃。

## TDD 记录

本批按 test-first 执行，新增了 [dark-mode-robustness.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/dark-mode-robustness.test.mjs)。

红测阶段首次失败覆盖了 4 个真实缺口：

- popup 代码未读取 `settings.darkMode`
- popup / options 样式仍含会打断深色模式的关键白底
- `showBubble()` 在 cached rect 缺失时直接读取 `null.bottom`
- 没有有效 range rect 时也缺少安全定位 fallback

修复后，目标测试转绿，再回跑全量测试确认无回归。

## 验证

本批实际跑过：

```bash
node --test tests/dark-mode-robustness.test.mjs
node --test tests/*.test.mjs
node --check popup/popup.js
node --check content/modules/selection.js
git diff --check
```

验证结果：

- `tests/dark-mode-robustness.test.mjs`：4/4 通过
- `node --test tests/*.test.mjs`：60/60 通过
- [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) `node --check` 通过
- [selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) `node --check` 通过
- `git diff --check` 无输出

## 第二批补完

### 13.4 D Popup 状态点改为中性默认态

[popup.html](/Users/xa/Desktop/projiect/zhiyi/popup/popup.html) 默认状态点已经去掉 `active` 类。当前 popup 仍只显示 provider 名称，不做健康检查，所以中性色比默认绿色更符合真实语义。

### 13.5 E Popup / Options 版本号动态化

以下两个页面不再硬编码 `v1.0.0`：

- [popup.html](/Users/xa/Desktop/projiect/zhiyi/popup/popup.html) 现在使用 `id="app-version"` 占位
- [options.html](/Users/xa/Desktop/projiect/zhiyi/options/options.html) 现在也使用 `id="app-version"` 占位

对应 JS 会在初始化时填充：

- [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js)：`v${chrome.runtime.getManifest().version}`
- [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js)：`版本 v${chrome.runtime.getManifest().version}`

### 13.6 B-顺手 Select 箭头颜色变量化

[options.css](/Users/xa/Desktop/projiect/zhiyi/options/options.css) 的 `.select` 已去掉硬编码 `#6A6A6A` data URL SVG，改成用两条 `linear-gradient()` 画 chevron，并直接消费 `var(--text-secondary)`。这样不需要在 data URL 内硬塞主题颜色，也能跟随深色模式变化。

## 最终验证补充

在第一批验证基础上，又补跑并确认：

```bash
node --test tests/dark-mode-robustness.test.mjs
node --test tests/*.test.mjs
node --check popup/popup.js
node --check options/options.js
node --check content/modules/selection.js
git diff --check
```

最终结果：

- `tests/dark-mode-robustness.test.mjs`：6/6 通过
- `node --test tests/*.test.mjs`：62/62 通过
- [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) `node --check` 通过
- [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) `node --check` 通过
- [selection.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/selection.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- Popup 在开启深色模式后整体背景、结果卡片、快捷按钮和输入 focus 态都能正确切暗
- Options 深色模式下导航 hover/active、主内容区、输入框、历史记录卡片不再出现白块
- Popup footer 状态点默认为中性色
- Popup / Options 版本号都能显示当前 manifest 版本
- 右键菜单“翻译选中文本”在没有缓存 rect 的路径下不再崩溃
