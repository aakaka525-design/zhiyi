# 项目结构

```
zhiyi/
├── manifest.json                # 扩展清单 (Manifest V3)
├── config.txt                   # API 密钥配置（不入库）
├── rules.json                   # declarativeNetRequest 网络规则
├── README.md                    # 项目说明
├── .gitignore                   # Git 忽略规则
│
├── popup/                       # 弹窗 UI
│   ├── popup.html               # 弹窗页面
│   ├── popup.js                 # 弹窗逻辑（翻译输入、历史、收藏）
│   └── popup.css                # 弹窗样式
│
├── options/                     # 设置页
│   ├── options.html             # 设置页面（所有配置项）
│   ├── options.js               # 设置逻辑（保存、导入导出）
│   ├── options.css              # 设置样式
│   └── theme.css                # 主题系统（亮色/暗色）
│
├── background/                  # 后台服务
│   ├── service-worker.js        # Service Worker 入口（消息路由）
│   └── modules/
│       ├── tts.js               # TTS 消息处理
│       ├── manga.js             # 漫画翻译处理
│       ├── general_image.js     # 通用图片翻译
│       ├── menus.js             # 右键菜单创建
│       └── utils.js             # 后台工具函数
│
├── content/                     # 内容脚本（注入网页）
│   ├── content.js               # 内容脚本入口（事件绑定）
│   ├── content.css              # 注入页面的样式
│   └── modules/
│       ├── state.js             # 全局状态管理
│       ├── utils.js             # 工具函数
│       ├── selection.js         # 划词选择处理
│       ├── sidebar.js           # 侧边栏 UI
│       ├── float-window.js      # 浮动翻译窗口
│       ├── floating-ball.js     # 浮动球 UI
│       ├── immersive.js         # 沉浸式翻译
│       ├── translation-cache.js # 翻译缓存
│       ├── manga.js             # 漫画模式 UI
│       ├── ocr.js               # OCR UI 处理
│       └── ad-blocker.js        # 广告拦截
│
├── src/core/                    # 核心业务模块
│   ├── translator.js            # 翻译调度器（引擎选择、请求分发）
│   ├── storage.js               # Chrome Storage 封装
│   ├── google-free.js           # Google 免费翻译
│   ├── openai.js                # OpenAI API
│   ├── gemini.js                # Google Gemini API
│   ├── deepseek.js              # DeepSeek API
│   ├── qwenvl.js                # QwenVL 视觉模型
│   ├── offline.js               # 离线翻译（内置词典）
│   ├── ocr.js                   # OCR 管理器
│   ├── native-ocr.js            # Native Messaging OCR 客户端
│   ├── tts.js                   # TTS 服务
│   └── pdf.js                   # PDF 处理
│
├── offscreen/                   # 离屏文档（音频播放）
│   ├── offscreen.html           # 离屏页面
│   └── offscreen.js             # 音频播放逻辑
│
├── native-host/                 # Python 本地 OCR 服务
│   ├── ocr_host.py              # Native Messaging 主机（入口）
│   ├── api_server.py            # FastAPI 漫画翻译 API
│   ├── ocr_daemon.py            # OCR 后台守护进程
│   ├── start_api.sh             # API 服务启动脚本
│   ├── requirements.txt         # Python 依赖
│   ├── com.smarttranslator.ocr_host.json  # Native Messaging 清单
│   ├── ocr/                     # OCR 核心
│   │   ├── detector.py          # 文字检测
│   │   ├── renderer.py          # 翻译结果渲染
│   │   ├── regions.py           # 文字区域管理
│   │   ├── parsers.py           # 文档解析
│   │   └── engines/             # OCR 引擎实现
│   ├── models/                  # ML 模型封装
│   ├── utils/                   # 工具模块
│   ├── scripts/                 # 安装脚本
│   └── test_data/               # 测试图片
│
├── assets/                      # 静态资源
│   ├── icons/                   # 扩展图标 (16/32/48/128px)
│   └── dictionaries/            # 离线翻译词典
│
├── _locales/                    # 国际化
│   └── zh_CN/
│       └── messages.json        # 中文翻译
│
├── _metadata/                   # Chrome 生成的元数据（不入库）
│
└── docs/                        # 项目文档
    ├── project-structure.md     # 本文件
    ├── architecture.md          # 架构设计
    ├── features.md              # 功能说明
    ├── api-configuration.md     # API 配置指南
    ├── native-host-setup.md     # Native Host 安装
    ├── development.md           # 开发指南
    └── audit/
        └── AUDIT_PLAN.md        # 审核计划
```

## 模块数量统计

| 层级 | 模块数 | 语言 |
|------|--------|------|
| 内容脚本 (`content/modules/`) | 11 | JavaScript |
| 后台模块 (`background/modules/`) | 5 | JavaScript |
| 核心模块 (`src/core/`) | 12 | JavaScript |
| 本地服务 (`native-host/`) | ~15 | Python |
| **合计** | **~43** | |
