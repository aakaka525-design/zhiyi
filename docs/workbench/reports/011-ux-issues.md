# 011 — UX 问题修复报告

- 状态: done
- 对应任务: [tasks/011-ux-issues.md](../tasks/011-ux-issues.md)
- 来源讨论: [discussions/011-ux-issues.md](../discussions/011-ux-issues.md)
- 执行日期: 2026-03-12

## 结果概览

本轮完成了 `011` 收敛后的范围：

- 修掉了 Options 页两个与默认配置冲突的 HTML `checked`，消除新用户首次打开时的开关闪烁
- 去掉了 Popup footer 里硬编码的 `Google 翻译`
- 把 DeepSeek 配置区标题改成面向用户的文案，不再把 `ppinfra` 暴露成主标题
- 把“自定义快捷键”入口改成可靠引导：点击后复制 `chrome://extensions/shortcuts` 并提示用户到地址栏打开
- 给 Options 页增加了 dirty state、保存按钮未保存提示文案，以及 `beforeunload` 未保存变更提醒

本轮没有实现：

- Popup loading state
- TTS voice select 跨 provider 同步
- 任何 `service-worker` / 翻译逻辑变更

## 已完成改动

### 11.1 B1 开关默认值闪烁修复

[options.html](/Users/xa/Desktop/projiect/zhiyi/options/options.html) 里以下输入框已去掉错误的 HTML `checked`：

- `show-floating-ball`
- `enable-ad-block`

运行时真实值继续由 [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 的 `loadSettings()` 决定，不再出现先亮后灭的首屏闪烁。

### 11.2 C2 Popup footer 去硬编码

[popup.html](/Users/xa/Desktop/projiect/zhiyi/popup/popup.html) 的 `current-service` 默认文本改成 `-`，避免在 [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 读取真实 provider 之前先闪出 `Google 翻译`。

### 11.3 C3 DeepSeek 标题改写

[options.html](/Users/xa/Desktop/projiect/zhiyi/options/options.html) 的主标题从 `ppinfra 配置 (DeepSeek)` 改成了 `DeepSeek 配置`。`ppinfra` 只保留在说明文案里，作为当前接入平台补充信息，不再占据主标题。

### 11.4 A1 快捷键入口可靠引导

[options.html](/Users/xa/Desktop/projiect/zhiyi/options/options.html) 里的快捷键入口已从裸 `<a href="chrome://extensions/shortcuts">` 改成按钮。

[options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 现在会：

- 点击后尝试把 `chrome://extensions/shortcuts` 复制到剪贴板
- 成功时 toast 提示“已复制快捷键设置地址，请粘贴到浏览器地址栏打开”
- 失败时回退为 toast 提示“请在浏览器地址栏输入 chrome://extensions/shortcuts”

这轮没有引入 `chrome.tabs.create()` 等程序化导航。

### 11.5 B3 保存语义一致化

新增了 [options-ui-state.js](/Users/xa/Desktop/projiect/zhiyi/options/options-ui-state.js) 作为纯 helper，负责：

- 构建当前设置快照
- 判断是否存在未保存变更
- 生成快捷键引导 toast 文案
- 生成保存按钮的 dirty 文案

[options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 现在会：

- 在设置加载完成后记录初始快照
- 对所有受管设置字段监听 `input/change`
- 当当前快照与初始快照不同，更新保存按钮文案为 `保存并应用配置（有未保存更改）`
- 保存成功后重置基线并清除 dirty 状态
- 页面关闭前若仍有未保存变更，触发 `beforeunload` 默认提示

这轮仍然保持“手动保存”为主，没有把 API key / model / base URL 改成自动保存。

## TDD 记录

本轮按 test-first 执行，分两批完成：

1. 先新增 [ux-static-html.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/ux-static-html.test.mjs)
2. 首次运行时，`B1/C2/C3` 对应断言失败，原因分别是：
   - `show-floating-ball` / `enable-ad-block` 仍带 `checked`
   - Popup footer 仍硬编码 `Google 翻译`
   - DeepSeek 标题仍带 `ppinfra`
3. 修正 HTML 后，这组测试转绿
4. 再新增：
   - [options-ui-state.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/options-ui-state.test.mjs)
   - [options-script-static.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/options-script-static.test.mjs)
5. 第二批首次失败覆盖了：
   - `options-ui-state.js` 尚不存在
   - 快捷键入口仍是 `chrome://` anchor
   - `options.js` 尚无 clipboard 引导和 `beforeunload` 保护
6. 随后补最小实现，测试转绿，再回跑全量测试

## 验证

实际跑过的验证命令：

```bash
node --test tests/options-ui-state.test.mjs tests/options-script-static.test.mjs tests/ux-static-html.test.mjs
node --test tests/*.test.mjs
node --check options/options.js
node --check options/options-ui-state.js
node --check popup/popup.js
git diff --check
```

验证结果：

- 三份 `011` 新增测试：10/10 通过
- `node --test tests/*.test.mjs`：52/52 通过
- [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) `node --check` 通过
- [options-ui-state.js](/Users/xa/Desktop/projiect/zhiyi/options/options-ui-state.js) `node --check` 通过
- [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮没有在真实 Chrome 扩展环境手工点验。仍待人工确认的页面级行为有：

- Options 页首次加载时，悬浮球 / 广告屏蔽开关不闪烁
- Popup 打开时 footer 不会先闪现 `Google 翻译`
- DeepSeek 配置区标题和描述文案符合预期
- 快捷键按钮点击后可成功复制 URL，并有正确 toast
- 修改设置后直接关闭页面，浏览器会出现未保存变更提示
