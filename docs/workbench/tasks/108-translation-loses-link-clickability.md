---
task: "108"
status: done
priority: P1
created: 2026-03-16
scope: "block-wrapper-only 翻译块继承原文链接"
---

# 108 — 翻译块继承原文链接

## 范围

新增 `wrapTranslationWithLink` helper，只在 block-wrapper 路径使用。cell-internal 和 inline 路径标注 residual risk（cell-internal 会破坏 own-artifact helper 语义）。

---

## 改动

### 1. 共享 helper

**文件：`content/modules/immersive.js`**

在 `injectTranslation` 函数之前添加：

```javascript
/**
 * 如果容器内恰好只有一个链接且非链接文本只剩空白/分隔符，
 * 将翻译元素包裹在同 href 的 <a> 中。否则原样返回。
 */
function wrapTranslationWithLink(container, translationEl) {
    const links = container.querySelectorAll('a[href]');
    if (links.length !== 1) return translationEl;

    const link = links[0];
    const linkText = link.textContent.trim();
    const fullText = container.textContent.trim();

    // 非链接文本只剩空白或轻量分隔符
    const nonLinkText = fullText.replace(linkText, '').replace(/[\s/\-·:,.|]+/g, '');
    if (nonLinkText.length > 0) return translationEl;

    const wrapper = document.createElement('a');
    wrapper.href = link.href;
    if (link.target) wrapper.target = link.target;
    if (link.rel) wrapper.rel = link.rel;
    if (link.download !== undefined && link.download !== '') wrapper.download = link.download;
    wrapper.className = 'st-immersive-translation-link';
    wrapper.appendChild(translationEl);
    return wrapper;
}
```

**判定逻辑**（Codex 审阅确定）：
1. 容器内**恰好只有一个** `a[href]`
2. 去掉链接文本后，剩余字符只有空白和轻量分隔符（`/ - · : , . |`）
3. 同步继承 `href` + `target` + `rel` + `download`

### 2. block-wrapper 路径接入

```javascript
// 改前
wrapper.appendChild(blockTransEl);

// 改后
wrapper.appendChild(wrapTranslationWithLink(container, blockTransEl));
```

### 3. cell-internal 路径 — 不改，标注 residual risk

cell-internal 路径的翻译是容器的 direct child `.st-immersive-translation`。如果包裹 `<a>`，direct child 变为 `.st-immersive-translation-link`，会破坏：
- `hasOwnTranslationArtifacts()` — 检测 direct child `.st-immersive-translation` 失真
- `getOwnCleanSourceText()` — 同上
- `removeOwnTranslationArtifacts()` — 同上
- 关闭清理 — 不删 `.st-immersive-translation-link`，留下空 `<a>` 壳

**不在本轮处理**。需要后续任务先扩展 artifact helper 支持 link wrapper。

### 4. inline 路径 — 不改，标注 residual risk

同 cell-internal，plus flex/grid 布局风险。

### 5. CSS

**文件：`content/content.css`**

```css
.st-immersive-translation-link {
    text-decoration: none;
    color: inherit;
}

.st-immersive-translation-link:hover {
    text-decoration: underline;
}
```

### 6. 关闭清理

`toggleImmersive` 关闭路径已有 `.st-immersive-wrapper, .st-immersive-translation` 清理。`.st-immersive-translation-link` 是 `.st-immersive-wrapper` 的子节点或 cell 内部的包裹层，随父级一起被删除。无需额外清理。

---

## 约束

1. **block-wrapper-only**：`wrapTranslationWithLink` 只在 block-wrapper 路径使用
2. **单链接判定**：容器内恰好 1 个 `a[href]` + 非链接文本只剩分隔符
3. **继承属性**：`href` + `target` + `rel` + `download`
4. **inline 路径不改**（residual risk）
5. **不改** EXCLUDE_SELECTORS
6. **不碰** options.*、popup.js、storage.js

---

## 测试

**文件：`tests/108-translation-link.test.mjs`**

### 静态断言

1. JS 包含 `wrapTranslationWithLink` 函数定义
2. JS block-wrapper 路径调用 `wrapTranslationWithLink`
3. JS cell-internal 路径**不调用** `wrapTranslationWithLink`（residual risk）
4. CSS 包含 `.st-immersive-translation-link`

### Runtime harness

5. **单链接容器 → 翻译被包裹在 `<a>` 中**：构造 `<h2><a href="/test">Title</a></h2>` → `injectTranslation` → 断言 wrapper 内有 `a.st-immersive-translation-link[href="/test"]`
6. **多链接容器 → 翻译不被包裹**：构造 `<p><a href="/a">A</a> and <a href="/b">B</a></p>` → `injectTranslation` → 断言无 `.st-immersive-translation-link`
7. **链接+大量非链接文本 → 不包裹**：构造 `<p>Long text <a href="/x">link</a> more text</p>` → 非链接文本去分隔符后 length > 0 → 不包裹
8. **cell-internal 不包裹**：构造 `<td><a href="/cell">Cell link</a></td>` → `injectTranslation` → 断言**无** `.st-immersive-translation-link`（cell 路径不接入）
9. **`target`/`rel` 继承**：构造 `<h2><a href="/ext" target="_blank" rel="noopener">Ext</a></h2>` → 断言翻译链接有 `target="_blank"` 和 `rel="noopener"`

全量 `node --test tests/*.test.mjs` 必须通过。

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `content/modules/immersive.js` | `wrapTranslationWithLink` helper + 两路径接入 |
| `content/content.css` | `.st-immersive-translation-link` 样式 |
| `tests/108-translation-link.test.mjs` | 静态 + runtime 测试 |

## 验证

- [x] `node --test tests/108-translation-link.test.mjs`
- [x] `node --test tests/*.test.mjs`
- [x] `node --check content/modules/immersive.js tests/108-translation-link.test.mjs`
- [x] `git diff --check`
