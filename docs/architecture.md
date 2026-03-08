# 架构设计

## 系统架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                        Chrome 浏览器                         │
│                                                             │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐│
│  │ Popup UI │  │ Options Page │  │   Content Scripts      ││
│  │          │  │              │  │                        ││
│  │ 翻译输入  │  │ 设置管理      │  │ sidebar  float-window ││
│  │ 历史记录  │  │ 导入导出      │  │ immersive  manga     ││
│  │ 收藏夹   │  │ 主题切换      │  │ selection  ocr       ││
│  └────┬─────┘  └──────┬───────┘  │ floating-ball         ││
│       │               │          │ ad-blocker  cache     ││
│       │               │          └──────────┬─────────────┘│
│       │               │                     │              │
│       └───────────────┼─────────────────────┘              │
│                       │                                     │
│              chrome.runtime.sendMessage                      │
│                       │                                     │
│              ┌────────▼────────┐                            │
│              │ Service Worker  │                            │
│              │                 │                            │
│              │ 消息路由中枢     │                            │
│              │ 翻译调度        │                            │
│              │ 上下文菜单      │                            │
│              │ TTS 管理       │                            │
│              └───┬────┬───┬───┘                            │
│                  │    │   │                                  │
│     ┌────────────┘    │   └────────────┐                    │
│     ▼                 ▼                ▼                    │
│ ┌────────┐    ┌──────────────┐   ┌──────────┐             │
│ │src/core│    │  Offscreen   │   │ Native   │             │
│ │        │    │  Document    │   │ Messaging│             │
│ │翻译引擎 │    │              │   │          │             │
│ │存储管理 │    │ 音频播放(TTS) │   │ OCR 通信  │             │
│ │OCR管理  │    └──────────────┘   └────┬─────┘             │
│ └────────┘                             │                    │
└────────────────────────────────────────┼────────────────────┘
                                         │
                                    stdio 管道
                                         │
                              ┌──────────▼──────────┐
                              │  Python Native Host  │
                              │                      │
                              │  ocr_host.py (主机)   │
                              │  api_server.py (API) │
                              │  PaddleOCR (模型)     │
                              └──────────────────────┘
```

## 通信机制

### 消息流

所有组件通过 `chrome.runtime.sendMessage` 与 Service Worker 通信，使用 `action` 字段路由：

```
Popup/Content → sendMessage({ action, payload }) → Service Worker → 调用 src/core 模块 → 返回结果
```

### 消息 Action 清单

| Action | 来源 | 目标模块 | 说明 |
|--------|------|----------|------|
| `translate` | Popup / Content | `src/core/translator.js` | 翻译文本 |
| `translateBatch` | Content | `src/core/translator.js` | 批量翻译 |
| `translateImage` | Content | `src/core/ocr.js` | 翻译图片内容 |
| `translateImageUrl` | Content | `src/core/ocr.js` | 翻译图片 URL |
| `translateMangaImage` | Content | `background/modules/manga.js` | 漫画翻译 |
| `testNativeOCR` | Options | `src/core/native-ocr.js` | 测试 OCR 可用性 |
| `ttsOpenAI` | Content | `background/modules/tts.js` | OpenAI TTS |
| `ttsGoogle` | Content | `background/modules/tts.js` | Google TTS |
| `getSettings` | Popup / Content | `src/core/storage.js` | 获取设置 |
| `getHistory` | Popup | `src/core/storage.js` | 获取历史 |

### Native Messaging 通信

```
Service Worker ←→ chrome.runtime.connectNative ←→ ocr_host.py (stdio)
                                                       ↓
                                                  api_server.py (HTTP localhost)
                                                       ↓
                                                  PaddleOCR 推理
```

## 数据存储

使用 `chrome.storage.local`，封装在 `src/core/storage.js`：

| Key | 内容 | 大小限制 |
|-----|------|----------|
| `settings` | 用户配置（~40 字段） | Chrome 10MB 总限制 |
| `history` | 翻译历史 | 最多 500 条 |
| `favorites` | 收藏翻译 | 最多 200 条 |

## 翻译引擎架构

```
translator.js (调度器)
    │
    ├── google-free.js    → Google Translate API (免费)
    ├── openai.js         → OpenAI Chat Completions API
    ├── gemini.js         → Google Gemini API
    ├── deepseek.js       → DeepSeek Chat API
    ├── qwenvl.js         → QwenVL Vision API
    └── offline.js        → 内置词典查询
```

每个引擎模块导出统一翻译函数，由 `translator.js` 根据用户设置的 `provider` 字段分发调用。

## 内容脚本加载顺序

在 `manifest.json` 中定义，按顺序注入：

```
1. state.js           → 初始化全局状态
2. utils.js           → 工具函数
3. selection.js        → 划词监听
4. sidebar.js          → 侧边栏 UI
5. float-window.js     → 浮动窗口 UI
6. immersive.js        → 沉浸式翻译
7. translation-cache.js → 缓存层
8. manga.js            → 漫画模式
9. ocr.js              → OCR UI
10. ad-blocker.js      → 广告拦截
11. floating-ball.js   → 浮动球
12. content.js         → 入口（事件绑定、模块协调）
```

所有模块通过 `window.SmartTranslator` 命名空间共享状态。
