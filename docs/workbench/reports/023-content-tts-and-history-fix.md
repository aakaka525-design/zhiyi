# 023 — Content TTS 语言修复 & Sidebar 历史状态同步执行报告

- 日期: 2026-03-13
- 状态: 已完成
- 对应任务: [023-content-tts-and-history-fix.md](../tasks/023-content-tts-and-history-fix.md)
- 对应讨论: [023-content-tts-and-css-tokens.md](../discussions/023-content-tts-and-css-tokens.md)

## 执行结果

### 已修改

- `content/modules/float-window.js`
  - `speakSourceBtn` 改为传 `'auto'`
  - 在 `speak()` 顶部统一计算 `resolvedLang`
  - Google TTS voice 选择改为使用 `resolvedLang`
  - 系统 TTS fallback 复用同一个 `resolvedLang`

- `content/modules/sidebar.js`
  - `speakGoogle()` 在选择默认 voice 前先 resolve `'auto'`
  - 历史项 dataset 补存 `sourceLang` / `targetLang`
  - 点击历史时同步 `sourceLangSelect`、`targetLangSelect`、`resultLang`
  - 历史旧数据缺 lang 时 fallback 到 `sourceLangSelect = 'auto'` 和 `resultLang = '翻译结果'`

- `tests/content-tts-history.test.mjs`
  - 新增静态回归测试，锁住 float-window source speak、sidebar Google TTS 和 sidebar 历史状态同步

### 过程说明

- 先新增 `tests/content-tts-history.test.mjs`
- 首次运行 `node --test tests/content-tts-history.test.mjs` 时，3 个断言全部失败，分别对应：
  - float-window source speak 仍未传 `'auto'`
  - sidebar `speakGoogle()` 仍直接使用原始 `lang`
  - sidebar 历史项未存 `sourceLang` / `targetLang`，点击时未同步 UI
- 随后按 task 的最小范围修改 `float-window.js` 和 `sidebar.js`

## 验证

执行了：

```bash
node --test tests/content-tts-history.test.mjs
node --test tests/*.test.mjs
```

结果：

- `node --test tests/content-tts-history.test.mjs`：`3/3` 通过
- `node --test tests/*.test.mjs`：`94/94` 通过

## 结论摘要

1. float-window 原文朗读不再因缺少语言参数而错误回退到中文默认 Google voice。
2. sidebar 在源语言为 `'auto'` 时也会先 resolve 语言，再选择默认 Google voice。
3. sidebar 历史点击后，原/目标语言选择器与结果标签会和历史项保持一致。
