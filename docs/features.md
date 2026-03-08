# 功能说明

## 1. 划词翻译

**触发方式**: 选中网页文本后，通过浮动球点击或快捷键 `Alt+T`

**展示方式**（用户可选）:
- **浮动窗口**: 鼠标附近弹出小窗显示翻译结果
- **侧边栏**: 页面右侧滑出翻译面板
- **浮动球**: 选中文本后出现小球，点击触发翻译

**相关模块**:
- `content/modules/selection.js` — 文本选择监听
- `content/modules/float-window.js` — 浮动窗口 UI
- `content/modules/sidebar.js` — 侧边栏 UI
- `content/modules/floating-ball.js` — 浮动球 UI

---

## 2. 沉浸式翻译

**触发方式**: 快捷键 `Alt+I` 或右键菜单

**工作原理**: 遍历页面所有文本节点，在原文下方插入翻译文本，形成双语对照。

**特性**:
- 保留原文排版
- 增量翻译（仅翻译可见区域）
- 翻译缓存避免重复请求
- 支持动态加载内容（MutationObserver）

**相关模块**:
- `content/modules/immersive.js`
- `content/modules/translation-cache.js`

---

## 3. 图片 OCR 翻译

**触发方式**: 右键图片 → "翻译图片" 或 OCR 模式

**流程**:
1. 截取/获取图片
2. 通过 Native Messaging 发送到 Python 后端
3. PaddleOCR 识别文字区域和内容
4. 翻译识别出的文字
5. 返回翻译结果

**相关模块**:
- `content/modules/ocr.js` — 前端 OCR 交互
- `src/core/ocr.js` — OCR 管理器
- `src/core/native-ocr.js` — Native Messaging 通信
- `native-host/ocr_host.py` — Python OCR 主机
- `native-host/ocr/detector.py` — 文字检测

---

## 4. 漫画翻译

**触发方式**: 漫画模式开关 或 右键图片 → "翻译漫画"

**流程**:
1. 检测页面上的漫画图片
2. 发送图片到 Python 后端
3. 检测漫画气泡中的文字区域
4. 翻译文字内容
5. 在原图上覆盖渲染翻译文本

**特性**:
- 并发队列控制（`mangaQueue`）
- 防重复处理（`translatedImages` Set）
- 支持竖排文字检测

**相关模块**:
- `content/modules/manga.js` — 前端漫画模式
- `background/modules/manga.js` — 后端漫画处理
- `native-host/api_server.py` — FastAPI 翻译 API
- `native-host/ocr/renderer.py` — 文字渲染

---

## 5. PDF 翻译

**相关模块**: `src/core/pdf.js`

---

## 6. 语音朗读 (TTS)

**支持引擎**:
- 系统 TTS（浏览器内置）
- OpenAI TTS
- Edge TTS
- Fish Audio

**播放方式**: 通过 Offscreen Document 实现后台音频播放

**相关模块**:
- `src/core/tts.js` — TTS 服务管理
- `background/modules/tts.js` — TTS 消息处理
- `offscreen/offscreen.js` — 音频播放

---

## 7. 广告拦截

**实现方式**: `declarativeNetRequest` 规则 + 内容脚本 DOM 清理

**相关模块**:
- `rules.json` — 网络请求规则
- `content/modules/ad-blocker.js` — DOM 级广告拦截

---

## 8. 翻译弹窗 (Popup)

**功能**:
- 文本输入翻译
- 语言选择（源语言 / 目标语言）
- 翻译引擎切换
- 历史记录查看
- 收藏管理
- 快捷设置入口

**相关模块**: `popup/popup.html`, `popup/popup.js`

---

## 9. 设置管理 (Options)

**可配置项**:
- 翻译引擎选择与 API 密钥
- 翻译行为（自动翻译、显示原文等）
- UI 偏好（浮窗/侧边栏/浮动球）
- TTS 引擎配置
- 沉浸式翻译设置
- 漫画翻译设置
- 广告拦截开关
- 主题切换（亮色/暗色）
- 设置导入/导出

**相关模块**: `options/options.html`, `options/options.js`
