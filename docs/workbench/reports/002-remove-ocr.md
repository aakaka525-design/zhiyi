# 002 — 移除 OCR / 图片识别依赖分析报告

- 日期: 2026-03-08
- 状态: 已完成依赖分析，并于 2026-03-09 执行删除
- 对应任务: [002-remove-ocr.md](../tasks/002-remove-ocr.md)
- 对应讨论: [002-remove-ocr.md](../discussions/002-remove-ocr.md)

## 执行结果（2026-03-09）

### 已删除

- `native-host/` 整个目录
- `rules.json`
- `background/modules/general_image.js`
- `background/modules/manga.js`
- `content/modules/ocr.js`
- `content/modules/manga.js`
- `content/modules/translation-cache.js`
- `src/core/native-ocr.js`
- `src/core/ocr.js`
- `src/core/qwenvl.js`

### 已修改

- `manifest.json`
  - 移除了 `content/modules/ocr.js`、`content/modules/manga.js`、`content/modules/translation-cache.js`
  - 移除了 `nativeMessaging`、`declarativeNetRequest`、`declarativeNetRequestWithHostAccess`
  - 移除了 `declarative_net_request.rule_resources`
- `background/service-worker.js`
  - 移除了图片 / 漫画 / Native OCR 消息分发
- `background/modules/menus.js`
  - 移除了右键图片翻译入口
- `content/content.js`
  - 移除了 `ocrImage`、`startOCR`、`toggleMangaMode` 消息处理
- `content/modules/state.js`
  - 移除了漫画专属状态，保留沉浸式翻译仍在使用的 `pendingTranslations`
- `content/modules/floating-ball.js`
  - 移除了漫画按钮
- `content/content.css`
  - 移除了图片覆盖层 / 漫画嵌字相关样式
- `popup/popup.html` / `popup/popup.js`
  - 移除了图片翻译和漫画翻译入口
- `options/options.html` / `options/options.js`
  - 移除了 OCR、漫画翻译、Native Host、自定义漫画 API 相关配置与测试入口
- `src/core/storage.js`
  - 移除了 OCR / 漫画默认配置，并对历史遗留键做清理
- `src/core/translator.js`
  - 移除了 `QwenVL` provider 注册
- `src/core/deepseek.js` / `src/core/gemini.js`
  - 移除了已无调用方的图片 / 漫画翻译方法
- 正式文档
  - 已同步移除 OCR / 漫画 / Native Host 的说明，并将 `native-host-setup.md` 改为已移除说明

### 保留

- `offscreen/` 与 TTS 链路
- 文本翻译、沉浸式翻译、PDF 入口、广告拦截

### 验证

- `node --check $(find background content popup options src -name '*.js' -type f | sort)` 通过
- 全仓搜索确认 OCR / 漫画 / Native Host 的运行时入口已移除；剩余匹配仅存在于“已移除”说明或历史兼容清理逻辑中
- `native-host/` 目录已不存在

## 结论摘要

1. `native-host/` 整体是 OCR / 漫画翻译专用依赖面，当前未发现扩展其他功能对它的运行时调用。移除 OCR、图片翻译、漫画翻译后，可以整体下线。
2. `background/modules/general_image.js` 与漫画 / Native Host 相互独立，但它只服务图片翻译入口；如果用户要移除“图片识别翻译”，该模块应一并删除。
3. `offscreen/` 只用于 TTS 音频播放，不参与 OCR、图片识别或漫画翻译。移除 OCR 后应保留。
4. `rules.json` 只包含 `tngcdn.com` 请求头改写规则，仓库内未发现其他 `declarativeNetRequest` 规则或动态规则代码。若漫画翻译一起移除，可同步移除 `rules.json`、`declarativeNetRequest`、`declarativeNetRequestWithHostAccess`。
5. `src/core/qwenvl.js` 虽然实现了文本翻译接口，但当前产品没有把 `qwenvl` 暴露为默认文本翻译 provider；它的实际可达用法集中在漫画翻译和混合模式。若移除 OCR / 图片 / 漫画功能，建议连同 `src/core/qwenvl.js` 一并移除，并清理 `translator.js` 中的注册代码。
6. `DeepSeek` 不能整体删除。它仍是文本翻译默认可选引擎之一，见 `options/options.html:189-194`、`src/core/translator.js:26-32`。但 `deepseek.js` 中的图片 / 漫画方法会在 OCR 移除后变成死代码，可作为后续清理项。
7. `config.txt` 的运行时读取方是 Python 侧 `native-host/utils/ai_service.py:7-43`，供本地 OCR 混合模式 / HTTP API 回退使用。若 `native-host/` 与 QwenVL OCR 路径一起下线，扩展前端将不再有运行时消费者；但按约定本轮不应改动 `config.txt` 本身。

## 回答讨论中的 5 个确认点

### 1. QwenVL 的用途边界

- 代码能力上，`src/core/qwenvl.js:23-76` 实现了文本翻译，`79-218` 实现了图片 / 漫画翻译。
- 运行时接入上，`src/core/translator.js:26-32` 注册了 `qwenvl` provider，`59-63` 会刷新其配置。
- 但产品入口上，Options 的默认翻译引擎只有 `google/openai/gemini/deepseek/offline`，没有 `qwenvl`，见 `options/options.html:189-194`。
- 仓库里对 `qwenvl` 的实际可达引用集中在漫画链路与混合模式配置，见:
  - `background/modules/manga.js:227-272`
  - `options/options.html:313-337`
  - `options/options.js:99-121`
  - `options/options.js:350-391`

结论:
- `QwenVL` 不是当前产品的独立文本翻译入口。
- 若按任务范围移除 OCR / 图片翻译 / 漫画翻译，`src/core/qwenvl.js` 可以一起删除。
- 同时必须修改 `src/core/translator.js`，移除 import、provider 注册和 `refreshSettings()` 中的 `qwenvl` 更新逻辑。

### 2. offscreen 文档是否也用于 OCR

- `offscreen/offscreen.js:6-23` 只监听 `playAudio`，并通过 `Audio` 播放数据 URL。
- `background/modules/tts.js:6-29` 创建 offscreen document 的理由明确是 `AUDIO_PLAYBACK`。
- 全仓未发现 OCR / 图片识别调用 `offscreen` 的代码。

结论:
- `offscreen/` 仅服务 TTS。
- 移除 OCR 不应删除 `offscreen/`。

### 3. `declarativeNetRequest` / `rules.json` 是否仅服务漫画

- `rules.json:1-27` 只有一条规则，专门把 `tngcdn.com` 请求改写为 `https://www.toongod.org/` 来源。
- 仓库内未发现其他 `declarativeNetRequest` 规则、`updateDynamicRules` 或 `updateSessionRules` 调用。
- 扩展的图片 / 漫画翻译路径会直接抓取远程图片，见 `background/modules/general_image.js:12-47` 与 `background/modules/manga.js:281-301`；该规则的语义明显偏向漫画站图片防盗链兼容。
- `content/modules/ad-blocker.js` 虽然包含 `manga-ad` 等站点选择器，但没有 OCR / 图片识别逻辑，也不依赖 DNR API。

结论:
- 当前 DNR 规则只服务漫画图片站点兼容。
- 如果漫画翻译一起删除，可以移除:
  - `rules.json`
  - `manifest.json:58-59` 的 `declarativeNetRequest` / `declarativeNetRequestWithHostAccess`
  - `manifest.json:64-71` 的 `declarative_net_request.rule_resources`
- 广告拦截模块应保留，但它会退化为纯内容脚本 DOM 清理。

### 4. 权限波及范围

- `manifest.json:42-43` 把 `content/modules/manga.js` 和 `content/modules/ocr.js` 注入到所有页面。
- `manifest.json:56-59` 当前权限中，OCR 直接相关的是:
  - `offscreen`
  - `nativeMessaging`
  - `declarativeNetRequest`
  - `declarativeNetRequestWithHostAccess`
- 对这些权限的判断如下:
  - `nativeMessaging`: 仅 `src/core/native-ocr.js:56-71` 使用，可随 OCR 删除。
  - `offscreen`: 由 TTS 使用，必须保留。
  - `declarativeNetRequest` / `declarativeNetRequestWithHostAccess`: 仅 `rules.json` 使用，可随漫画翻译删除。
  - `scripting`: 与 OCR 移除无直接关系，当前仓库也未见实际使用；属于单独的权限收缩问题。

结论:
- OCR 删除后，可确认移除 `nativeMessaging`。
- 若漫画翻译一并删除，可确认移除 `declarativeNetRequest` 与 `declarativeNetRequestWithHostAccess`。
- `offscreen` 需要保留。

### 5. `config.txt` 被谁读取

- 扩展前端不会直接读取 `config.txt`。
- 运行时读取方只有 Python 侧 `native-host/utils/ai_service.py:7-43`。
- `background/modules/manga.js:150-170` 只是提示“若没取到 `deepseekApiKey` 将尝试使用 `config.txt`”，真正的 fallback 读取发生在 Python 侧。
- `native-host/api_server.py:89-128` 会调用 `translate_crop_ai()`，因此 HTTP API 也依赖同一份配置回退。

结论:
- `config.txt` 不是普通文本翻译功能的运行时依赖。
- 当 `native-host/` 与本地混合 OCR 路径移除后，`config.txt` 将不再被应用运行时消费。
- 但按项目约定，本轮只报告，不修改该文件。

## 运行时依赖图

### A. 图片翻译入口

1. Popup 按钮:
   - `popup/popup.js:202-216` 发送 `startOCR`
   - `content/content.js:68-70` 调用 `ST.startImageAreaSelection()`
   - `content/modules/ocr.js:301-302` 当前只弹提示
2. 右键菜单:
   - `background/modules/menus.js:18-23` 创建 `translate-image`
   - `background/modules/menus.js:60-66` 发送 `ocrImage`
   - `content/content.js:62-65` 调用 `ST.handleOCR(imageUrl)`
3. 内容脚本 OCR:
   - `content/modules/ocr.js:32-47` 走 `translateImageUrl`
4. 后台消息:
   - `background/service-worker.js:59-63` 分发到 `background/modules/general_image.js`
5. 图片翻译后台:
   - `background/modules/general_image.js:4-58` 调用 `translator.providers[provider].translateImage(...)`

影响判断:
- 这条链路完全属于“图片识别翻译”范围，可整体删除。

### B. 漫画翻译入口

1. Popup 按钮:
   - `popup/popup.js:255-260` 发送 `toggleMangaMode`
2. 内容脚本入口:
   - `content/content.js:80-82` 调用 `ST.toggleMangaMode()`
3. 漫画模式前端:
   - `content/modules/manga.js:20-124` 负责观察图片、入队、监听 DOM
   - `content/modules/manga.js:129-168` 处理翻译队列
   - `content/modules/manga.js:156-158` 最终调用 `ST.handleOCR(src, img)`
4. OCR 覆盖层:
   - `content/modules/ocr.js:104-119` 发送 `translateMangaImage`
5. 后台漫画处理:
   - `background/service-worker.js:65-66`
   - `background/modules/manga.js:6-27`

影响判断:
- 这条链路是漫画翻译主链，删除 OCR / 漫画时应整体下线。

### C. Native Host / 本地 OCR 链路

1. Options 测试入口:
   - `options/options.js:350-379` 通过 `testNativeOCR` 测试本地 OCR
   - `background/service-worker.js:68-79` 调用 `nativeOCR.checkAvailability()`
2. Native Messaging 客户端:
   - `src/core/native-ocr.js:56-71` 使用 `chrome.runtime.sendNativeMessage`
   - `81-150` 暴露 `detectText` / `detectRegionsOnly` / `detectTextAI`
3. 本地漫画 OCR 后台:
   - `background/modules/manga.js:34-45` 使用 `paddleocr_vl`
   - `99-112` 使用 `smol_docling`
   - `168-170` 使用 `detectTextAI`
   - `194-200` 使用 `detectText`
4. Python 侧:
   - `native-host/ocr_host.py` 是 Native Messaging 主机
   - `native-host/api_server.py:46-149` 是独立 HTTP 漫画翻译 API
   - `native-host/utils/ai_service.py:39-92` 是 AI OCR 翻译回退逻辑

影响判断:
- Native Host 与本地模型目录没有发现被文本翻译、TTS、侧边栏、沉浸式翻译复用。
- 该目录可以视为 OCR 专属子系统。

## 文件级处置建议

### 可确认整体删除

- `native-host/`
  - 依据: 只服务本地 OCR / 漫画翻译；未发现其他功能调用。
- `content/modules/ocr.js`
  - 依据: 只处理图片 OCR / 漫画覆盖层。
- `content/modules/manga.js`
  - 依据: 只处理漫画模式。
- `background/modules/manga.js`
  - 依据: 只处理漫画翻译。
- `background/modules/general_image.js`
  - 依据: 只处理图片翻译。
- `src/core/native-ocr.js`
  - 依据: 只封装 Native Messaging OCR。
- `src/core/ocr.js`
  - 依据: 现有运行时未发现任何 import / 调用，已经是死代码；仅文档仍引用。

### 条件删除

- `src/core/qwenvl.js`
  - 条件: 用户确认 OCR / 图片翻译 / 漫画翻译全部移除。
  - 原因: 当前没有独立文本翻译入口选用 `qwenvl`，可达用途集中在 OCR / 漫画。
- `rules.json`
  - 条件: 漫画翻译一起删除。
  - 原因: 当前唯一规则是漫画 CDN 兼容规则。

### 必须修改

- `manifest.json`
  - 去掉 `content/modules/manga.js`、`content/modules/ocr.js`
  - 去掉 `nativeMessaging`
  - 如删除漫画，再去掉 DNR 权限和 `rule_resources`
- `background/service-worker.js`
  - 删除 `nativeOCR` import
  - 删除 `handleMangaImage` / `handleTranslateImageUrl` / `handleTranslateImage`
  - 删除 `testNativeOCR`
- `background/modules/menus.js`
  - 删除图片翻译右键菜单项
- `content/content.js`
  - 删除 `ocrImage` / `startOCR` / `toggleMangaMode` 的消息分支
- `content/modules/state.js`
  - 删除 `translatedImages`、`pendingTranslations`、`mangaQueue`、`observers.manga`
- `popup/popup.js`
  - 删除 `btnOcr`、`btnManga` 行为
- `popup/popup.html`
  - 删除“图片翻译”“漫画翻译”按钮
- `options/options.html`
  - 删除漫画翻译设置、本地 OCR 检测器、自定义漫画 API 区域
  - 调整 `ppinfra` 文案，不再把它描述为 Qwen-VL / 图片翻译配置
- `options/options.js`
  - 删除对应 DOM 引用、加载逻辑、保存逻辑和 `testMangaEngine()`
- `src/core/storage.js`
  - 删除 `mangaOcrEngine`、`ocrDetectorType`、`customMangaApiKey`、`customMangaBaseUrl`、`customMangaModel`、`mangaFontStyle`
  - 重新审视 `deepseekModel` 默认值命名文案
- `src/core/translator.js`
  - 删除 `QwenVLTranslator` import、provider 注册、刷新逻辑

### 建议保留

- `offscreen/`
  - 仅 TTS 使用。
- `background/modules/tts.js`
  - 仅 TTS 使用。
- `content/modules/ad-blocker.js`
  - 与 OCR 无直接依赖；虽然包含若干漫画站广告选择器，但不需要一并删除。
- `src/core/deepseek.js`
  - 文本翻译仍在用；仅其图片相关方法可能变成死代码。
- `src/core/gemini.js`
  - 文本翻译和其他功能仍可能需要；其图片相关方法是否顺手裁剪可后续再定。

## 文档与说明面也会受影响

若确认删除功能，至少这些文档要同步修正:

- `README.md`
- `docs/reference/features.md`
- `docs/reference/architecture.md`
- `docs/guide/native-host-setup.md`
- `docs/guide/api-configuration.md`
- `docs/reference/project-structure.md`
- `docs/workbench/CONVENTIONS.md`

原因:
- 当前这些文档仍把 OCR、漫画翻译、Native Host、Qwen-VL 视为正式功能或正式依赖。

## 建议的删除顺序

1. 先删入口:
   - Popup、右键菜单、内容脚本消息分支、Options UI
2. 再删后台链路:
   - `general_image.js`、`manga.js`、`testNativeOCR`
3. 再删 provider / 配置:
   - `qwenvl.js`、相关 settings 字段、Options 保存逻辑
4. 最后删宿主与权限:
   - `native-host/`
   - `nativeMessaging`
   - `rules.json` 与 DNR 权限
5. 收尾:
   - 全仓搜索 `ocr|manga|qwenvl|nativeOCR|translateImage|translateMangaImage|testNativeOCR`
   - 修正文档

## 人工确认项

在真正删除前，建议你只确认两件事：

1. 是否接受把 `src/core/qwenvl.js` 一并删除。
   - 我的建议: 接受，因为当前没有独立文本翻译入口使用它。
2. 是否接受一起删除 `rules.json` 和 DNR 权限。
   - 我的建议: 接受，因为当前唯一规则只服务漫画站点兼容。

确认后，我再按这个报告分批执行删除。  
