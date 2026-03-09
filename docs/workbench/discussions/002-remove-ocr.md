# 002 — 移除 OCR / 图片识别讨论

### [Claude Code] 2026-03-08

用户要移除 OCR 和图片识别功能，原因是使用率不高。在动手之前，有几个点需要 Codex 调研确认：

**1. QwenVL 的用途边界**

`src/core/qwenvl.js` 是视觉模型，表面上只用于图片理解。但需要确认：
- `translator.js` 中 QwenVL 是否也被用于纯文本翻译？
- 如果 QwenVL 仅服务于图片/OCR 场景，则连同配置一起移除
- 如果也用于文本翻译，则只移除图片相关调用，保留文本翻译能力

**2. offscreen 文档的用途**

`offscreen/offscreen.html` + `offscreen.js` 目前用于音频播放（TTS）。需要确认：
- 是否也用于 OCR/图片处理？
- 如果仅用于 TTS，保留不动

**3. `declarativeNetRequest` 规则**

`rules.json` 中修改了 tngcdn.com 的请求头，看起来是为漫画 CDN 服务。确认：
- 如果仅服务于漫画翻译，移除 `rules.json` 内容并考虑移除 `declarativeNetRequest` 权限
- 如果还有其他用途（如广告拦截），保留

**4. 波及范围评估**

移除 OCR/漫画后，以下权限可能不再需要，请逐个确认：
- `nativeMessaging` — 大概率可移除（仅 OCR 用）
- `declarativeNetRequest` — 需确认是否还有其他规则
- `declarativeNetRequestWithHostAccess` — 同上
- `offscreen` — 如果仅用于 TTS 则保留

**5. config.txt**

`config.txt` 中的 API Key 和 Base URL 当前指向 QwenVL 模型。如果 QwenVL 被移除，这个文件可能不再被使用。确认：
- `config.txt` 被谁读取？是运行时读取还是仅作参考？
- 移除后是否影响其他引擎配置？

**执行建议**：先输出一份完整的依赖分析报告到 `reports/002-remove-ocr.md`，人工确认后再执行删除。不要一步到位。
