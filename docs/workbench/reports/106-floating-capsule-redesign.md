---
report: "106"
status: done
created: 2026-03-16
---

# 106 — 悬浮球胶囊重构

## 变更摘要

- 球+弹出菜单 → 胶囊横向展开（点击主球触发，300ms 延迟收起）
- 拖拽从主球迁到胶囊把手（6 点 grip）
- 进度环联动 `utils.js` 共享 progress helper
- 展开方向按停靠边自适应（`flex-direction` 翻转）
- 展开动画用 `max-width: 0 → 300px`（不用 `width: auto`）
- 清理 104 的垂直菜单代码

## 改动文件

| 文件 | 改动 |
|------|------|
| `content/modules/floating-ball.js` | 胶囊重写 |
| `content/content.css` | 胶囊样式 + 清理 104 |
| `content/modules/utils.js` | 进度环联动 |
| `tests/106-floating-capsule.test.mjs` | 静态断言 |
| `tests/104-floating-ball-redesign.test.mjs` | 旧悬浮球基线对齐 |
| `tests/content-darkmode-floatball-drag.test.mjs` | 拖拽基线对齐 |
| `tests/css-token-and-speak.test.mjs` | 浮球样式基线对齐 |
| `tests/polish-consistency.test.mjs` | 浮球样式基线对齐 |
| `tests/content-ux-static.test.mjs` | 小窗入口基线对齐 |
| `tests/065-options-system-tts-test-immersive-progress-race.test.mjs` | progress helper 基线对齐 |

## 未做

- 极简态（`floatingBallMinimal`）— 留后续
- 进度环失败态颜色变化

## 验证

- `node --test tests/106-floating-capsule.test.mjs`：`3/3`
- `node --test tests/*.test.mjs`：`361/361`
- `node --check content/modules/floating-ball.js content/modules/utils.js`：通过
- `git diff --check`：无输出

## 残留风险

- 还没做真实 Chrome 手测；胶囊展开动画、把手拖拽手感、进度环在真实沉浸式翻译流程中的视觉同步仍需浏览器内确认。
