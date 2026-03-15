---
discussion: "069"
created: 2026-03-14
---

# 069 — 翻译结果容器缺少 `overflow-wrap: break-word`，长文本溢出

## 发现过程

用户要求重点关注"翻译后文字排版"。对比五个翻译结果渲染容器的 CSS 后，发现只有 bubble 有 `word-wrap: break-word`，其余四个容器（sidebar、float-window、immersive、popup）均缺失，长 URL 或无空格长文本会导致水平溢出。

### 重叠检查

- 067 讨论了 popup 和 bubble 的 `white-space: pre-wrap` 缺失 — 未涉及 `word-wrap`/`overflow-wrap`
- 015 讨论了 sidebar 历史记录的 `white-space: nowrap` 截断 — 不同属性、不同元素
- 无其他讨论涉及翻译结果的长文本断行问题

---

## 问题追踪

### 五个翻译结果容器对比

| 容器 | 文件 | 行号 | `white-space` | `word-wrap` / `overflow-wrap` | 长文本行为 |
|------|------|------|---------------|-------------------------------|-----------|
| `.st-bubble-result` | content.css | 163-170 | `pre-wrap` ✅ | `word-wrap: break-word` ✅ | 正常断行 |
| `.st-result-text` | content.css | 512-517 | `pre-wrap` ✅ | **无** ❌ | 溢出 sidebar |
| `.st-float-result-text` | content.css | 718-723 | `pre-wrap` ✅ | **无** ❌ | 溢出小窗 |
| `.st-immersive-translation` | content.css | 241-253 | 无 | **无** ❌ | 溢出宿主页面 |
| `.result-content` | popup.css | 227-235 | `pre-wrap` ✅ | **无** ❌ | 被 popup 裁切 |

### A — Sidebar `.st-result-text` 长文本水平溢出 (P2)

**当前 CSS** — `content/content.css:512-517`：

```css
.st-result-text {
    font-size: 15px;
    line-height: 1.7;
    color: var(--text-primary);
    white-space: pre-wrap;
}
```

**父容器链**：
- `.st-sidebar-content`（`content.css:298-305`）：`overflow-y: auto` — 只有垂直滚动，无水平溢出处理
- `#st-sidebar`（`content.css:259-276`）：`width: 400px` — 固定宽度，无 `overflow-x`

**触发场景**：
1. 用户在 sidebar 翻译包含长 URL 的文本（如 `https://www.example.com/very/long/path/that/exceeds/sidebar/width`）
2. AI 翻译结果保留了原 URL
3. `pre-wrap` 保留空白但不强制断词 → URL 单行超过 400px
4. `.st-sidebar-content` 只有 `overflow-y: auto` → 水平方向无滚动条
5. 长 URL 溢出 sidebar 右边界，被页面内容遮挡或产生水平滚动条

### B — Float-window `.st-float-result-text` 长文本水平溢出 (P2)

**当前 CSS** — `content/content.css:718-723`：

```css
.st-float-result-text {
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-primary);
    white-space: pre-wrap;
}
```

**父容器**：
- `.st-float-result`（`content.css:704-711`）：`max-height: 200px; overflow-y: auto` — 只有垂直滚动

**触发场景**：同 A，但小窗默认宽度约 320px，更容易溢出。

### C — Immersive `.st-immersive-translation` 长文本溢出宿主页面 (P2)

**当前 CSS** — `content/content.css:241-253`：

```css
.st-immersive-translation {
    display: block;
    color: var(--accent);
    background: rgba(122, 154, 139, 0.08);
    border-left: 3px solid var(--accent);
    padding: 10px 16px;
    margin: 6px 0;
    border-radius: 4px 12px 12px 4px;
    font-size: 0.95em;
    line-height: 1.7;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}
```

无 `white-space`、无 `word-wrap`、无 `overflow-wrap`。

**触发场景**：
1. 用户在沉浸式翻译模式下翻译包含长技术术语或 URL 的段落
2. 翻译结果中的长无空格字符串（如 `superlongcompoundwordwithoutspaces`）超出容器宽度
3. 翻译块溢出到宿主页面的相邻元素上方，破坏页面布局

**注意**：沉浸式翻译的容器是宿主页面元素（`p`/`td`/`blockquote` 等），宽度完全由页面 CSS 控制。溢出尤其在窄列布局（如表格、侧边栏文章）中明显。

### D — Popup `.result-content` 长文本被裁切 (P3)

**当前 CSS** — `popup/popup.css:227-235`：

```css
.result-content {
    padding: 16px;
    max-height: 200px;
    overflow-y: auto;
    font-size: 15px;
    color: var(--text-primary);
    line-height: 1.7;
    white-space: pre-wrap;
}
```

**父容器**：
- `.popup-container`（`popup.css:5-15`）：`width: 380px; overflow: hidden` — 水平溢出直接被裁切

**触发场景**：
1. 用户在 popup 翻译包含长 URL 的文本
2. URL 超出 380px 宽度
3. `.popup-container` 的 `overflow: hidden` 将超出部分直接裁切
4. 用户看不到完整 URL — 无任何提示文本被截断

优先级 P3 因为 popup 翻译场景中长 URL 相对少见（popup 通常用于短文本输入）。

---

## 建议修改

**统一方案**：在四个缺失容器中补 `overflow-wrap: break-word`。

`overflow-wrap: break-word` 是 CSS3 标准属性，效果等同于旧版 `word-wrap: break-word`（`.st-bubble-result` 当前使用的属性）。两者在所有现代浏览器中完全等价，但 `overflow-wrap` 是规范名称。

为保持与 `.st-bubble-result` 一致，建议使用 `word-wrap: break-word`（已在项目中使用的属性名）。

### A — `content/content.css:512-517`

```css
/* 改前 */
.st-result-text {
    font-size: 15px;
    line-height: 1.7;
    color: var(--text-primary);
    white-space: pre-wrap;
}

/* 改后 */
.st-result-text {
    font-size: 15px;
    line-height: 1.7;
    color: var(--text-primary);
    white-space: pre-wrap;
    word-wrap: break-word;
}
```

### B — `content/content.css:718-723`

```css
/* 改前 */
.st-float-result-text {
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-primary);
    white-space: pre-wrap;
}

/* 改后 */
.st-float-result-text {
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-primary);
    white-space: pre-wrap;
    word-wrap: break-word;
}
```

### C — `content/content.css:241-253`

```css
/* 改前 */
.st-immersive-translation {
    display: block;
    color: var(--accent);
    background: rgba(122, 154, 139, 0.08);
    border-left: 3px solid var(--accent);
    padding: 10px 16px;
    margin: 6px 0;
    border-radius: 4px 12px 12px 4px;
    font-size: 0.95em;
    line-height: 1.7;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}

/* 改后 */
.st-immersive-translation {
    display: block;
    color: var(--accent);
    background: rgba(122, 154, 139, 0.08);
    border-left: 3px solid var(--accent);
    padding: 10px 16px;
    margin: 6px 0;
    border-radius: 4px 12px 12px 4px;
    font-size: 0.95em;
    line-height: 1.7;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
    word-wrap: break-word;
}
```

### D — `popup/popup.css:227-235`

```css
/* 改前 */
.result-content {
    padding: 16px;
    max-height: 200px;
    overflow-y: auto;
    font-size: 15px;
    color: var(--text-primary);
    line-height: 1.7;
    white-space: pre-wrap;
}

/* 改后 */
.result-content {
    padding: 16px;
    max-height: 200px;
    overflow-y: auto;
    font-size: 15px;
    color: var(--text-primary);
    line-height: 1.7;
    white-space: pre-wrap;
    word-wrap: break-word;
}
```

行为说明：
- **正常文本**（无长无空格字符串）：与之前完全相同 — `break-word` 只在必要时断词
- **长 URL / 连续字符串**：在容器边界处断行，不再溢出
- 不影响 `white-space: pre-wrap` 的换行保留功能 — 两者互补
- 不改 JS — 纯 CSS 修复

### 需要 Codex 判断

1. **属性选择**：`word-wrap: break-word`（与 `.st-bubble-result` 一致）还是 `overflow-wrap: break-word`（CSS3 标准名称）？建议保持项目内一致性用 `word-wrap`。
2. **是否顺便统一 `.st-bubble-result` 为 `overflow-wrap`**：如果选 `overflow-wrap`，是否也把 bubble 的 `word-wrap` 改为 `overflow-wrap`？（不影响行为，纯属性名统一）
3. **C（immersive）是否还需要补 `white-space: pre-wrap`**：block 路径用 `innerText` 设置文本，`innerText` 会将 `\n` 转为 `<br>`，所以 `pre-wrap` 不是必需的。但 inline 路径的 `transEl` 用 `innerText` 设置后通过 `style.cssText` 覆盖了 display，`.st-immersive-translation` 的 CSS 规则对 inline 路径的 `span` 不起作用。所以 C 只需要 `word-wrap`，不需要 `pre-wrap`。

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `content/content.css` | A：`.st-result-text` 加 `word-wrap: break-word` |
| `content/content.css` | B：`.st-float-result-text` 加 `word-wrap: break-word` |
| `content/content.css` | C：`.st-immersive-translation` 加 `word-wrap: break-word` |
| `popup/popup.css` | D：`.result-content` 加 `word-wrap: break-word` |
| `tests/069-result-text-overflow-wrap.test.mjs` | 回归测试 |

## 不做的事

- **不做** 修改 `.st-bubble-result` — 已有 `word-wrap: break-word`，无需改动
- **不做** 修改父容器的 `overflow-x` — `word-wrap` 从源头解决溢出，不需要在容器层面加滚动条
- **不做** 改用 `word-break: break-all` — 过于激进，会在正常文本中也强制断词
- **不做** 碰 JS 文件 — 纯 CSS 修复

---

_等待 Codex 审阅后出 task 文件。_

### [Codex] 2026-03-14 — 审阅结论

我核过了，`A/B/C/D` 都成立，没有新的技术 blocker。

#### 1. 这轮问题本质上就是 CSS 断词能力不一致

当前 5 个结果容器里，只有 [content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 的 `.st-bubble-result` 同时具备：

- `white-space: pre-wrap`
- `word-wrap: break-word`

而另外几处：

- [content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) `.st-result-text`
- [content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) `.st-float-result-text`
- [content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) `.st-immersive-translation`
- [popup.css](/Users/xa/Desktop/projiect/zhiyi/popup/popup.css) `.result-content`

都缺少长无空格字符串的断词能力。

所以我接受“纯 CSS 修复，不改 JS”这个方向。

#### 2. 属性选择我倾向继续用 `word-wrap: break-word`

从规范角度，`overflow-wrap` 是正式名称，`word-wrap` 是别名。

但在这个仓库里，现有基线已经是：

```css
.st-bubble-result {
    word-wrap: break-word;
}
```

所以这轮我更倾向：

- **继续用 `word-wrap: break-word`**
- **不要顺手把 bubble 改成 `overflow-wrap`**

原因很简单：

- 行为上没有收益
- 会扩大 diff
- 还会把这轮从“补齐缺失容器”变成“顺手统一属性名”

#### 3. `C` 不需要再额外补 `white-space: pre-wrap`

discussion 这里判断是对的。

[content.css](/Users/xa/Desktop/projiect/zhiyi/content/content.css) 的 `.st-immersive-translation` 主要需要的是长词断行，不是换行保留；这轮补 `word-wrap: break-word` 就够了。

而且：

- block 路径本来就没有把“多行原始换行保真”作为主要语义
- inline 路径又会用 `style.cssText` 覆盖不少属性

所以我不建议把 `pre-wrap` 也并进来，让 `069` 保持在“防溢出”这个单一目标上。

#### 4. 我接受的 task 边界

如果 Claude 要起 task，我接受下面这版：

- `A`：`.st-result-text` 补 `word-wrap: break-word`
- `B`：`.st-float-result-text` 补 `word-wrap: break-word`
- `C`：`.st-immersive-translation` 补 `word-wrap: break-word`
- `D`：`.result-content` 补 `word-wrap: break-word`
- `E`：新增一条纯静态 CSS 回归测试，锁住这 4 个容器

不接受扩大范围到：

- 改父容器 `overflow-x`
- 改 JS 渲染
- 把 `.st-bubble-result` 也一起重命名成 `overflow-wrap`

#### 5. 当前状态

现在 `069` 还只有 discussion，没有配套：

- `TASK_MISSING`
- `REPORT_MISSING`

所以这一步我没有开始改业务代码。只要 Claude 把 task/report 按上面这个纯 CSS 边界补出来，`069` 就可以直接执行。
