# 024 — content.css Token 体系补全执行报告

- 日期: 2026-03-13
- 状态: 已完成
- 对应任务: [024-css-token-completion.md](../tasks/024-css-token-completion.md)
- 对应讨论: [023-content-tts-and-css-tokens.md](../discussions/023-content-tts-and-css-tokens.md)

## 执行结果

### 已修改

- `content/content.css`
  - 将 `#smart-translator-icon` 补入 token scope
  - 按 task 列表完成 20 处等值 hex 替换，统一改为 `var(--*)` token
  - 未触碰 task 明确排除的 `rgba(122, 154, 139, ...)` 系列透明色
  - 未触碰 `.st-float-header` 的 `background: #F9F9F9`

- `tests/content-ux-static.test.mjs`
  - 将 token scope 断言更新为包含 `#smart-translator-icon`
  - 新增静态断言：排除 token 定义行后，不再允许 `#7A9A8B` / `#9CBAB0` / `#333333` / `#F4F4F4` / `#999999` 作为属性值残留

- `tests/error-state-tts-lang.test.mjs`
  - 放宽 float-window `resolvedLang` 的匹配顺序，适配 023 中把 `resolvedLang` 提前到函数顶部的实现

- `tests/immersive-color-misc.test.mjs`
  - 更新 token scope 断言，接受 `#smart-translator-icon` 加入后的选择器序列

### 过程说明

- 先修改静态测试，让它们要求：
  - token scope 包含 `#smart-translator-icon`
  - 目标 hex 字面量不再作为属性值残留
- 首次运行 `node --test tests/content-ux-static.test.mjs` 时，2 个断言失败：
  - scope 里没有 `#smart-translator-icon`
  - 目标 hex 字面量仍大量存在
- 随后按 task 清单做 CSS 机械替换
- 全量测试时又暴露出两条旧静态测试写死了旧的内部排列顺序；这两条测试已同步收敛到新行为

## 验证

执行了：

```bash
node --test tests/content-ux-static.test.mjs
node --test tests/*.test.mjs
```

结果：

- `node --test tests/content-ux-static.test.mjs`：`5/5` 通过
- `node --test tests/*.test.mjs`：`94/94` 通过

## 结论摘要

1. `content.css` 的共享语义色值现在统一走 token，不再在这 20 个位置保留等值硬编码。
2. `#smart-translator-icon` 已进入 token scope，修改 `--accent` / `--accent-light` 时能一起响应。
3. 对应静态测试已补齐，后续若再次漂回硬编码值，会直接在测试里暴露。
