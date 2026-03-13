# 架构设计

## 系统架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                        Chrome 浏览器                         │
│                                                             │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐│
│  │ Popup UI │  │ Options Page │  │   Content Scripts      ││
│  │          │  │              │  │                        ││
│  │ 翻译输入  │  │ 设置管理      │  │ selection  sidebar    ││
│  │ 历史记录  │  │ 历史/收藏     │  │ float-window          ││
│  │ 收藏夹   │  │ TTS 配置      │  │ immersive             ││
│  └────┬─────┘  └──────┬───────┘  │ ad-blocker            ││
│       │               │          │ floating-ball         ││
│       │               │          └──────────┬─────────────┘│
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
│              └───┬────┬───────┘                            │
│                  │    │                                     │
│                  ▼    ▼                                     │
│             ┌──────────────┐   ┌──────────┐                │
│             │   src/core   │   │ Offscreen│                │
│             │              │   │ Document │                │
│             │ 翻译引擎      │   │          │                │
│             │ 存储管理      │   │ 音频播放 │                │
│             │ PDF / TTS     │   └──────────┘                │
│             └──────────────┘                                 │
└─────────────────────────────────────────────────────────────┘
```

## 通信机制

### 消息流

所有组件通过 `chrome.runtime.sendMessage` 与 Service Worker 通信，使用 `action` 字段路由：

```
Popup/Content → sendMessage({ action, payload }) → Service Worker → 调用 src/core 或 background/modules → 返回结果
```

其中 `service-worker.js` 会先把消息交给 `background/modules/message-router.js` 做 action 分发，再调用具体处理模块。

### 消息 Action 清单

| Action | 来源 | 目标模块 | 说明 |
|--------|------|----------|------|
| `translate` | Popup / Content | `src/core/translator.js` | 翻译文本 |
| `translateBatch` | Content | `src/core/translator.js` | 批量翻译 |
| `ttsOpenAI` | Popup / Content / Options | `background/modules/tts.js` | OpenAI TTS 音频生成 |
| `ttsGoogle` | Popup / Content / Options | `background/modules/tts.js` | Google TTS 音频生成 |
| `ttsGLM` | Popup / Content / Options | `background/modules/tts.js` | GLM TTS 音频生成 |
| `playAudioOffscreen` | Popup / Content / Options | `background/modules/tts.js` | 通过 Offscreen Document 播放音频 |
| `getSettings` | Popup / Content | `src/core/storage.js` | 获取设置 |
| `getHistory` | Popup | `src/core/storage.js` | 获取历史 |
| `addHistory` | Sidebar | `src/core/storage.js` | 写入翻译历史 |
| `updateSettings` | Options | `src/core/translator.js` | 刷新翻译引擎设置 |

## 数据存储

使用 `chrome.storage.local`，封装在 `src/core/storage.js`：

| Key | 内容 |
|-----|------|
| `settings` | 用户配置 |
| `history` | 翻译历史（最多 500 条） |
| `favorites` | 收藏翻译（最多 200 条） |

## 翻译引擎架构

```
translator.js (调度器)
    │
    ├── google-free.js    → Google Translate API (免费)
    ├── openai.js         → OpenAI Chat Completions API
    ├── gemini.js         → Google Gemini API
    ├── deepseek.js       → DeepSeek / ppinfra API
    └── offline.js        → 内置词典查询
```

每个引擎模块导出统一翻译函数，由 `translator.js` 根据用户设置的 `provider` 字段分发调用。

## 内容脚本加载顺序

在 `manifest.json` 中定义，按顺序注入：

```
1. state.js         → 初始化全局状态
2. utils.js         → 工具函数
3. selection.js     → 划词监听
4. sidebar.js       → 侧边栏 UI
5. float-window.js  → 浮动窗口 UI
6. immersive.js     → 沉浸式翻译
7. ad-blocker.js    → 广告拦截
8. floating-ball.js → 悬浮球
9. content.js       → 入口（事件绑定、模块协调）
```

所有模块通过 `window.SmartTranslator` 命名空间共享状态。
