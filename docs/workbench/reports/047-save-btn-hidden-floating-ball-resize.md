# 047 — 保存按钮全局可见与悬浮球 resize 守卫报告

- 状态: done
- 对应任务: [tasks/047-save-btn-hidden-floating-ball-resize.md](../tasks/047-save-btn-hidden-floating-ball-resize.md)
- 来源讨论: [discussions/047-save-btn-hidden-floating-ball-resize.md](../discussions/047-save-btn-hidden-floating-ball-resize.md)
- 执行日期: 2026-03-13

## 结果概览

本轮完成了 `A/B`：

- `A` Options 页的保存按钮现在从 API 标签中解耦，所有标签页下都可见，并继续和主内容区保持相同宽度与居中对齐
- `B` 悬浮球现在会在窗口 `resize` 时重新执行 `dockToEdge(...)`，隐藏期间缩窗后再次显示也不会沿用越界位置

## 已完成改动

### 47.1 A 保存按钮移到共享 action 容器

[options.html](/Users/xa/Desktop/projiect/zhiyi/options/options.html) 里原本放在 `#api` section 尾部的：

```html
<button class="btn btn-primary" style="margin-top: 20px;" id="save-btn">保存并应用配置</button>
```

已经移除。现在改为在所有 section 之后、`</main>` 之前插入：

```html
<div class="options-actions">
    <button class="btn btn-primary" id="save-btn">保存并应用配置</button>
</div>
```

这样做的效果是：

- `#save-btn` 不再跟随 `#api.tab-content` 被 `display: none`
- `options.js` 里的 `document.getElementById('save-btn')` 无需改动
- `saveSettings()`、dirty state、`beforeunload` 逻辑保持原样

[options.css](/Users/xa/Desktop/projiect/zhiyi/options/options.css) 新增了：

```css
.options-actions {
    max-width: 900px;
    margin: 20px auto 0;
}
```

这层容器复用了 `.tab-content` 的宽度和居中模型，避免按钮移出 section 后和主体内容错位。

本轮没有改：

- [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 的事件绑定和保存逻辑
- tab 切换逻辑
- 保存按钮的条件显隐

### 47.2 B 悬浮球增加 resize re-clamp

[floating-ball.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/floating-ball.js) 的 `createOrb()` 末尾新增了：

```javascript
window.addEventListener('resize', () => {
    if (!container) return;
    const currentTop = parseInt(container.style.top, 10) || window.innerHeight * 0.8;
    const isRight = container.style.right === '0px';
    dockToEdge(currentTop, isRight);
});
```

这里按 discussion 的收口保留了两个关键约束：

- 只在 `!container` 时返回，不因为 `display: none` 跳过
- 复用现有 `dockToEdge()` 做 clamp，不改拖拽和停靠逻辑

所以现在：

- 悬浮球显示时缩小窗口，会被重新夹回可见区域
- 悬浮球隐藏期间缩小窗口，再重新显示，也会沿用已经 re-clamp 后的位置

本轮没有改：

- `dockToEdge()` 本身
- `loadPosition()`、拖拽逻辑、菜单逻辑
- `syncVisibility()` / `init()` 结构

## TDD 记录

本轮按 test-first 执行，新建了 [save-btn-floating-ball-resize.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/save-btn-floating-ball-resize.test.mjs)。

首次运行：

```bash
node --test tests/save-btn-floating-ball-resize.test.mjs
```

时 2 个子测试都失败，分别覆盖：

- Options 仍未渲染全局 `options-actions` 保存按钮容器
- 悬浮球仍未注册 `resize` re-clamp 监听

补丁完成后该测试转绿。

## 验证

本轮实际跑过：

```bash
node --test tests/save-btn-floating-ball-resize.test.mjs
node --test tests/*.test.mjs
node --check content/modules/floating-ball.js
git diff --check
```

验证结果：

- [save-btn-floating-ball-resize.test.mjs](/Users/xa/Desktop/projiect/zhiyi/tests/save-btn-floating-ball-resize.test.mjs)：2/2 通过
- `node --test tests/*.test.mjs`：169/169 通过
- [floating-ball.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/floating-ball.js) `node --check` 通过
- `git diff --check` 无输出

## 手动验证

这轮仍未做真实浏览器人工点验。待人工确认的页面级行为包括：

- Options 页面切到「常规设置」时保存按钮可见
- 保存按钮与页面内容保持水平对齐
- 悬浮球显示状态下缩小窗口后仍留在视口内
- 悬浮球隐藏状态下缩小窗口，再重新显示时位置仍合法
