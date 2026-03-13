---
status: done
priority: P2
created: 2026-03-13
discussion: 023-content-tts-and-css-tokens
---

# 024 — content.css Token 体系补全

## 背景

023 讨论中 C 项经 Codex 复核确认成立，拆为独立任务以避免与功能 bugfix 混做。

---

## 任务 A：补入 `#smart-translator-icon` 到 token scope

**文件**：`content/content.css:6-15`

**当前 scope**：
```css
#smart-translator-bubble,
.st-immersive-wrapper,
#st-sidebar,
#st-sidebar-toggle-btn,
#st-float-window,
#st-page-progress,
#st-floating-ball-container,
.st-immersive-translation,
.st-translation-separator,
#st-toast {
```

**修复**：在合适位置加入 `#smart-translator-icon,`。

---

## 任务 B：替换 20 处硬编码 hex 值

所有替换均为等值替换——当前硬编码值与对应 token 的定义值完全相同。

| 行号 | 选择器 | 属性 | 硬编码值 | 替换为 |
|------|--------|------|----------|--------|
| 44 | `#smart-translator-bubble` | `color` | `#333333` | `var(--text-primary)` |
| 81 | `.st-bubble-logo` | `color` | `#7A9A8B` | `var(--accent)` |
| 97 | `.st-action-btn` | `color` | `#999999` | `var(--text-tertiary)` |
| 103 | `.st-action-btn:hover` | `background` | `#F4F4F4` | `var(--bg-secondary)` |
| 104 | `.st-action-btn:hover` | `color` | `#7A9A8B` | `var(--accent)` |
| 111 | `.st-bubble-result` | `color` | `#333333` | `var(--text-primary)` |
| 159 | `#smart-translator-icon` | `background` | `#7A9A8B` | `var(--accent)` |
| 173 | `#smart-translator-icon:hover` | `background` | `#9CBAB0` | `var(--accent-light)` |
| 219 | `#st-sidebar` | `color` | `#333333` | `var(--text-primary)` |
| 231 | `.st-sidebar-header` | `border-bottom` 色 | `#F4F4F4` | `var(--bg-secondary)` |
| 238 | `.st-sidebar-title` | `color` | `#333333` | `var(--text-primary)` |
| 252 | `.st-sidebar-search` | `background` | `#F4F4F4` | `var(--bg-secondary)` |
| 265 | `.st-sidebar-input` | `color` | `#333333` | `var(--text-primary)` |
| 274 | `.st-sidebar-btn` | `background` | `#7A9A8B` | `var(--accent)` |
| 288 | `.st-sidebar-btn:hover` | `background` | `#9CBAB0` | `var(--accent-light)` |
| 319 | `.st-float-header` | `border-bottom` 色 | `#F4F4F4` | `var(--bg-secondary)` |
| 325 | `.st-float-title` | `color` | `#7A9A8B` | `var(--accent)` |
| 678 | `#st-floating-ball` | `color` | `#7A9A8B` | `var(--accent)` |
| 686 | `#st-floating-ball:hover` | `background` | `#7A9A8B` | `var(--accent)` |
| 731 | `.st-orb-menu-item` | `color` | `#7A9A8B` | `var(--accent)` |
| 738 | `.st-orb-menu-item:hover` | `background` | `#7A9A8B` | `var(--accent)` |

**执行顺序**：先完成任务 A（补 scope），再做任务 B（替换值）。否则 `#smart-translator-icon` 的 `var(--accent)` 拿不到值。

---

## 任务 C：补静态测试锁住替换结果

**文件**：`tests/content-ux-static.test.mjs`（或新建测试文件）

### C1. 锁住 token scope 包含 `#smart-translator-icon`

断言 `content.css` 的 token scope 选择器列表中包含 `#smart-translator-icon`。

### C2. 锁住等值硬编码已被替换

断言 `content.css` 中除 token 定义行（line 16-24）外，不存在以下字面量作为属性值：
- `#7A9A8B`
- `#9CBAB0`
- `#333333`
- `#F4F4F4`
- `#999999`

注意：
- `rgba(122, 154, 139, ...)` 系列**不在检查范围**（无对应 token）
- `.st-float-header` `background: #F9F9F9`**不在检查范围**（无精确对应 token）
- token 定义行本身**排除在检查范围外**

---

## 不做的事

- 不动 `rgba(122, 154, 139, ...)` 系列透明度变体——无对应 token，过度设计
- 不动 `.st-float-header` `background: #F9F9F9`——无精确对应 token
- 不碰 JS 文件
- 不碰 service-worker、manifest、popup、options

## 验收标准

- [x] `#smart-translator-icon` 在 token scope 中
- [x] 20 处硬编码 hex 值全部替换为 `var(--*)` token
- [x] 静态测试覆盖 scope 包含 `#smart-translator-icon`
- [x] 静态测试覆盖等值硬编码不再存在（排除 token 定义行）
- [x] 所有测试通过
