---
status: done
priority: P1
created: 2026-03-13
---

# 047 — 保存按钮全局可见 & 悬浮球 resize 守卫

- 来源讨论: [discussions/047-save-btn-hidden-floating-ball-resize.md](../discussions/047-save-btn-hidden-floating-ball-resize.md)

## 执行前必读

- [docs/workbench/CONVENTIONS.md](../CONVENTIONS.md)
- [discussions/047-save-btn-hidden-floating-ball-resize.md](../discussions/047-save-btn-hidden-floating-ball-resize.md)（完整讨论记录）

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `options/options.html` | A：移动 save-btn 到共享 action 容器 |
| `options/options.css` | A：新增 `.options-actions` 样式 |
| `content/modules/floating-ball.js` | B：加 resize 监听 |
| `tests/save-btn-floating-ball-resize.test.mjs` | A + B |

## 任务清单

### 必做

#### A. 保存按钮移出 API section，全局可见

保存按钮 `<button id="save-btn">` 当前在 `<section id="api" class="tab-content">` 内部（`options.html:394`），切到常规/历史/关于标签时随 section 一起被 `display: none` 隐藏。常规标签有 5 个非自动保存控件无法触达保存入口。

- [x] `options/options.html` — 删除当前 save-btn（line 394），在所有 `</section>` 之后、`</main>` 之前（即当前 line 452 `</section>` 与 line 453 `</main>` 之间）插入带容器的按钮：
  ```html
  <!-- 改前（line 393-395） -->
              </div>


              <button class="btn btn-primary" style="margin-top: 20px;" id="save-btn">保存并应用配置</button>
          </section>

  <!-- 改后（line 393-395） -->
              </div>

          </section>
  ```

  ```html
  <!-- 改前（line 452-453 之间无内容） -->
          </section>
      </main>

  <!-- 改后（在 </section> 与 </main> 之间插入） -->
          </section>

          <div class="options-actions">
              <button class="btn btn-primary" id="save-btn">保存并应用配置</button>
          </div>
      </main>
  ```

- [x] `options/options.css` — 在 `.tab-content.active { display: block; }` 规则之后（当前 line 108 之后），新增 `.options-actions` 样式：
  ```css
  /* 改前（line 106-108） */
  .tab-content.active {
      display: block;
  }

  /* 改后 */
  .tab-content.active {
      display: block;
  }

  .options-actions {
      max-width: 900px;
      margin: 20px auto 0;
  }
  ```

  行为说明：
  - `.options-actions` 复用与 `.tab-content` 相同的 `max-width: 900px` + 水平居中，按钮与页面主体对齐
  - 按钮不再有 `style="margin-top: 20px;"`，改由容器的 `margin: 20px auto 0` 统一控制
  - 按钮始终在所有 tab section 下方，无论哪个标签激活都可见
  - 不需要改 `options.js` — `document.getElementById('save-btn')` 不依赖父级 section

**不要做的事**：
- 不要加"只在 General / API 标签显示"的条件逻辑 — 保持全局可见最简单
- 不要改 `options.js` 的 `saveSettings()`、`setDirtyState()`、`refreshDirtyState()`、`bindDirtyTracking()`、`bindEvents()`
- 不要改 `options.js` 的 `switchTab()` 函数
- 不要改 `options.js` 的 `elements.saveBtn` 引用（`document.getElementById('save-btn')` 不受 DOM 位置影响）
- 不要加新的 JS 逻辑
- 不要改其他 CSS 规则

### 必做

#### B. 悬浮球加 window resize 监听

`floating-ball.js` 的 `dockToEdge()` 只在 `createOrb()` 初始化和拖拽结束时调用。窗口缩小后悬浮球可能超出视口。

**关键约束**：resize handler 不能在 `display: none` 时跳过 re-clamp。如果球被隐藏期间窗口缩小，旧 `top` 越界；下次 `syncVisibility()` 显示时球仍在视口外。只在 `!container` 时 return。

- [x] `content/modules/floating-ball.js` — 在 `createOrb()` 函数末尾（当前 line 97 `container.addEventListener('mouseleave', ...)` 之后、line 98 `};` 结束花括号之前），新增 resize 监听器：
  ```javascript
  // 改前（line 96-98）
        container.addEventListener('mouseenter', () => !isDragging && toggleActive(true));
        container.addEventListener('mouseleave', () => !isDragging && toggleActive(false));
    };

  // 改后
        container.addEventListener('mouseenter', () => !isDragging && toggleActive(true));
        container.addEventListener('mouseleave', () => !isDragging && toggleActive(false));

        window.addEventListener('resize', () => {
            if (!container) return;
            const currentTop = parseInt(container.style.top, 10) || window.innerHeight * 0.8;
            const isRight = container.style.right === '0px';
            dockToEdge(currentTop, isRight);
        });
    };
  ```

  行为说明：
  - 只在 `!container` 时 return — 球被隐藏（`display: none`）时仍然 re-clamp，确保下次显示时位置合法
  - `parseInt(container.style.top, 10)` 读取当前 Y 坐标，`|| window.innerHeight * 0.8` 作为解析失败 fallback
  - `container.style.right === '0px'` 判断当前停靠方向
  - `dockToEdge()` 内部的 `Math.max(50, Math.min(y, window.innerHeight - 50))` 自动 clamp 到新视口范围
  - `createOrb()` 是单实例（有 `if (container) return;` 守卫），监听器只会注册一次
  - 不需要 throttle — `dockToEdge()` 只做 style 赋值，无 layout read

**不要做的事**：
- 不要加 `container.style.display === 'none'` 的 early return
- 不要加 throttle / debounce
- 不要改 `dockToEdge()` 函数本身
- 不要改 `loadPosition()`、`onMouseDown`、`onMouseUp`、`toggleActive`
- 不要改 `syncVisibility()` / `init()` 函数
- 不要改 `updateMenuPositions()` 函数

## 不做的事

- **不做** 保存按钮的 tab 条件显隐 — 全局可见更简单
- **不做** 保存按钮 sticky 定位 — 当前页面内容不长，固定底部无必要
- **不做** 常规设置自动保存 — API key 类输入不适合 blur 自动保存，维持统一手动保存
- **不碰** popup.js、popup.html、sidebar.js、float-window.js、selection.js、immersive.js、menus.js、content.js、service-worker.js、message-router.js、tts.js、offscreen.js、storage.js、translator.js、ad-blocker.js、manifest.json、options.js

## 验证要求

- [x] `node --test tests/*.test.mjs` 全部通过
- [x] `node --check content/modules/floating-ball.js` 通过
- [x] `git diff --check` 无输出
- [x] 手动验证项已列入报告（本轮未执行，仅记录待人工点验项）：
  - Options 页面切到「常规设置」标签时保存按钮可见
  - 保存按钮与页面内容水平对齐
  - 悬浮球显示状态下缩小窗口后仍留在视口内
  - 悬浮球隐藏状态下缩小窗口，再重新显示时位置仍合法
