---
status: done
priority: P3
created: 2026-03-13
discussion: 030-offscreen-promise-and-manifest-cleanup
---

# 031 — `manifest.json` `web_accessible_resources` 最小权限清理

## 背景

030 讨论确认：`web_accessible_resources` 中的 `src/*` 和 `assets/*` 均无必要暴露给网页。`chrome.runtime.getURL()` 调用点均在扩展页面（background / popup），不需要 `web_accessible_resources` 即可访问。

---

## 任务 A：移除 `web_accessible_resources` 中的 `src/*`

**文件**：`manifest.json:58-68`

**当前**：

```json
"web_accessible_resources": [
    {
        "resources": ["assets/*", "src/*"],
        "matches": ["<all_urls>"]
    }
]
```

**修复**：移除 `src/*`。如果 grep 确认 `assets/*` 也不需要，则整个 `web_accessible_resources` 节可以删除。

### 验证步骤（执行前必做）

运行 grep 确认没有 content script 或网页侧代码通过 `chrome.runtime.getURL` 加载 `src/` 或 `assets/` 资源：

```bash
grep -rn "getURL.*src/" content/ popup/ options/
grep -rn "getURL.*assets/" content/ popup/ options/
```

如果 grep 结果为空，可以安全删除整个 `web_accessible_resources`。

---

## 不做的事

- 不改 tts.js（独立 task 030）
- 不改任何 JS 文件
- 不碰 permissions 或 host_permissions

---

## 验收标准

- [x] `manifest.json` 的 `web_accessible_resources` 移除 `src/*`
- [x] 如果 grep 确认 `assets/*` 也无需暴露，一并移除整个 `web_accessible_resources` 节
- [x] grep 证据记录在 commit message 或 report 中
- [x] 扩展加载无报错（manifest 解析通过）
