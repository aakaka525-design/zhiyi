# 049 — 广告屏蔽弹窗误伤与条件化 restoreScroll 报告

- 状态: done
- 对应任务: [tasks/049-adblocker-false-positive-restore-scroll.md](../tasks/049-adblocker-false-positive-restore-scroll.md)
- 来源讨论: [discussions/049-adblocker-false-positive-restore-scroll.md](../discussions/049-adblocker-false-positive-restore-scroll.md)
- 执行日期: 2026-03-13

## 结果概览

本轮完成了 `A/B`：

- `A` `closePopupAds()` 不再用裸 `includes('ad')` 误伤合法弹窗，改成按空格、`-`、`_` 分词后的 token 级匹配
- `B` observer 不再在每次检测到广告元素时无条件 `restoreScroll()`，只有本次确实删掉广告弹窗时才恢复滚动

## 已完成改动

### 49.1 A popup 广告词判断改为 token 级匹配

[ad-blocker.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/ad-blocker.js) 的 `closePopupAds()` 现在新增了局部 helper：

```javascript
const hasAdToken = (str) => str.split(/[\s_-]+/).some(t => t === 'ad' || t === 'ads');
```

原来的：

```javascript
className.includes('ad') ||
id.includes('ad')
```

现在改成：

```javascript
hasAdToken(className) ||
hasAdToken(id)
```

这样：

- `popup_ad`、`ads_popup` 这类真实广告命名仍会匹配
- `shadow-gradient`、`header-overlay`、`upload-modal`、`badge-popup` 这类合法类名/ID 不会再因为内部恰好带 `ad` 二字符而被误判
- 中文文案判断 `text.includes('广告')` / `text.includes('推广')` 保持不变

`closePopupAds()` 同时新增了：

```javascript
let removed = false;
```

并在真正删除 popup 时置为 `true`，最后返回 `removed`。这也是 `B` 条件化恢复滚动的前提。

本轮没有改：

- `POPUP_SELECTORS`
- `AD_SELECTORS`
- backdrop/mask 清理逻辑
- `ST.isPluginElement(el)` 守卫

### 49.2 B observer 只在 popup 实际被删时恢复滚动

[ad-blocker.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/ad-blocker.js) 的 observer 回调原先是：

```javascript
if (hasNewAds) {
    removeAds();
    closePopupAds();
    restoreScroll();
}
```

现在改成：

```javascript
if (hasNewAds) {
    removeAds();
    if (closePopupAds()) {
        restoreScroll();
    }
}
```

这样现在有两类路径会被正确区分：

- 只是普通广告元素注入，例如 `ins.adsbygoogle`
  - 仍会 `removeAds()`
  - 如果 `closePopupAds()` 没删任何弹窗，页面滚动状态不受影响
- 晚到的广告 popup 被识别并删除
  - `closePopupAds()` 返回 `true`
  - observer 才会补一轮 `restoreScroll()`

按 task 约束，[ad-blocker.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/ad-blocker.js) 里的 `enable()` 仍保持初始化时无条件：

```javascript
closePopupAds();
restoreScroll();
```

这一点没有改，因为首次启用广告屏蔽时，仍需要清掉页面现存的广告锁滚状态。

## TDD 记录

本轮按 test-first 执行，先新增了 [adblocker-false-positive-restore-scroll.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/adblocker-false-positive-restore-scroll.test.mjs)。

首次运行：

```bash
node --test tests/adblocker-false-positive-restore-scroll.test.mjs
```

时 3 个子测试全部失败，分别覆盖：

- `closePopupAds()` 仍在使用 `className.includes('ad')` / `id.includes('ad')`
- `closePopupAds()` 还没有 `removed` 返回值
- observer 仍在无条件 `restoreScroll()`

补丁完成后，该新增测试转绿。

## 验证

本轮实际跑过：

```bash
node --test tests/adblocker-false-positive-restore-scroll.test.mjs
node --test tests/*.test.mjs
node --check content/modules/ad-blocker.js
git diff --check
```

验证结果：

- [adblocker-false-positive-restore-scroll.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/adblocker-false-positive-restore-scroll.test.mjs)：3/3 通过
- `node --test tests/*.test.mjs`：175/175 通过
- [ad-blocker.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/ad-blocker.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实 Chrome 扩展环境手测。待人工确认的页面级行为包括：

- 合法 modal / popup（如登录框、cookie 同意框）不会再因为类名里恰好包含 `ad` 子串而被误删
- 启用广告屏蔽后，普通广告刷新不会破坏合法 modal 的滚动锁定
- 晚到的广告 popup 被删后，页面滚动会恢复
