# 031 — `manifest.json` `web_accessible_resources` 最小权限清理执行报告

- 日期: 2026-03-13
- 状态: 已完成
- 对应任务: [031-manifest-web-accessible-cleanup.md](../tasks/031-manifest-web-accessible-cleanup.md)
- 对应讨论: [030-offscreen-promise-and-manifest-cleanup.md](../discussions/030-offscreen-promise-and-manifest-cleanup.md)

## 执行结果

### 已修改

- `manifest.json`
  - 删除整个 `web_accessible_resources` 节
  - 不再向网页公开 `src/*`
  - 结合当前 grep 结果，也一并停止公开 `assets/*`

- `tests/manifest-static.test.mjs`
  - 新增 `manifest does not expose internal resources through web_accessible_resources`
  - 直接读取并解析 `manifest.json`，锁住当前最小权限状态

### 过程说明

- 先按 task 要求运行资源加载 grep，确认 `content/`、`popup/`、`options/` 下都没有通过 `chrome.runtime.getURL()` 加载 `src/` 或 `assets/` 的调用
- 两条 grep 均无输出，因此按当前实现把整个 `web_accessible_resources` 节删除，而不是只删 `src/*`
- 随后补 `tests/manifest-static.test.mjs`，锁住 manifest 不再公开内部资源

## 验证

执行了：

```bash
rg -n "chrome\\.runtime\\.getURL\\([^\\n]*src/" content popup options
rg -n "chrome\\.runtime\\.getURL\\([^\\n]*assets/" content popup options
node --test tests/tts.test.mjs tests/manifest-static.test.mjs
node --test tests/google-tts.test.mjs tests/tts.test.mjs tests/manifest-static.test.mjs
node --test tests/*.test.mjs
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8'))"
git diff --check -- background/modules/tts.js manifest.json tests/tts.test.mjs tests/manifest-static.test.mjs docs/workbench/tasks/030-offscreen-promise-hygiene.md docs/workbench/reports/030-offscreen-promise-hygiene.md docs/workbench/tasks/031-manifest-web-accessible-cleanup.md docs/workbench/reports/031-manifest-web-accessible-cleanup.md
```

结果：

- `rg ...src/`：无输出
- `rg ...assets/`：无输出
- `node --test tests/tts.test.mjs tests/manifest-static.test.mjs`：`2/2` 通过
- `node --test tests/google-tts.test.mjs tests/tts.test.mjs tests/manifest-static.test.mjs`：`3/3` 通过
- `node --test tests/*.test.mjs`：`110/110` 通过
- `node -e "JSON.parse(...manifest.json...)"`：退出码 `0`
- `git diff --check -- ...`：无输出

## 结论摘要

1. 当前 manifest 不再把内部源码和资源公开给网页侧。
2. 基于现有代码搜索，删除整个 `web_accessible_resources` 节没有破坏当前资源加载路径。
3. manifest 仍可被正常解析。
