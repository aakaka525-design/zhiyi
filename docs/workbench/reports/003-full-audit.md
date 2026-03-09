# 003 — 全面审核报告

> 注意：本报告基于 `002-remove-ocr` 执行前的代码状态。报告中涉及 OCR、漫画翻译、Native Host 的发现已随功能移除而失效，具体见 [003-full-audit.md](../discussions/003-full-audit.md) 中的交叉影响分析。

- 日期: 2026-03-08
- 状态: 已完成
- 对应任务: [003-full-audit.md](../tasks/003-full-audit.md)
- 对应讨论: [003-full-audit.md](../discussions/003-full-audit.md)
- 分支: `codex/audit-p0-batch-1`
- 方法: 静态代码审计、模式扫描、配置核对、`python3 -m compileall native-host`、全量 `node --check`
- 限制: 未在真实 Chrome 扩展环境中逐项点击 UI，也未使用真实 API/Native Host 做端到端联调；涉及浏览器交互、外部服务和 OCR 模型效果的结论以静态审计为主

## 审计摘要

- `Critical`: 1
- `High`: 10
- `Medium`: 18
- `Low/Info`: 若干

最重要的问题集中在四类：
1. 多处把翻译结果、历史记录和错误消息直接写进 `innerHTML`，存在实际 DOM 注入风险。
2. 多条功能链路前后端协议不一致，导致 TTS、快捷键、PDF、悬浮球等功能名义存在但实际不可用。
3. 扩展权限和注入范围过大：`<all_urls>`、全站内容脚本、全站 `web_accessible_resources`。
4. Python 侧本地服务默认对外监听 `0.0.0.0`，且缺少鉴权和上传限制。

## 一、安全审核

#### [1.1-1] config.txt 敏感信息与忽略规则检查
- **状态**: WARN
- **严重性**: Medium
- **位置**: `config.txt:1`, `.gitignore:2`
- **发现**: `config.txt` 中存在真实样式的 API 密钥和模型配置。该文件已被 `.gitignore` 排除，当前未被 Git 跟踪，但仍以明文保存在项目根目录，存在误共享和本地泄露风险。
- **建议**: 提供 `config.example.txt`，真实密钥改为环境变量或用户私有配置目录；文档中明确禁止共享真实 `config.txt`。

#### [1.1-2] JS/Python 硬编码密钥扫描
- **状态**: PASS
- **严重性**: Info
- **位置**: `全仓 *.js/*.py`
- **发现**: 按计划正则和常见敏感字段启发式模式扫描后，未在 JS/Python 源码中发现直接硬编码的 API key、token 或 password 字面量。
- **建议**: 把这类扫描接入 pre-commit 或 CI。

#### [1.1-3] host_permissions 与资源暴露范围
- **状态**: FAIL
- **严重性**: High
- **位置**: `manifest.json:28`, `manifest.json:61`, `manifest.json:80`
- **发现**: `host_permissions`、`content_scripts.matches` 和 `web_accessible_resources.matches` 都设置为 `<all_urls>`，把内容脚本注入、主机访问和资源暴露范围扩大到了全部站点。
- **建议**: 收敛到实际需要的网站；能按需申请的改为 `optional_host_permissions`；评估 `src/*` 是否需要作为全站可访问资源暴露。

#### [1.1-4] Native Messaging allowed_origins 限制
- **状态**: PASS
- **严重性**: Info
- **位置**: `native-host/com.smarttranslator.ocr_host.json:6`
- **发现**: `allowed_origins` 当前限制为单一扩展 ID，没有直接放开给任意扩展。
- **建议**: 保持白名单策略；安装脚本中同步更新扩展 ID。

#### [1.2-1] 未转义 innerHTML 导致 DOM 注入
- **状态**: FAIL
- **严重性**: Critical
- **位置**: `content/modules/selection.js:149`, `content/modules/ocr.js:40`, `content/modules/ocr.js:281`, `content/modules/sidebar.js:333`, `options/options.js:615`
- **发现**: 多处把翻译结果、OCR 原文、历史记录和错误消息直接拼进 `innerHTML`。这些值来自用户选中文本、远程模型响应或本地存储，攻击者可借由恶意翻译结果或历史内容注入标签和事件处理器。
- **建议**: 所有用户输入、模型输出和错误字符串改为 `textContent`/`innerText` 或显式转义；列表渲染优先使用 `createElement`。

#### [1.2-2] createElement 与 HTML 模板混用
- **状态**: WARN
- **严重性**: Medium
- **位置**: `content/modules/sidebar.js:16`, `content/modules/float-window.js:16`, `content/modules/ocr.js:82`
- **发现**: 静态 UI 壳层多用模板字符串整体插入，后续又在同一容器内混入动态 HTML。静态模板本身可控，但动态拼接和复用容器会放大注入风险。
- **建议**: 保留静态模板可接受，动态内容一律改为 DOM API 逐项赋值。

#### [1.2-3] eval / Function / setTimeout(string)
- **状态**: PASS
- **严重性**: Info
- **位置**: `全仓 JS`
- **发现**: 未发现 `eval()`、`Function()` 或 `setTimeout("...")` 这类直接代码执行点。
- **建议**: 继续保持，避免引入字符串执行路径。

#### [1.2-4] CSP 配置
- **状态**: PASS
- **严重性**: Info
- **位置**: `manifest.json`
- **发现**: `manifest.json` 未显式放宽 `content_security_policy`。在 Manifest V3 下，未看到 `unsafe-eval` 一类高风险放宽项。
- **建议**: 保持默认 MV3 CSP，避免后续为远程脚本或内联脚本放宽策略。

#### [1.3-1] fetch 调用的协议安全性
- **状态**: WARN
- **严重性**: Medium
- **位置**: `src/core/openai.js:57`, `src/core/gemini.js:49`, `src/core/deepseek.js:46`, `src/core/qwenvl.js:48`, `options/options.js:242`
- **发现**: 硬编码的外部接口均使用 HTTPS，但多个 Base URL 由用户自定义输入，代码未校验是否为 HTTPS，允许降级到明文 HTTP。
- **建议**: 保存和测试 Base URL 前校验协议，仅允许 `https:`，本地例外单独白名单。

#### [1.3-2] declarativeNetRequest 请求头改写
- **状态**: WARN
- **严重性**: Medium
- **位置**: `rules.json:5`
- **发现**: 规则会把 `tngcdn.com` 的图片和 XHR 请求强制改写为固定 `Referer`/`Origin`。这属于对第三方站点的来源伪装，可能引入兼容性和安全边界问题。
- **建议**: 把规则限制到最小资源类型和确切路径，文档中说明用途；对其它站点不要复用这种做法。

#### [1.3-3] API 错误信息暴露
- **状态**: WARN
- **严重性**: Medium
- **位置**: `background/modules/tts.js:90`, `content/modules/ocr.js:290`, `content/modules/sidebar.js:311`
- **发现**: 上游 API 返回的错误文本会被直接透传到前端 UI，有时还是未转义写入 DOM。这样既可能泄露供应商内部报错，也会放大注入风险。
- **建议**: 记录详细错误到控制台或调试日志，对用户仅展示统一错误码和简化提示。

#### [1.3-4] 请求构建缺少超时与取消
- **状态**: WARN
- **严重性**: Medium
- **位置**: `src/core/openai.js:57`, `src/core/gemini.js:49`, `src/core/deepseek.js:46`, `src/core/qwenvl.js:48`
- **发现**: 核心翻译引擎请求普遍没有 `AbortController` 超时控制；只有背景层图片获取用了 `fetchWithTimeout`。
- **建议**: 给所有外部 API 请求统一加超时、取消和错误分类。

#### [1.4-1] 权限最小化
- **状态**: FAIL
- **严重性**: High
- **位置**: `manifest.json:51`
- **发现**: 扩展拥有 `scripting`、`declarativeNetRequestWithHostAccess`、`nativeMessaging` 和全站 host access，其中 `scripting` 当前未发现实际使用，整体权限集明显偏大。
- **建议**: 删除未使用权限；把图片/OCR/广告拦截能力拆成更细的可选权限。

#### [1.4-2] 内容脚本隔离与页面影响
- **状态**: WARN
- **严重性**: Medium
- **位置**: `manifest.json:26`, `content/modules/ad-blocker.js:231`
- **发现**: 代码运行在内容脚本隔离世界，但会对页面 DOM、点击流和 `window.open` 行为做全局干预，副作用范围覆盖所有站点。
- **建议**: 把高侵入功能限定到用户显式启用的网站和场景。

#### [1.4-3] onMessage 来源验证
- **状态**: WARN
- **严重性**: Medium
- **位置**: `background/service-worker.js:35`, `offscreen/offscreen.js:6`
- **发现**: 消息处理器完全信任 `request.action`，没有校验 `sender.id`、`sender.url` 或调用上下文，导致高权限操作和一般消息共用同一入口。
- **建议**: 对 Native OCR、远程取图、TTS 等高权限 action 校验消息来源和字段形状。

#### [1.4-4] executeScript 使用安全性
- **状态**: PASS
- **严重性**: Info
- **位置**: `全仓 JS`
- **发现**: 未发现 `chrome.scripting.executeScript` 的实际调用。
- **建议**: 如果继续不使用，直接移除 `scripting` 权限。

#### [1.5-1] FastAPI 路由输入验证
- **状态**: FAIL
- **严重性**: High
- **位置**: `native-host/api_server.py:46`
- **发现**: 上传接口未校验文件大小、MIME 类型、像素上限，也没有鉴权。任意请求都可触发昂贵的 OCR 和 AI 处理。
- **建议**: 限制上传大小和尺寸，拒绝非图片 MIME，必要时只监听环回地址并增加本地鉴权。

#### [1.5-2] 路径遍历
- **状态**: PASS
- **严重性**: Info
- **位置**: `native-host/*.py`
- **发现**: 未发现直接把用户输入拼到文件系统路径后再读取的代码路径。
- **建议**: 保持仅处理内存中的上传图片或受控的临时文件。

#### [1.5-3] subprocess 注入
- **状态**: PASS
- **严重性**: Info
- **位置**: `native-host/ocr_host.py:89`
- **发现**: `subprocess.Popen` 使用固定脚本和固定参数，不接受用户传入的命令片段，未见直接命令注入点。
- **建议**: 继续保持参数列表调用，不要退回 shell 字符串执行。

#### [1.5-4] 恶意图片防护
- **状态**: WARN
- **严重性**: Medium
- **位置**: `native-host/api_server.py:56`, `native-host/utils/image.py:15`, `native-host/ocr/detector.py:105`
- **发现**: 所有图片都直接交给 Pillow 打开，没有像素炸弹和异常图片防护。
- **建议**: 设置 Pillow 安全阈值，限制最大像素数，并在解码前检查大小。

## 二、代码质量审核

#### [2.1-1] `var` 与超长函数
- **状态**: WARN
- **严重性**: Medium
- **位置**: `content/modules/sidebar.js:11`, `content/modules/ocr.js:20`, `popup/popup.js:81`
- **发现**: 内容脚本广泛使用 `var`，同时存在多处超长函数，例如 `ST.createSidebar` 约 354 行、`ST.handleOCR` 约 277 行、`bindEvents` 约 190 行。
- **建议**: 逐步改为 `const`/`let`，按职责拆分 UI 绑定、消息调用和渲染逻辑。

#### [2.1-2] `==` / `===`
- **状态**: PASS
- **严重性**: Info
- **位置**: `全仓 JS`
- **发现**: 未发现明显的宽松相等用法泛滥，整体以严格比较为主。
- **建议**: 保持 `===`/`!==` 约定。

#### [2.1-3] 重复逻辑
- **状态**: WARN
- **严重性**: Medium
- **位置**: `content/modules/sidebar.js:141`, `content/modules/float-window.js:88`, `src/core/tts.js:16`
- **发现**: TTS 逻辑在侧边栏、小窗和 `src/core/tts.js` 中各实现一份，消息名和能力矩阵已经漂移，直接导致部分 provider 不可用。
- **建议**: 合并为单一 TTS 服务层，由 UI 只负责触发。

#### [2.2-1] Python 宽泛异常处理
- **状态**: WARN
- **严重性**: Medium
- **位置**: `native-host/ocr_daemon.py:38`, `native-host/ocr_host.py:24`, `native-host/ocr/renderer.py:33`
- **发现**: Python 侧存在多处裸 `except:` 或过宽的 `except Exception`，吞掉错误后只留下模糊日志，影响定位。
- **建议**: 收窄异常范围，并在关键失败路径返回结构化错误。

#### [2.2-2] 类型注解与接口约束
- **状态**: WARN
- **严重性**: Low
- **位置**: `native-host/*.py`, `src/core/*.js`
- **发现**: Python 侧几乎没有类型注解，JS 侧也缺少统一的请求/响应类型约束，导致消息协议漂移未被发现。
- **建议**: 至少为 Native Host 和 Service Worker 的消息对象补充 schema。

#### [2.3-1] 全局命名空间不一致
- **状态**: FAIL
- **严重性**: High
- **位置**: `content/modules/translation-cache.js:131`, `content/modules/ocr.js:95`, `content/modules/ad-blocker.js:395`
- **发现**: 主状态挂在 `window.SmartTranslator`，但缓存和部分模块导出到了 `window.ST`。调用方读取 `ST.translationCache` 时拿到的是 `window.SmartTranslator.translationCache`，缓存实际不会命中。
- **建议**: 统一只使用一个全局命名空间，并为模块初始化写自检。

#### [2.3-2] 状态与观察器清理
- **状态**: WARN
- **严重性**: Medium
- **位置**: `content/modules/manga.js:23`, `content/modules/manga.js:116`
- **发现**: 关闭漫画模式时只断开了 `ST.observers.manga`，没有断开 `mangaMutation` 观察器；`translatedImages` 也只在关闭时清空。
- **建议**: 关闭功能时成对清理 observer、timer、Set/Map。

#### [2.4-1] Service Worker 协议漂移
- **状态**: FAIL
- **严重性**: High
- **位置**: `background/service-worker.js:51`, `options/options.js:539`, `content/modules/sidebar.js:183`
- **发现**: 前端会发送 `updateSettings`、`playAudioOffscreen`、`ttsFish`、`ttsEdge` 等 action，但 Service Worker 未处理这些消息。
- **建议**: 为所有已发送的 action 建立统一枚举和测试，禁止前后端各自扩展消息名。

#### [2.4-2] 通用图片 OCR 绑定到了文本翻译 provider
- **状态**: WARN
- **严重性**: Medium
- **位置**: `background/modules/general_image.js:5`, `src/core/storage.js:13`
- **发现**: 通用图片 OCR 默认使用 `translator.settings.provider`。默认 provider 是 `google`，而 Google 免费翻译并不具备 `translateImage()` 能力，导致图片翻译默认链路不可用。
- **建议**: 给图片 OCR 单独配置 provider，只允许选择具备视觉能力的引擎。

## 三、错误处理与健壮性

#### [3.1-1] 异步错误未被实际捕获
- **状态**: FAIL
- **严重性**: High
- **位置**: `content/modules/selection.js:138`
- **发现**: `ST.showBubble()` 用 `try/catch` 包住 `ST.sendMessage(...).then(...)`，但没有 `await`。消息发送失败时会变成未处理 Promise rejection，气泡会停在加载态。
- **建议**: 改为 `await ST.sendMessage(...)` 或在 Promise 链尾部显式 `.catch()`。

#### [3.1-2] 返回结构不统一
- **状态**: WARN
- **严重性**: Medium
- **位置**: `background/service-worker.js:40`, `background/service-worker.js:96`
- **发现**: 有的分支返回 `{ text }`，有的返回 `{ error }`，有的返回 `{ success, message }`。调用端多靠猜测字段存在与否判断结果。
- **建议**: 统一为 `{ success, result, error }`。

#### [3.2-1] 历史与收藏去重策略过粗
- **状态**: WARN
- **严重性**: Medium
- **位置**: `src/core/storage.js:124`, `src/core/storage.js:188`
- **发现**: 历史和收藏只按 `source` 去重。相同原文、不同目标语言或不同 provider 的记录会互相覆盖。
- **建议**: 去重键至少包含 `source + sourceLang + targetLang + provider`。

#### [3.2-2] 导入/迁移策略缺失
- **状态**: WARN
- **严重性**: Medium
- **位置**: `src/core/storage.js:255`
- **发现**: `importData()` 只检查 `version` 是否存在，未校验字段形状、数组大小或未来版本迁移。
- **建议**: 增加 schema 校验、版本迁移器和配额保护。

#### [3.2-3] OCR 区域选择功能未实现
- **状态**: WARN
- **严重性**: Medium
- **位置**: `content/modules/ocr.js:301`
- **发现**: `startImageAreaSelection()` 只有 `alert()`，没有实际的区域选择或截图逻辑。
- **建议**: 要么实现区域选择，要么把入口文案改成“请右键图片翻译”。

#### [3.3-1] 外部请求缺少统一超时/重试
- **状态**: WARN
- **严重性**: Medium
- **位置**: `src/core/openai.js:57`, `src/core/gemini.js:49`, `background/modules/tts.js:76`
- **发现**: 大多数外部 API 调用没有超时和重试策略，网络抖动时体验会卡死或长时间无响应。
- **建议**: 抽象统一的 `fetchWithTimeout` 和有限重试策略。

#### [3.3-2] Native OCR 可用性检查会误报成功
- **状态**: WARN
- **严重性**: Medium
- **位置**: `native-host/ocr_host.py:175`, `src/core/native-ocr.js:19`
- **发现**: Host 的 `ping` 固定返回 `paddle_available: True`，前端据此判断 OCR 可用。即使依赖没装好，也可能得到假阳性。
- **建议**: `ping` 时做真实依赖检测或最小化自检。

#### [3.3-3] TTS 测试按钮只测配置不测播放
- **状态**: WARN
- **严重性**: Low
- **位置**: `background/modules/tts.js:36`, `options/options.js:438`
- **发现**: “测试语音”按钮实际只验证 API Key 是否存在，没有请求音频，也没有播放验证。
- **建议**: 按 provider 走真实短文本播放链路。

## 四、性能审核

#### [4.1-1] 全站加载 11 个内容脚本模块
- **状态**: WARN
- **严重性**: High
- **位置**: `manifest.json:26`
- **发现**: 11 个内容脚本模块在所有站点 `document_idle` 注入。
- **建议**: 按功能拆分为按需注入，至少把广告拦截、漫画模式、OCR、侧边栏等改成懒加载。

#### [4.1-2] 启动即创建侧边栏和悬浮窗
- **状态**: WARN
- **严重性**: Medium
- **位置**: `content/content.js:107`
- **发现**: 内容脚本初始化时无条件创建侧边栏和小窗 DOM，即使用户从未使用这些功能。
- **建议**: 首次触发时再创建 UI。

#### [4.1-3] 高开销观察器
- **状态**: WARN
- **严重性**: Medium
- **位置**: `content/modules/immersive.js:201`, `content/modules/manga.js:39`, `content/modules/ad-blocker.js:333`
- **发现**: 页面上同时可能存在多个 `MutationObserver` 和 `IntersectionObserver`，其中漫画模式 `rootMargin` 设为 `7500px`，广告拦截还会全局扫描新增节点。
- **建议**: 收紧观察范围并增加节流。

#### [4.2-1] ad-blocker 的全局副作用不会回滚
- **状态**: FAIL
- **严重性**: High
- **位置**: `content/modules/ad-blocker.js:231`, `content/modules/ad-blocker.js:313`, `content/modules/ad-blocker.js:387`
- **发现**: 模块覆写了 `window.open` 并启动永久 `setInterval`，但 `disable()` 只移除了样式和 observer，既不会恢复原函数，也不会清理定时器。
- **建议**: 保存原始 `window.open` 和 interval ID，在禁用时完整恢复。

#### [4.2-2] 漫画翻译内存增长
- **状态**: WARN
- **严重性**: Medium
- **位置**: `content/modules/state.js:22`, `content/modules/manga.js:101`
- **发现**: `translatedImages` 和队列会随页面滚动持续增长，长漫画页可能累积大量 URL。
- **建议**: 对集合引入大小上限或基于 DOM 生命周期回收。

#### [4.2-3] 缓存策略与配额
- **状态**: WARN
- **严重性**: Medium
- **位置**: `content/modules/translation-cache.js:28`
- **发现**: 缓存保存在 `localStorage`，没有全局大小上限，且当前命名空间 bug 会让这套逻辑失效。
- **建议**: 修复命名空间后改为带容量限制的 `chrome.storage.local` 或 IndexedDB。

#### [4.3-1] 图片上传前无压缩
- **状态**: WARN
- **严重性**: Medium
- **位置**: `background/modules/general_image.js:39`, `background/modules/manga.js:268`
- **发现**: 远程图片直接转 base64 送入云端模型，没有尺寸压缩或分辨率限制，网络和计费成本都偏高。
- **建议**: 按最大边长压缩，再发送给视觉模型。

#### [4.3-2] translateBatch 回退策略低效
- **状态**: WARN
- **严重性**: Medium
- **位置**: `src/core/translator.js:154`
- **发现**: 非 OpenAI/Gemini provider 的批量翻译全部串行逐条调用，长页面沉浸式翻译会明显变慢。
- **建议**: 至少加入有限并发池。

#### [4.5-1] OCR API 并发与资源占用
- **状态**: WARN
- **严重性**: Medium
- **位置**: `native-host/api_server.py:69`, `native-host/api_server.py:121`
- **发现**: 检测阶段用 semaphore 限制到 1 已减压，但后续 AI 翻译用 `ThreadPoolExecutor(max_workers=10)`，在大图多框场景下仍可能压爆本机或供应商配额。
- **建议**: 让并发数可配置，并对单请求最大区域数做上限。

## 五、功能完整性审核

#### [5.1-1] 离线翻译覆盖不足
- **状态**: WARN
- **严重性**: Medium
- **位置**: `src/core/offline.js:20`, `assets/dictionaries/en-zh.json`
- **发现**: 代码声明会加载 `en-zh`、`ja-zh`、`ko-zh` 三本词典，但仓库里只有 `en-zh.json`。
- **建议**: 补齐字典或在 UI 中如实标明只支持英文离线翻译。

#### [5.1-2] 设置更新后后台翻译器不会刷新
- **状态**: FAIL
- **严重性**: High
- **位置**: `options/options.js:539`, `src/core/translator.js:41`, `background/service-worker.js:51`
- **发现**: Options 页发送 `updateSettings` 后，Service Worker 没有处理该 action，`translator.refreshSettings()` 从未被调用。内容脚本走后台翻译时会继续使用旧配置，直到 Service Worker 重启。
- **建议**: 后台实现 `updateSettings`，持久化后立即刷新 translator 实例。

#### [5.2-1] 悬浮球菜单动作失效
- **状态**: FAIL
- **严重性**: High
- **位置**: `content/modules/floating-ball.js:57`, `content/modules/floating-ball.js:64`
- **发现**: 漫画模式和侧边栏菜单调用的是 `ST.manga.manualTrigger` 与 `ST.sidebar.toggle`，而实际暴露的是 `ST.toggleMangaMode()` 和 `ST.toggleSidebar()`。这两个按钮会静默失效。
- **建议**: 统一调用真实导出的顶层方法，并为悬浮球增加冒烟测试。

#### [5.2-2] 设置导入/导出 UI 缺失
- **状态**: WARN
- **严重性**: Medium
- **位置**: `src/core/storage.js:236`
- **发现**: `StorageManager` 已实现 `exportData()`/`importData()`，但 Options/Popup 中没有任何入口调用这些方法。
- **建议**: 补上导入导出按钮，或删除未使用 API。

#### [5.3-1] TTS provider 矩阵不完整
- **状态**: FAIL
- **严重性**: High
- **位置**: `content/modules/sidebar.js:183`, `content/modules/float-window.js:98`, `background/service-worker.js:81`, `src/core/tts.js:127`
- **发现**: UI 会发送 `playAudioOffscreen`、`ttsFish`，核心 TTS 服务还会发送 `ttsEdge`，但 Service Worker 只处理 `testTTS`、`ttsGLM`、`ttsOpenAI`、`ttsGoogle`。Fish、Edge 和 Offscreen 播放链路都没有完整闭环。
- **建议**: 明确支持矩阵并补齐 handler；未支持的 provider 不要在 UI 暴露。

#### [5.3-2] PDF 功能是占位实现
- **状态**: FAIL
- **严重性**: High
- **位置**: `src/core/pdf.js:10`, `popup/popup.js:220`, `options/options.html:64`
- **发现**: `PDFManager.extractTextFromPDF()` 只返回占位文案；Popup 的 PDF 按钮会打开 `options/options.html#pdf`，但 Options 页面根本没有 `pdf` 标签。
- **建议**: 要么完整实现 PDF 流程，要么移除入口并修正文档。

#### [5.3-3] 图片 OCR 主入口不完整
- **状态**: WARN
- **严重性**: Medium
- **位置**: `content/modules/ocr.js:301`, `background/modules/general_image.js:5`
- **发现**: Popup 的“图片翻译”入口只会弹出提示；即使从右键菜单进入，默认 provider 又会落到 `google`，导致普通图片 OCR 默认不可用。
- **建议**: 完成区域选择功能，并为图片 OCR 单独指定视觉 provider。

#### [5.4-1] 浏览器级快捷键未接线
- **状态**: FAIL
- **严重性**: High
- **位置**: `manifest.json:85`, `background/service-worker.js:1`
- **发现**: `manifest.json` 声明了 4 个 `commands`，但全仓没有 `chrome.commands.onCommand` 监听器。浏览器级快捷键不会触发。
- **建议**: 在 Service Worker 中实现 `onCommand`，再转发到当前标签页。

#### [5.4-2] 上下文菜单
- **状态**: PASS
- **严重性**: Info
- **位置**: `background/modules/menus.js:2`
- **发现**: 右键菜单创建和基本消息转发逻辑存在，静态路径上能够对应到内容脚本 action。
- **建议**: 为菜单响应补充 `chrome.runtime.lastError` 和标签页可用性处理。

## 六、兼容性审核

#### [6.1-1] Manifest V3 使用
- **状态**: PASS
- **严重性**: Info
- **位置**: `manifest.json:2`
- **发现**: 扩展基于 Manifest V3，未见已废弃的背景页模式。
- **建议**: 持续按 MV3 规范迭代。

#### [6.1-2] 新版 Chrome API 依赖
- **状态**: WARN
- **严重性**: Medium
- **位置**: `background/modules/tts.js:9`
- **发现**: Offscreen TTS 依赖 `chrome.runtime.getContexts` 和 `chrome.offscreen.createDocument`，没有兼容性检测或回退。
- **建议**: 声明最低 Chrome 版本，或在不可用时回退到直接播放。

#### [6.2-1] iframe / Shadow DOM / 样式隔离
- **状态**: WARN
- **严重性**: Medium
- **位置**: `manifest.json:26`, `content/content.css`
- **发现**: `content_scripts` 未启用 `all_frames`，代码里也未见 iframe 特殊处理；UI 样式直接注入普通 DOM，没有 Shadow DOM 隔离。
- **建议**: 如果要支持 iframe 或降低样式冲突，需显式设计隔离方案。

#### [6.2-2] 全站兼容性风险
- **状态**: WARN
- **严重性**: High
- **位置**: `manifest.json:28`, `content/modules/ad-blocker.js:247`
- **发现**: 内容脚本、广告拦截和交互层在所有网站运行，高度依赖 DOM 结构假设，容易与复杂 SPA、阅读器和管理后台冲突。
- **建议**: 缩小默认生效站点，把高侵入特性改成白名单。

#### [6.3-1] Native Host 路径硬编码
- **状态**: FAIL
- **严重性**: High
- **位置**: `native-host/com.smarttranslator.ocr_host.json:4`, `native-host/ocr_host.py:78`, `native-host/start_api.sh:14`
- **发现**: Native Host manifest、`ocr_host.py` 和启动脚本都硬编码了本机绝对路径或 Anaconda Python 路径，跨机器和跨平台几乎无法直接使用。
- **建议**: 统一走安装脚本生成本地路径，不要把个人路径写入仓库。

#### [6.3-2] Python 依赖版本约束
- **状态**: WARN
- **严重性**: Medium
- **位置**: `native-host/requirements.txt:4`
- **发现**: `paddlepaddle` 未锁版本，`paddleocr` 只有下界没有上界，重装时结果不可预测。
- **建议**: 锁定经验证的版本组合。

## 七、用户体验审核

#### [7.1-1] 加载状态与深色模式
- **状态**: PASS
- **严重性**: Info
- **位置**: `options/options.html:127`, `popup/popup.js:335`
- **发现**: Popup/Options 基本具备加载态和主题切换入口。
- **建议**: 继续把状态提示标准化到所有功能链路。

#### [7.1-2] 错误提示不够友好
- **状态**: WARN
- **严重性**: Medium
- **位置**: `content/modules/sidebar.js:311`, `content/modules/ocr.js:290`, `options/options.js:326`
- **发现**: 错误提示普遍直接展示 `err.message` 或 HTTP 状态码，对普通用户可读性差。
- **建议**: 统一错误映射表，区分网络错误、配置错误和功能未实现。

#### [7.2-1] 可访问性标记缺失
- **状态**: WARN
- **严重性**: Medium
- **位置**: `popup/popup.html`, `options/options.html`
- **发现**: 全仓未检出 `aria-*` 或 `role=`；大量图标按钮只有 `data-tooltip`，没有可访问名称。
- **建议**: 为图标按钮补 `aria-label`，给导航和区域补语义角色。

#### [7.2-2] 键盘导航覆盖不足
- **状态**: WARN
- **严重性**: Medium
- **位置**: `options/options.html:23`, `popup/popup.html:25`
- **发现**: 有快捷键文案，但键盘焦点管理、ESC 关闭、列表键盘操作等未见明确实现。
- **建议**: 补齐焦点顺序和无鼠标操作路径。

#### [7.3-1] 国际化覆盖不足
- **状态**: WARN
- **严重性**: Medium
- **位置**: `_locales/zh_CN/messages.json`, `popup/popup.html:22`, `options/options.html:28`
- **发现**: UI 中存在大量硬编码中文，仅有 `zh_CN` locale 文件，实际并不支持多语言 UI。
- **建议**: 把 UI 文案迁移到 i18n 资源，至少补英文 locale。

## 八、数据管理审核

#### [8.1-1] 存储冲突与配额处理
- **状态**: WARN
- **严重性**: Medium
- **位置**: `src/core/storage.js:87`, `src/core/storage.js:133`, `src/core/storage.js:203`
- **发现**: 设置、历史和收藏都通过整块读写 `chrome.storage.local`，没有并发冲突处理，也没有配额/失败重试策略。
- **建议**: 对高频写入做队列化或 compare-and-merge。

#### [8.1-2] 数据迁移策略
- **状态**: WARN
- **严重性**: Medium
- **位置**: `src/core/storage.js:243`
- **发现**: 导出带版本号，但导入没有任何版本分支和迁移流程。
- **建议**: 为不同版本定义迁移器。

#### [8.2-1] 缓存键与缓存失效
- **状态**: WARN
- **严重性**: Medium
- **位置**: `content/modules/translation-cache.js:15`
- **发现**: 漫画缓存键只基于页面路径和图片 URL 哈希，不包含目标语言、引擎或字体设置，切换配置后可能命中过期语义结果。
- **建议**: 把目标语言和引擎纳入键空间。

#### [8.3-1] 历史与收藏逻辑
- **状态**: WARN
- **严重性**: Medium
- **位置**: `src/core/storage.js:124`, `src/core/storage.js:188`
- **发现**: 去重策略过粗，且 Popup 里只有添加收藏，没有取消收藏或已收藏状态同步。
- **建议**: 完整实现收藏状态同步和细粒度去重。

## 九、部署与维护审核

#### [9.1-1] 构建与版本管理
- **状态**: WARN
- **严重性**: Medium
- **位置**: `docs/contributing/development.md`, `README.md`
- **发现**: 当前没有自动化构建/打包流程，版本号完全手工维护。
- **建议**: 增加发布脚本和最基本的校验流水线。

#### [9.1-2] `.gitignore` / README
- **状态**: PASS
- **严重性**: Info
- **位置**: `.gitignore`, `README.md`
- **发现**: 审计计划里提到的 `.gitignore` 和 `README.md` 已存在。
- **建议**: 保持更新，避免文档继续与实现脱节。

#### [9.2-1] 测试覆盖
- **状态**: WARN
- **严重性**: High
- **位置**: `native-host/test_api_internal.py`, `native-host/test_native.py`
- **发现**: 仓库里只有两个 Python 侧脚本式测试，没有 JS 单元测试，也没有扩展 E2E。
- **建议**: 至少为 Service Worker 消息协议、存储层和内容脚本入口补单测。

#### [9.3-1] 日志与监控
- **状态**: WARN
- **严重性**: Medium
- **位置**: `background/modules/manga.js`, `content/modules/*`, `native-host/*.py`
- **发现**: 全仓 `console.log`/本地日志输出非常多，生产与调试未分级，也没有统一错误上报。
- **建议**: 引入 debug flag 约束日志级别，并定义错误上报策略。

#### [9.4-1] 文档与实现一致性
- **状态**: WARN
- **严重性**: Medium
- **位置**: `README.md`, `docs/reference/features.md`
- **发现**: 文档宣称支持 PDF 翻译、Edge TTS、Fish Audio 等能力，但实现存在占位或缺失消息处理，文档明显超前于代码。
- **建议**: 先修正文档，再实现缺失功能，避免误导用户。

## 验证记录

- `python3 -m compileall native-host` 通过
- `find background content src popup options offscreen -name '*.js' | sort | xargs -I{} node --check "{}"` 等价逐文件检查通过
- 已执行关键模式扫描:
  - 敏感信息: `rg -n "(sk-|key-|AIza|ghp_|ghu_)" --glob '*.js' --glob '*.py'`
  - 注入风险: `rg -n "innerHTML|outerHTML|eval\\(|Function\\(|setTimeout\\s*\\(\\s*['\\"]" ...`
  - 权限/消息: `rg -n "onMessage|sendMessage|commands\\.onCommand|ttsFish|playAudioOffscreen|updateSettings" ...`

## 结论

当前仓库具备可观的功能原型，但距离“安全且可维护的稳定扩展”还有明显差距。建议优先按以下顺序修复：

1. 收敛 `innerHTML` 注入面和 `all_urls` 权限。
2. 修复消息协议断裂：`updateSettings`、`playAudioOffscreen`、`ttsFish`、`ttsEdge`、`chrome.commands.onCommand`。
3. 关闭对外开放的本地 API（至少改为 `127.0.0.1` 并限制上传）。
4. 下线或隐藏未完成能力：PDF、区域 OCR、悬浮球无效动作。
