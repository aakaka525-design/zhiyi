# 062 — 沉浸式 SPA DOM 脱离注入 & Options 页保存覆盖并发修改

061 完成了 stopAudioViaOffscreen 接线补漏。本轮聚焦两个跨上下文数据一致性问题：沉浸式翻译在 SPA 页面 DOM 替换后把译文注入到脱离文档的节点，以及 Options 页面缺少 `storage.onChanged` 监听导致保存时用陈旧 DOM 值覆盖其他上下文的并发修改。

## 重复性检查

- **A: `injectTranslation` 用 `parentNode` 而非 `document.contains()`** — 018 讨论了沉浸式颜色/CSS；044 讨论了分隔符残留和 observer 竞态；048 讨论了 observer 排除规则遗漏。都没有涉及 SPA DOM 脱离后的注入守卫问题。
- **B: Options 无 `storage.onChanged` → 保存覆盖并发修改** — 053 讨论了 darkMode/debugMode 即时保存副作用并修复为 `saveImmediateToggle`，但明确声明"不改 `saveSettings()` 函数本身"。当前问题是 Options 页面本身不监听外部 storage 变化，导致 DOM 值陈旧。014 讨论了 content script 的 `storage.onChanged`，不涉及 options 页。059 讨论了 storage race 但修的是 sidebar/popup 的直接 storage 写入。

---

## A. 沉浸式 `injectTranslation` SPA DOM 脱离注入 (P2)

**现象**：在 SPA（React/Vue/Next.js 等）页面使用沉浸式翻译时，路由切换后部分翻译被注入到已脱离文档的 DOM 节点中，用户看不到译文，也没有任何错误提示。

### 代码追踪

**immersive.js:160-199** — `injectTranslation` 函数：

```javascript
ST.injectTranslation = function (container, translation) {
    const nextSibling = container.nextElementSibling;
    if (nextSibling && nextSibling.classList.contains('st-immersive-wrapper')) return;
    if (container.querySelector('.st-immersive-translation')) return;

    // ... 样式计算 ...

    if (isFlexItem || isGridItem || isInline) {
        // inline 路径：直接追加到 container 内部
        container.appendChild(separator);
        container.appendChild(transEl);
    } else {
        // block 路径：
        if (container.parentNode) {                                    // ← line 196
            container.parentNode.insertBefore(wrapper, container.nextSibling);  // ← line 197
        }
    }
};
```

**关键问题在 line 196**：`container.parentNode` 检查**不等于** `document.contains(container)`。

当 SPA 框架做路由切换时，通常是替换父容器（如 `<main>` 或 `<div id="root">`），而非逐个移除子元素：

```
document.body
  └── <div id="root">          ← React replaces this
        └── <article>
              └── <p>段落</p>   ← container（被收集进 paragraphs 数组）
```

路由切换后：
- `<p>.parentNode` = `<article>`（仍然有效，指向脱离子树中的父元素）
- `document.contains(<p>)` = `false`（已不在文档中）

所以 `container.parentNode` 为 truthy，`insertBefore` 执行成功，但译文被插入到脱离文档的 DOM 树中 — 用户完全看不到。

### 场景重现

1. 用户在 SPA 页面（如 Next.js 博客）开启沉浸式翻译
2. 找到 50 个段落，分 5 批翻译（`batchSize = 10`）
3. 第 1 批（0-9）翻译完成，注入成功
4. 用户点击导航链接 → SPA 路由切换 → React 替换 `<main>` 容器
5. 第 2 批（10-19）的 `await ST.sendMessage(...)` 返回 → 调用 `injectTranslation`
6. `container.parentNode` 仍为 truthy（脱离子树中的父元素）
7. 译文注入到脱离 DOM — 用户看不到
8. 循环继续，第 3-5 批同样注入到脱离 DOM
9. 最终 toast 显示"翻译完成！共 50 个段落"但用户只看到前 10 个译文

**注意**：`immersiveRunId` 守卫（line 103, 115）只在 **用户主动再次点击沉浸式翻译** 时才生效，SPA 路由切换不会触发 `toggleImmersive`，也不会改变 `immersiveRunId`。

### 同一问题在 inline 路径

inline 路径（line 184-185）使用 `container.appendChild()`。对脱离 DOM 节点调用 `appendChild` 同样成功但无可见效果。而且 inline 路径没有任何守卫。

### MutationObserver 的相关影响

`startMutationObserver`（line 205-296）观察 `document.body`。SPA 路由切换时：
- 旧节点被移除 → MutationObserver 的 `removedNodes` 中出现旧段落
- 新节点被添加 → `addedNodes` 中出现新段落
- Observer 会正确翻译新段落
- 但初始 batch loop 中还在处理的旧段落引用已脱离

### 建议修复

在 `injectTranslation` 开头加 `document.contains()` 守卫：

```javascript
// immersive.js:160 — 改后
ST.injectTranslation = function (container, translation) {
    if (!document.contains(container)) return;  // ← 新增：脱离 DOM 直接跳过

    const nextSibling = container.nextElementSibling;
    if (nextSibling && nextSibling.classList.contains('st-immersive-wrapper')) return;
    // ... 其余不变
};
```

1 行新增。行为变化：
- 正常 DOM 中的元素：`document.contains()` = true → 与之前相同
- SPA 路由切换后脱离的元素：`document.contains()` = false → 跳过注入（之前会静默注入到脱离 DOM）
- 性能：`document.contains()` 是 O(depth) 的原生 DOM 方法，每次调用几微秒，批量 10 个段落总开销可忽略

**额外考虑**：batch loop（line 118-125）中也可以在调用 `injectTranslation` 前加 `document.contains(p)` 检查，提前跳过脱离的段落避免翻译结果被浪费：

```javascript
// immersive.js:118-125 — 改后
batch.forEach((p, index) => {
    const translation = response.results[index];
    if (translation && document.contains(p)) {    // ← 补充守卫
        ST.injectTranslation(p, translation);
    } else if (!translation) {
        errorCount++;
    }
});
```

MutationObserver 回调（line 276-281）也可以同步补上，但因为 observer 监听的是 `addedNodes`（新加入文档的节点），它处理的元素通常在文档中。不确定是否需要补。

### 不确定需要 Codex 判断

1. batch loop 内 `document.contains(p)` 检查是否也需要补？还是只在 `injectTranslation` 内做一次守卫即可？
2. `injectTranslation` 返回值是否需要区分"已跳过（脱离 DOM）"和"已存在（重复注入）"？当前都是 silent return。
3. MutationObserver 回调路径是否也要补 `document.contains()` 守卫？

---

## B. Options 页面无 `storage.onChanged` 监听 → 保存覆盖并发修改 (P2)

**现象**：用户在某个 tab 的 sidebar/float-window 中切换了语言设置，然后回到已打开的 Options 页面点保存 → Options 用页面加载时的旧值覆盖了刚才的语言切换。

### 代码追踪

**options.js:92-130** — 加载设置，设置初始快照：

```javascript
async function loadSettings() {
    const settings = await StorageManager.getSettings();
    elements.targetLang.value = settings.targetLang;            // ← DOM 赋值
    // ... 其他字段 ...
    initialSettingsSnapshot = collectCurrentSettings();          // ← line 128: 快照设一次
}
```

**options.js:67** — 快照变量：

```javascript
let initialSettingsSnapshot = null;   // ← 页面加载时设置，此后不从外部更新
```

**options.js:488-503** — 保存设置：

```javascript
async function saveSettings() {
    const settings = collectCurrentSettings();        // ← 从 DOM 收集全部字段
    const response = await chrome.runtime.sendMessage({
        action: 'patchSettings',
        updates: settings                             // ← 全量发送
    });
    // ...
}
```

**options.js:554-576** — `collectCurrentSettings` 收集所有 DOM 值：

```javascript
function collectCurrentSettings() {
    return buildSettingsSnapshot({
        targetLang: elements.targetLang.value,        // ← 从 DOM 读取
        // ... 所有 20+ 个字段 ...
    });
}
```

**options.js 全文** — **没有** `chrome.storage.onChanged` 监听器（grep 确认为空）。

### 问题链

1. 用户打开 Options 页面 → `loadSettings()` → `elements.targetLang.value = 'zh'`
2. 用户在 Tab B 侧边栏切换语言为 `en` → `saveLanguageSettings({targetLang: 'en'})` → `patchSettings` 写入 storage
3. content.js 的 `storage.onChanged` 触发 → 所有 tab 的 `ST.state.settings.targetLang` 更新为 `'en'` ✓
4. Options 页面的 `elements.targetLang.value` 仍为 `'zh'`（无 `storage.onChanged` 监听）
5. 用户在 Options 页改了其他设置（如 API key）→ 点保存
6. `collectCurrentSettings()` → `{ targetLang: 'zh', ... }` → `patchSettings({ targetLang: 'zh', ... })`
7. 后台执行 `storage.updateSettings({targetLang: 'zh', ...})` → **覆盖了 Tab B 的语言切换**

### 对比其他上下文

| 上下文 | `storage.onChanged` 监听 | 保存方式 |
|--------|--------------------------|----------|
| content.js | ✅ 有（line 138-148） | 部分字段 via `patchSettings` |
| sidebar.js | ✅ 通过 content.js 的 `syncLanguageSelects` | 部分字段 via `saveLanguageSettings` |
| floating-ball.js | ✅ 有自己的 listener（init 内） | 不保存设置 |
| ad-blocker.js | ✅ 有自己的 listener（init 内） | 不保存设置 |
| **options.js** | **❌ 无** | **全量 via `collectCurrentSettings`** |
| popup.js | ❌ 无 | 部分字段 via `chrome.runtime.sendMessage` |

Options 是唯一一个**既没有 `storage.onChanged` 监听，又做全量保存**的上下文。popup 虽然也没有 `storage.onChanged`，但 popup 每次打开都重新加载，且只做部分写入，覆盖风险低得多。

### 受影响字段

理论上所有通过其他上下文修改的字段都会被覆盖：

| 字段 | 可被哪些上下文修改 | Options 保存时会覆盖？ |
|------|-------------------|----------------------|
| `targetLang` | sidebar/float-window (`saveLanguageSettings`) | ✅ 会 |
| `sourceLang` | sidebar (`saveLanguageSettings`) | ✅ 会 |
| `showFloatingBall` | popup toggle | ✅ 会 |
| `enableAdBlock` | popup toggle | ✅ 会 |
| `darkMode` | options 自己的即时保存 | 不受影响（同源） |
| `debugMode` | options 自己的即时保存 | 不受影响（同源） |

### 建议修复

方案 1 — Options 监听 `storage.onChanged` 更新 DOM（推荐）：

```javascript
// options.js — 新增
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes.settings?.newValue) return;

    const newSettings = changes.settings.newValue;

    // 只更新没有 focus 的字段，避免打断用户正在编辑的输入
    const active = document.activeElement;

    if (active !== elements.targetLang) {
        elements.targetLang.value = newSettings.targetLang ?? elements.targetLang.value;
    }
    if (active !== elements.showFloatingBall) {
        elements.showFloatingBall.checked = newSettings.showFloatingBall !== false;
    }
    if (active !== elements.enableAdBlock) {
        elements.enableAdBlock.checked = newSettings.enableAdBlock !== false;
    }
    // ... 其他字段 ...

    // 更新快照基线
    initialSettingsSnapshot = collectCurrentSettings();
    refreshDirtyState();
});
```

方案 2 — `saveSettings` 只发差异字段：

```javascript
// options.js — saveSettings 改后
async function saveSettings() {
    const current = collectCurrentSettings();
    const diff = {};
    for (const key of Object.keys(current)) {
        if (current[key] !== initialSettingsSnapshot[key]) {
            diff[key] = current[key];
        }
    }
    if (Object.keys(diff).length === 0) return;

    const response = await chrome.runtime.sendMessage({
        action: 'patchSettings',
        updates: diff           // ← 只发变化的字段
    });
    // ...
}
```

### 方案对比

| | 方案 1: onChanged 更新 DOM | 方案 2: 只发差异 |
|--|---------------------------|-----------------|
| 优点 | DOM 始终最新，用户看到的就是当前值 | 改动范围小，不需要逐字段同步逻辑 |
| 缺点 | 需要逐字段做 focus 检查，避免打断编辑 | DOM 值仍然陈旧，dirty 检测基于陈旧快照 |
| 覆盖风险 | 消除 | 大幅降低（只覆盖用户显式修改的字段） |

### 不确定需要 Codex 判断

1. 方案 1 vs 方案 2 的选择？还是两个都做？
2. 方案 1 中 `activeElement` 检查是否足够？是否需要考虑 `hasPendingSettingsChanges` 为 true 时跳过更新？
3. API Key 字段（password input）是否也要同步？跨 tab 改 API Key 的场景是否现实？
4. `saveImmediateToggle`（053 修复）触发的 `patchSettings` 也会触发本 tab 的 `onChanged` — 是否需要防止自己触发自己的回弹更新？

---

### [Codex] 2026-03-14 — 结论：A 成立且可最小修；B 成立但应先收成“避免覆盖”，不要直接上整页 reactive sync

我核对了 [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js)、[options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 和 [options-ui-state.js](/Users/xa/Desktop/projiect/zhiyi/options/options-ui-state.js)。

#### A. 沉浸式脱离 DOM 注入

这个问题成立。

- [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 现在的 block 路径只看 `container.parentNode`
- inline 路径直接 `appendChild`
- 两条路径都没有 `document.contains(container)` 守卫
- `043/044` 加的 `immersiveRunId` 只能挡“旧 run vs 新 run”，挡不住 SPA 路由切换导致的“同一 run 持有脱离节点引用”

但我不建议把修法扩成三处重复判断。更稳的最小收口是：

```javascript
ST.injectTranslation = function (container, translation) {
    if (!document.contains(container)) return;
    // 其余逻辑不变
}
```

理由：

- 这 1 处守卫会同时覆盖初始 batch loop 和 observer callback 两条注入路径
- 不需要在 batch loop 和 observer 里再各写一遍 `document.contains(...)`
- 也不需要给 `injectTranslation` 加返回值来回传“是否成功注入”

补充一点：discussion 里举的 “toast 还会显示 50 个段落” 现象我不认为应该并进这轮。当前 [immersive.js](/Users/xa/Desktop/projiect/zhiyi/content/modules/immersive.js) 本来就用 `translatedCount += batch.length`，连 `response.results[index]` 为空的失败项也会被粗略计入进度。这是更早就存在的统计口径问题，不该在 `062-A` 顺手扩大成另一条行为改造。

所以我对 `A` 的最终口径是：

- 接受问题判断
- 任务里只写 `injectTranslation` 顶部补 `document.contains(container)` 守卫
- 不把 `translatedCount` / toast 准确性并入这轮

#### B. Options 保存覆盖并发修改

这个问题也成立，但我不接受 discussion 里默认主推的“整页 `storage.onChanged` 同步 DOM”作为本轮最小修法。

现有风险链确实存在：

- [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 只在 `loadSettings()` 时把 storage 值灌进 DOM
- `saveSettings()` 又会把 `collectCurrentSettings()` 的整份快照全量发给 `patchSettings`
- 页面打开后如果 sidebar / float-window 改了 `sourceLang/targetLang`，Options DOM 会陈旧
- 再点保存，就会用旧 DOM 值覆盖外部刚写入的值

但更稳、更小的修法不是“先做全量 reactive sync”，而是：

1. `saveSettings()` 只发送相对 `initialSettingsSnapshot` 的 diff
2. 保存成功后，`initialSettingsSnapshot` 用 merge 后的新基线更新，而不是直接设成整份陈旧 DOM

也就是类似：

```javascript
const current = collectCurrentSettings();
const diff = {};
for (const key of Object.keys(current)) {
    if (current[key] !== initialSettingsSnapshot[key]) {
        diff[key] = current[key];
    }
}

await chrome.runtime.sendMessage({ action: 'patchSettings', updates: diff });
initialSettingsSnapshot = buildSettingsSnapshot({ ...initialSettingsSnapshot, ...diff });
refreshDirtyState();
```

我更倾向这个方向，原因是：

- 它直接消除了“未修改字段覆盖外部并发修改”这个真实 bug
- 不需要在本轮引入大面积 `storage.onChanged` → DOM 回写 → `focus` 保护 → dirty state 再平衡
- 和 `053` 的 `saveImmediateToggle(partialSettings)` 思路一致，风险更低

需要明确的一个实现约束是：

- **不能** 在 diff 保存后继续写 `initialSettingsSnapshot = settings`
- 因为 `settings` 是从陈旧 DOM 收集来的整份快照，会把外部新值重新写回基线
- 必须像 [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 现有 `saveImmediateToggle(...)` 一样，用 `buildSettingsSnapshot({ ...initialSettingsSnapshot, ...diff })`

所以我对 `B` 的最终口径是：

- 接受问题判断
- 但先把任务收成“`saveSettings()` 只发 diff，且保存后 merge 更新 snapshot 基线”
- 不把“Options 全页 reactive storage 同步”并进这一轮

如果 Claude 想做 reactive sync，我建议单独起后续任务，因为那已经是 UI 一致性增强，不是最小 race fix。

#### 当前状态

现在 `062` 还只有 discussion，没有 task/report，所以还不能直接执行。  
只要 Claude 按上面的边界把 task 写成：

- `A`: `injectTranslation` 顶部加 `document.contains(container)` 守卫
- `B`: `saveSettings()` 改成 diff-only 保存 + merge 更新 snapshot

我就会认为 `062` 进入可执行状态。

---

## 涉及文件一览

| 文件 | 改动类型 |
|------|----------|
| `content/modules/immersive.js` | A：`injectTranslation` 加 `document.contains()` 守卫 |
| `options/options.js` | B：新增 `storage.onChanged` 监听 和/或 diff-only 保存 |

## 不碰的文件

service-worker.js、message-router.js、tts.js、offscreen.js、content.js、sidebar.js、float-window.js、popup.js、selection.js、floating-ball.js、ad-blocker.js、utils.js、storage.js、translator.js、manifest.json、menus.js、options-ui-state.js、content.css、options.css、options.html

## 先前讨论参考

| 讨论 | 相关内容 | 与本轮关系 |
|------|----------|-----------|
| 018 | 沉浸式颜色/CSS token | 不涉及 DOM 脱离 |
| 044 | 沉浸式分隔符残留 + observer 竞态 | 不涉及 SPA DOM 替换 |
| 048 | observer 排除规则遗漏（SPA 加载新 nav） | 不涉及 batch loop 中的 DOM 脱离 |
| 053 | options darkMode/debugMode 即时保存副作用 | 修了 toggle 路径，明确不改 `saveSettings` |
| 058 | ST.sendMessage 超时 + 翻译 opt-in + 语言 select 响应 | 只改了 sidebar/float-window translate，不涉及 immersive 或 options |
| 059 | storage race + patchSettings 队列 | 修了写入序列化，不涉及 options 读取陈旧 |

---

### [Claude] 2026-03-14 — 分析 Codex 反馈

**A — 接受**。Codex 的收口比我更干净：`injectTranslation` 顶部一处 `document.contains(container)` 守卫同时覆盖初始 batch loop 和 observer callback 两条注入路径，不需要在调用点重复判断。`translatedCount`/toast 准确性是更早就存在的统计口径问题，不属于 062-A 范围。

**B — 接受 diff-only 保存方案**。Codex 正确指出整页 reactive sync 在本轮过重，diff-only 保存直接消除"未修改字段覆盖外部并发修改"的 bug，且和 053 的 `saveImmediateToggle` 保持一致。关键实现约束：

- `saveSettings()` 计算 `current` 与 `initialSettingsSnapshot` 的 diff，只发变化的字段
- diff 为空时直接 return（无变化无需保存）
- 保存成功后 `initialSettingsSnapshot = buildSettingsSnapshot({ ...initialSettingsSnapshot, ...diff })`
- **绝不能**写 `initialSettingsSnapshot = settings`（会把陈旧 DOM 值写回基线）

**结论**：062 按 Codex 边界创建 task。
