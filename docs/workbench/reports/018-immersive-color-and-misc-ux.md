# 018 — 沉浸式翻译颜色修复 & 杂项 UX 修复报告

- 状态: done
- 对应任务: [tasks/018-immersive-color-and-misc-ux.md](../tasks/018-immersive-color-and-misc-ux.md)
- 来源讨论: [discussions/018-immersive-color-and-misc-ux.md](../discussions/018-immersive-color-and-misc-ux.md)
- 执行日期: 2026-03-13

## 第一批结果概览

按 `executing-plans` 默认批次，这一轮先完成了 `A/B/C`：

- `A` 沉浸式翻译颜色 token 化
- `B` Popup `showToast()` 去重
- `C` Floating-ball debug log 删除

第二批已补完 `D`，本任务现已完成。

## 已完成改动

### 18.1 A 沉浸式翻译颜色 token 化

[content/content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 现在把：

- `.st-immersive-translation`
- `.st-translation-separator`

补进了 content-side token scope，避免 inline 沉浸式路径拿不到 `--accent`。

同时这轮把两条渲染路径统一到了同一颜色 token：

- [content/content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 中 `.st-immersive-translation` 的文字颜色改为 `var(--accent)`
- [content/content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 中 `.st-immersive-translation` 的左边框改为 `3px solid var(--accent)`
- [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 中 inline separator 的颜色改为 `var(--accent)`
- [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 中 inline translation span 的颜色改为 `var(--accent)`

按任务约束，本轮没有动背景色 `rgba(122, 154, 139, 0.08)`。

### 18.2 B Popup `showToast()` 去重

[popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 的 `showToast(message)` 现在在创建新 toast 之前会执行：

- `document.querySelectorAll('.toast').forEach(el => el.remove())`

这次按讨论收口选择了“清掉所有旧 toast”，而不是只删首个 `.toast`，避免多次快速点击时 popup 堆叠多个提示层。

### 18.3 C Floating-ball debug log 删除

[floating-ball.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/floating-ball.js) 中这 3 条调试日志已删除：

- `FloatingBall init called`
- `Settings:`
- `Setting changed, showFloatingBall:`

这里尤其修掉了把完整 `settings` 对象打印到控制台的风险。

## TDD 记录

本批按 test-first 执行，新增了 [immersive-color-misc.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/immersive-color-misc.test.mjs)。

首次运行 `node --test tests/immersive-color-misc.test.mjs` 时，3 个断言都失败，分别覆盖：

- token scope 和 immersive render path 仍使用旧颜色常量
- popup `showToast()` 创建前没有清理旧 toast
- floating-ball 仍保留调试日志

补丁完成后，目标测试转绿。第一批全量回归时，[content-ux-static.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/content-ux-static.test.mjs) 因 selector 断言写得过窄而失败；这次已把断言放宽为“允许在既有 token scope 中插入沉浸式 selector”，没有改动原功能范围。第二批再把 ad-blocker 守卫断言补进同一测试文件，并再次从失败转绿。

## 验证

本批实际跑过：

```bash
node --test tests/immersive-color-misc.test.mjs
node --test tests/*.test.mjs
node --check content/modules/immersive.js
node --check content/modules/floating-ball.js
node --check content/modules/ad-blocker.js
node --check popup/popup.js
git diff --check
```

验证结果：

- `tests/immersive-color-misc.test.mjs`：4/4 通过
- `node --test tests/*.test.mjs`：84/84 通过
- [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) `node --check` 通过
- [floating-ball.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/floating-ball.js) `node --check` 通过
- [ad-blocker.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/ad-blocker.js) `node --check` 通过
- [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) `node --check` 通过
- `git diff --check` 无输出

## 第二批补完

### 18.4 D Ad-blocker 插件元素守卫修复

[ad-blocker.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/ad-blocker.js) 现在统一复用了 [utils.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/utils.js) 里的 `ST.isPluginElement(el)`，不再依赖局部的 `#st-` 前缀判断。

这轮实际收口了 4 条分支，而不是只修 `removeAds()` 一处：

- `removeAds()` 中的元素移除守卫
- `closePopupAds()` 中的广告弹窗移除守卫
- 点击劫持防护里透明全屏覆盖层的 `notPluginElement` 判断
- 定期高 z-index 覆盖层清理里的插件元素排除逻辑

这样覆盖到了 `st-*` 和 `smart-translator-*` 两套前缀，避免 bubble / icon 这类元素继续落在 ad-blocker 的误删盲区里。

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- Popup 快速连续触发 toast 时，只保留最新一条提示
- 沉浸式翻译在 inline 和 block 两条路径下都使用统一的 accent 色
- Floating-ball 打开、拖拽、设置切换过程中，不再向控制台打印 settings 相关日志
- Ad-blocker 在清理弹窗、覆盖层和点击劫持元素时，不会误伤扩展自己的 bubble / icon / sidebar / float window / floating ball UI
