---
report: "104"
status: done
created: 2026-03-16
---

# 104 — 悬浮球菜单重新设计

## 变更摘要

- 径向扇形 → 垂直堆叠（向上展开）
- 纯图标圆 → 胶囊形按钮（图标 + 文字标签，方向按停靠边自适应）
- 白色实心底 → 半透明深色磨砂底（深浅通用）
- 翻译小窗图标：日历形 → 窗口形
- 移除 tooltip（文字标签替代）
- hover 不用 transform（避免与定位冲突）

## 改动文件

| 文件 | 改动 |
|------|------|
| `content/modules/floating-ball.js` | 布局 + 标签 + 图标 |
| `content/content.css` | 样式重写 |
| `tests/104-floating-ball-redesign.test.mjs` | 静态断言 |

## 验证

- `node --test tests/104-floating-ball-redesign.test.mjs`：`2/2`
- `node --test tests/*.test.mjs`：`358/358`
- `node --check content/modules/floating-ball.js`：通过
- `git diff --check`：无输出

## 残留风险

- 还没做真实 Chrome 手测；悬浮球左右停靠时的标签朝向、深色磨砂底观感、hover 动效仍需浏览器内确认。
