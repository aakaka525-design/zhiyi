---
status: done
task: 083-scroll-rescan-virtual-scrolling
date: 2026-03-15
---

# 083 — 虚拟滚动/动态加载页面：滚动重扫描补充翻译

## 完成结果

已按讨论收窄版完成 `083`，只处理 scroll rescan / stale translation / own-artifact 语义，不扩到 scroll 补扫之外的额外感知机制：

- 在 [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 增加 `GENERIC_SELECTORS`、`DISCORD_GENERIC_SELECTORS`、`INITIAL_SCAN_EXTRA_SELECTORS`
- 新增 `translatedSources`、`hashText(...)`、`hasOwnTranslationArtifacts(...)`、`getOwnCleanSourceText(...)`、`removeOwnTranslationArtifacts(...)`
- 新增 `rescanUntranslatedElements(...)`，给虚拟滚动 / 节点复用场景补 scroll rescan
- `startMutationObserver()` 增加 `rescanInFlight` + `lastRescanTime` scroll 节流与防重入守卫
- `stopMutationObserver()` 补 `scrollHandler` 清理
- 初始扫描、Observer、rescan 三条成功注入路径都补了源文本 hash 存储
- 新增回归测试 [083-scroll-rescan.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/083-scroll-rescan.test.mjs)

## 实际修改文件

- [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js)
- [083-scroll-rescan.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/083-scroll-rescan.test.mjs)
- [063-system-tts-onend-immersive-batch-timeout.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/063-system-tts-onend-immersive-batch-timeout.test.mjs)
- [068-immersive-td-th-injection.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/068-immersive-td-th-injection.test.mjs)
- [071-immersive-coverage.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/071-immersive-coverage.test.mjs)
- [072-immersive-exclude-selectors.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/072-immersive-exclude-selectors.test.mjs)
- [073-immersive-discord.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/073-immersive-discord.test.mjs)
- [074-observer-containment-dedup.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/074-observer-containment-dedup.test.mjs)
- [075-cell-css-selector-coverage.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/075-cell-css-selector-coverage.test.mjs)
- [076-observer-node-self-match.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/076-observer-node-self-match.test.mjs)
- [082-immersive-telegram.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/082-immersive-telegram.test.mjs)

## 说明

- `083` 的 stale 处理按 own-artifact 语义落地，只处理当前元素自己的 direct child / sibling wrapper，不扩大到后代树。
- rescan 过滤链额外补了 descendant translation skip，和现有 `injectTranslation()` 的 descendant guard 保持一致，避免“父元素反复进队列但永远注不进去”的空转。
- 为了让 `083` 之后的全量测试继续反映真实运行时，旧的沉浸式 harness 已补最小 `window.addEventListener/removeEventListener` stub，并把几条写死旧 selector 字符串的静态断言改成接受共享常量。
- 在红测阶段，`083-scroll-rescan.test.mjs` 有一条 “child 已翻译但无 hash” 的半成品场景会误触 stale；已改成模拟真实已翻译状态（写入 `translatedSources`），生产逻辑未因此扩大。

## 验证

- `node --test tests/083-scroll-rescan.test.mjs`
- `node --test tests/*.test.mjs`
- `node --check content/modules/immersive.js`
- `git diff --check`

结果：

- `083` 专项测试 `6/6`
- 全量测试 `288/288`
- `node --check` 通过
- `git diff --check` 无输出

## 残留风险

- scroll rescan 只覆盖当前讨论接受的滚动补扫，不包含 `IntersectionObserver`、attribute 监听或可见性变化补偿
- stale 检测与清理只对 own-artifact 生效；父元素与子元素的注入粒度问题继续受现有 `injectTranslation()` 语义约束
- 未做真实 Chrome / 虚拟滚动站点手测
