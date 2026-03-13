# 035 — Settings snapshot 字符串字段 trim 执行报告

- 日期: 2026-03-13
- 状态: 已完成
- 对应任务: [035-settings-snapshot-trim.md](../tasks/035-settings-snapshot-trim.md)
- 对应讨论: [035-settings-trim-and-voice-dup.md](../discussions/035-settings-trim-and-voice-dup.md)

## 执行结果

### 已修改

- `options/options-ui-state.js`
  - 新增 `normalizeString()`，统一处理自由输入字符串
  - `buildSettingsSnapshot()` 现在会对以下字段做 `.trim()`：
    - `openaiApiKey`
    - `openaiBaseUrl`
    - `openaiModel`
    - `geminiApiKey`
    - `geminiModel`
    - `deepseekApiKey`
    - `deepseekBaseUrl`
    - `deepseekModel`
    - `ttsVoice`
  - 保持 `targetLang`、`provider`、`ttsProvider` 这类下拉框值不变

- `tests/options-ui-state.test.mjs`
  - 新增 `buildSettingsSnapshot trims whitespace from string fields`
  - 新增 `hasUnsavedChanges returns false when difference is only whitespace`

### 过程说明

- 先在 `tests/options-ui-state.test.mjs` 补两条失败测试
- 首次运行 `node --test tests/options-ui-state.test.mjs` 时：
  - `buildSettingsSnapshot()` 仍保留 `openaiApiKey` 前后空白
  - `hasUnsavedChanges()` 对仅有空白差异仍返回 `true`
- 随后把字符串规范化收口到 `buildSettingsSnapshot()`，没有改 `collectCurrentSettings()`

## 验证

执行了：

```bash
node --test tests/options-ui-state.test.mjs
node --test tests/*.test.mjs
git diff --check -- options/options-ui-state.js tests/options-ui-state.test.mjs docs/workbench/tasks/035-settings-snapshot-trim.md docs/workbench/reports/035-settings-snapshot-trim.md
```

结果：

- `node --test tests/options-ui-state.test.mjs`：`6/6` 通过
- `node --test tests/*.test.mjs`：`102/102` 通过
- `git diff --check -- ...`：无输出

## 结论摘要

1. 设置保存路径现在和测试路径一样，会先 trim key / URL / model 等自由输入字符串。
2. 仅有前后空白差异的设置，不再被 dirty tracking 误判成真实变更。
3. 输入框视觉值本身没有被改写，保持在本轮 bugfix 范围之外。
