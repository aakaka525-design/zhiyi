# 三分支合并到 main 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 dev/ux-fixes、fix/bugfix、feature/ui-update 三个分支整合到一个新集成分支，统一文档编号后合并到 main。

**Architecture:** 从 main 创建 `integrate/merge-all` 分支，按优先级依次合并三个分支。dev/ux-fixes 文档保持 021–029 编号不变；fix/bugfix 文档从 030 起重编号；feature/ui-update 文档从 040 起重编号。代码冲突逐文件手动解决。

**Tech Stack:** Git, JavaScript ES6 Modules, Chrome Extension (Manifest V3)

---

## 分支概况

| 分支 | 提交数 | 代码文件 | 文档编号 | 合并后编号 |
|------|--------|---------|---------|-----------|
| dev/ux-fixes | 4 | 55 | 021–029 | 021–029（不变） |
| fix/bugfix | 1 | 50 | 022–031 + 001 报告 | 030–039 + 001 报告 |
| feature/ui-update | 8 | 15 | 022–023 | 040–041 |

## 代码冲突文件清单

**三分支共改：**
- `content/content.css`
- `content/modules/float-window.js`

**dev/ux-fixes ∩ fix/bugfix：**
- `background/modules/message-router.js`
- `background/modules/tts.js`
- `content/modules/immersive.js`
- `content/modules/sidebar.js`
- `options/options-ui-state.js`
- `tests/content-ux-static.test.mjs`
- `tests/error-state-tts-lang.test.mjs`
- `tests/immersive-color-misc.test.mjs`
- `tests/options-ui-state.test.mjs`

**dev/ux-fixes ∩ feature/ui-update：**
- `options/theme.css`
- `popup/popup.js`

## fix/bugfix 文档重编号映射

| 原编号 | 新编号 | discussions | tasks | reports |
|--------|--------|------------|-------|---------|
| 001 | 001 | — | — | 001-docs-cleanup.md（新增） |
| 022 | 030 | 030-doc-completeness-audit | 030-doc-completeness-audit | 030-doc-completeness-audit |
| 023 | 031 | 031-content-tts-and-css-tokens | 031-content-tts-and-history-fix | 031-content-tts-and-history-fix |
| 024 | 032 | —（无） | 032-css-token-completion | 032-css-token-completion |
| 025 | 033 | 033-history-gap-and-batch-error | 033-sidebar-history-write | 033-sidebar-history-write |
| 026 | 034 | —（无） | 034-immersive-batch-error-count | 034-immersive-batch-error-count |
| 027 | 035 | 035-settings-trim-and-voice-dup | 035-settings-snapshot-trim | 035-settings-snapshot-trim |
| 028 | 036 | 036-sw-init-race-and-batch-fallback | 036-sw-ensureready-race | 036-sw-ensureready-race |
| 029 | 037 | —（无） | 037-translatebatch-fallback | 037-translatebatch-fallback |
| 030 | 038 | 038-offscreen-promise-and-manifest-cleanup | 038-offscreen-promise-hygiene | 038-offscreen-promise-hygiene |
| 031 | 039 | —（无） | 039-manifest-web-accessible-cleanup | 039-manifest-web-accessible-cleanup |

## feature/ui-update 文档重编号映射

| 原编号 | 新编号 | 名称 |
|--------|--------|------|
| 022 | 040 | ui-robustness-and-performance |
| 023 | 041 | ui-polish-and-architecture |

## 特殊文件处理

- `docs/reference/architecture.md` — fix/bugfix 新增 message-router 描述和 action 清单条目，CONVENTIONS 规定人工维护，需人工确认后保留
- `docs/reference/project-structure.md` — fix/bugfix 更新目录树和模块计数，需人工确认
- `manifest.json` — fix/bugfix 移除了 `web_accessible_resources` 段，需确认是否合理

---

### Task 1: 创建集成分支

**Files:** 无

**Step 1: 从 main 创建集成分支**

```bash
git checkout main
git checkout -b integrate/merge-all
```

**Step 2: 确认分支状态**

```bash
git log --oneline -1
```

Expected: 显示 `3b25309 Complete content UX and error-handling follow-ups`

---

### Task 2: 合并 dev/ux-fixes（第一优先）

**Files:** 55 个文件，文档 021–029 无需重编号

**Step 1: 合并 dev/ux-fixes**

```bash
git merge dev/ux-fixes -m "Merge dev/ux-fixes: CSS tokens, observer, TTS, popup, sidebar, float-window (021-029)"
```

Expected: 无冲突，fast-forward 或干净合并（dev/ux-fixes 的 base 就是 main HEAD）

**Step 2: 确认合并结果**

```bash
git log --oneline -5
ls docs/workbench/tasks/02*.md docs/workbench/tasks/021*.md
```

Expected: 能看到 021–029 文档

**Step 3: 提交（如果不是 fast-forward）**

如果 Step 1 已自动提交则跳过。

---

### Task 3: 准备 fix/bugfix 文档重编号

这一步在合并 fix/bugfix 之前，先在一个临时分支上重编号其文档，避免合并时产生编号冲突。

**Files:** fix/bugfix 分支上的 27 个文档文件

**Step 1: 从 fix/bugfix 创建临时分支**

```bash
git checkout fix/bugfix
git checkout -b temp/fix-bugfix-renumber
```

**Step 2: 重命名 discussions 文档**

```bash
cd docs/workbench/discussions
git mv 022-doc-completeness-audit.md 030-doc-completeness-audit.md
git mv 023-content-tts-and-css-tokens.md 031-content-tts-and-css-tokens.md
git mv 025-history-gap-and-batch-error.md 033-history-gap-and-batch-error.md
git mv 027-settings-trim-and-voice-dup.md 035-settings-trim-and-voice-dup.md
git mv 028-sw-init-race-and-batch-fallback.md 036-sw-init-race-and-batch-fallback.md
git mv 030-offscreen-promise-and-manifest-cleanup.md 038-offscreen-promise-and-manifest-cleanup.md
```

**Step 3: 重命名 tasks 文档**

```bash
cd ../tasks
git mv 022-doc-completeness-audit.md 030-doc-completeness-audit.md
git mv 023-content-tts-and-history-fix.md 031-content-tts-and-history-fix.md
git mv 024-css-token-completion.md 032-css-token-completion.md
git mv 025-sidebar-history-write.md 033-sidebar-history-write.md
git mv 026-immersive-batch-error-count.md 034-immersive-batch-error-count.md
git mv 027-settings-snapshot-trim.md 035-settings-snapshot-trim.md
git mv 028-sw-ensureready-race.md 036-sw-ensureready-race.md
git mv 029-translatebatch-fallback.md 037-translatebatch-fallback.md
git mv 030-offscreen-promise-hygiene.md 038-offscreen-promise-hygiene.md
git mv 031-manifest-web-accessible-cleanup.md 039-manifest-web-accessible-cleanup.md
```

**Step 4: 重命名 reports 文档**

```bash
cd ../reports
# 001 保持不变（main 上无 001 report，不冲突）
git mv 022-doc-completeness-audit.md 030-doc-completeness-audit.md
git mv 023-content-tts-and-history-fix.md 031-content-tts-and-history-fix.md
git mv 024-css-token-completion.md 032-css-token-completion.md
git mv 025-sidebar-history-write.md 033-sidebar-history-write.md
git mv 026-immersive-batch-error-count.md 034-immersive-batch-error-count.md
git mv 027-settings-snapshot-trim.md 035-settings-snapshot-trim.md
git mv 028-sw-ensureready-race.md 036-sw-ensureready-race.md
git mv 029-translatebatch-fallback.md 037-translatebatch-fallback.md
git mv 030-offscreen-promise-hygiene.md 038-offscreen-promise-hygiene.md
git mv 031-manifest-web-accessible-cleanup.md 039-manifest-web-accessible-cleanup.md
```

**Step 5: 更新文档内部引用**

在每个重命名的文档中，搜索并替换旧编号引用为新编号。主要是文档间的交叉引用（如 "见 022 任务" → "见 030 任务"）。

```bash
cd /Users/xa/Desktop/projiect/zhiyi
# 用 sed 批量替换文档内编号引用
# 注意：只替换 docs/workbench/ 下刚重命名的文件
```

逐文件检查并更新内部引用。

**Step 6: 提交重编号**

```bash
git add -A docs/workbench/
git commit -m "Renumber fix/bugfix docs: 022-031 → 030-039"
```

---

### Task 4: 合并重编号后的 fix/bugfix

**Files:** 冲突文件见上方清单

**Step 1: 切回集成分支并合并**

```bash
git checkout integrate/merge-all
git merge temp/fix-bugfix-renumber -m "Merge fix/bugfix (renumbered 030-039): docs audit, content TTS, SW init, translator batch"
```

Expected: 产生冲突，需手动解决以下文件：
- `content/content.css`
- `content/modules/float-window.js`
- `background/modules/message-router.js`
- `background/modules/tts.js`
- `content/modules/immersive.js`
- `content/modules/sidebar.js`
- `options/options-ui-state.js`
- `tests/content-ux-static.test.mjs`
- `tests/error-state-tts-lang.test.mjs`
- `tests/immersive-color-misc.test.mjs`
- `tests/options-ui-state.test.mjs`

**Step 2: 解决每个冲突文件**

逐文件打开，查看 `<<<<<<<` 标记，原则：
- **保留双方改动**，两个分支的修改通常是不同区域的增量
- 如果同一行被双方修改，优先保留 dev/ux-fixes 的版本（已在集成分支中）
- 特别注意 `content/content.css` 可能有大量上下文变化，需仔细对齐

**Step 3: 处理特殊文件**

- `docs/reference/architecture.md` — 保留 fix/bugfix 的改动（新增 message-router 描述），待后续人工确认
- `docs/reference/project-structure.md` — 保留 fix/bugfix 的改动（更新目录树），待后续人工确认
- `manifest.json` — 保留 fix/bugfix 移除 `web_accessible_resources` 的改动，待后续人工确认

**Step 4: 标记解决并提交**

```bash
git add -A
git commit -m "Resolve conflicts: merge fix/bugfix into integrate/merge-all"
```

**Step 5: 运行测试**

```bash
npx vitest run 2>&1 | tail -20
```

Expected: 全部测试通过

---

### Task 5: 准备 feature/ui-update 文档重编号

**Files:** feature/ui-update 分支上的 6 个文档文件

**Step 1: 从 feature/ui-update 创建临时分支**

```bash
git checkout feature/ui-update
git checkout -b temp/feature-ui-renumber
```

**Step 2: 重命名 discussions**

```bash
cd docs/workbench/discussions
git mv 022-ui-robustness-and-performance.md 040-ui-robustness-and-performance.md
git mv 023-ui-polish-and-architecture.md 041-ui-polish-and-architecture.md
```

**Step 3: 重命名 tasks**

```bash
cd ../tasks
git mv 022-ui-robustness-and-performance.md 040-ui-robustness-and-performance.md
git mv 023-ui-polish-and-architecture.md 041-ui-polish-and-architecture.md
```

**Step 4: 重命名 reports**

```bash
cd ../reports
git mv 022-ui-robustness-and-performance.md 040-ui-robustness-and-performance.md
git mv 023-ui-polish-and-architecture.md 041-ui-polish-and-architecture.md
```

**Step 5: 更新文档内部引用**

检查并更新 022→040、023→041 的交叉引用。

**Step 6: 提交重编号**

```bash
cd /Users/xa/Desktop/projiect/zhiyi
git add -A docs/workbench/
git commit -m "Renumber feature/ui-update docs: 022-023 → 040-041"
```

---

### Task 6: 合并重编号后的 feature/ui-update

**Files:** 冲突文件：content/content.css, content/modules/float-window.js, options/theme.css, popup/popup.js

**Step 1: 切回集成分支并合并**

```bash
git checkout integrate/merge-all
git merge temp/feature-ui-renumber -m "Merge feature/ui-update (renumbered 040-041): UI robustness, polish, focus-visible, disabled states"
```

Expected: 产生冲突：
- `content/content.css` — 三方合并（已含 dev/ux-fixes + fix/bugfix 的改动）
- `content/modules/float-window.js` — 三方合并
- `options/theme.css` — 双方改动
- `popup/popup.js` — 双方改动

**Step 2: 解决冲突**

同 Task 4 原则。feature/ui-update 的改动主要是：
- CSS: focus-visible 样式、disabled 状态、text-tertiary 对比度修正
- float-window: 事件监听增强
- theme.css: over-limit 类样式
- popup.js: updateCharCount 重构、setLoading 增加 disabled 控制

**Step 3: 提交**

```bash
git add -A
git commit -m "Resolve conflicts: merge feature/ui-update into integrate/merge-all"
```

**Step 4: 运行测试**

```bash
npx vitest run 2>&1 | tail -20
```

Expected: 全部测试通过

---

### Task 7: 最终验证

**Step 1: 确认文档编号连续无冲突**

```bash
ls docs/workbench/tasks/ | grep -E '^[0-9]' | sort
```

Expected: 001–041 编号无重复，无缺失（允许有间隔如 002–020 原有的）

**Step 2: 确认无遗漏文件**

```bash
git diff main --stat | wc -l
```

Expected: 应包含三个分支的所有改动

**Step 3: 运行全部测试**

```bash
npx vitest run
```

Expected: 全部通过

**Step 4: 检查 CONVENTIONS 合规**

- 确认 `docs/workbench/` 外无 Agent 创建的 .md 文件（docs/reference/ 改动需人工确认标注）
- 确认 manifest.json 改动合理

---

### Task 8: 合并到 main

**Step 1: 切到 main 合并**

```bash
git checkout main
git merge integrate/merge-all -m "Integrate dev/ux-fixes + fix/bugfix + feature/ui-update (docs 021-041)"
```

**Step 2: 确认 main 状态**

```bash
git log --oneline -10
npx vitest run
```

Expected: 合并完成，测试通过

**Step 3: 清理临时分支**

```bash
git branch -d temp/fix-bugfix-renumber
git branch -d temp/feature-ui-renumber
git branch -d integrate/merge-all
```

---

### Task 9（可选）: 清理已合并分支

确认 main 包含所有内容后：

```bash
git branch -d dev/ux-fixes
git branch -d fix/bugfix
git branch -d feature/ui-update
```

> ⚠️ 此步骤需用户确认后执行
