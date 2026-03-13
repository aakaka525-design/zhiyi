# 项目结构

```
zhiyi/
├── manifest.json                # 扩展清单 (Manifest V3)
├── config.example.txt           # 配置模板
├── README.md                    # 项目说明
├── .gitignore                   # Git 忽略规则
│
├── popup/                       # 弹窗 UI
│   ├── popup.html               # 弹窗页面
│   ├── popup.js                 # 弹窗逻辑（翻译输入、历史、收藏）
│   └── popup.css                # 弹窗样式
│
├── options/                     # 设置页
│   ├── options.html             # 设置页面（配置、历史、收藏）
│   ├── options.js               # 设置逻辑（保存、测试、渲染）
│   ├── options.css              # 设置样式
│   └── theme.css                # 主题系统（亮色/暗色）
│
├── background/                  # 后台服务
│   ├── service-worker.js        # Service Worker 入口（消息路由）
│   └── modules/
│       ├── tts.js               # TTS 消息处理
│       ├── menus.js             # 右键菜单创建
│       ├── message-router.js    # 消息路由分发
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
│       ├── floating-ball.js     # 悬浮球 UI
│       ├── immersive.js         # 沉浸式翻译
│       └── ad-blocker.js        # 广告拦截
│
├── src/core/                    # 核心业务模块
│   ├── translator.js            # 翻译调度器（引擎选择、请求分发）
│   ├── storage.js               # Chrome Storage 封装
│   ├── google-free.js           # Google 免费翻译
│   ├── openai.js                # OpenAI API
│   ├── gemini.js                # Google Gemini API
│   ├── deepseek.js              # DeepSeek API
│   ├── offline.js               # 离线翻译（内置词典）
│   └── pdf.js                   # PDF 处理
│
├── offscreen/                   # 离屏文档（音频播放）
│   ├── offscreen.html           # 离屏页面
│   └── offscreen.js             # 音频播放逻辑
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
├── tests/                       # 测试
│
└── docs/                        # 项目文档
    ├── README.md                # 文档索引
    ├── guide/                   # 使用与上手指南
    │   ├── getting-started.md   # 安装、配置与常用入口
    │   ├── api-configuration.md # API 配置指南
    │   └── native-host-setup.md # 已移除功能说明
    ├── reference/               # 技术参考
    │   ├── architecture.md      # 架构设计
    │   ├── features.md          # 功能说明
    │   └── project-structure.md # 本文件
    ├── contributing/            # 开发与维护说明
    │   └── development.md       # 开发指南
    └── workbench/               # Agent 协作工作台
```

## 模块数量统计

| 层级 | 模块数 | 语言 |
|------|--------|------|
| 内容脚本 (`content/modules/`) | 8 | JavaScript |
| 后台模块 (`background/modules/`) | 4 | JavaScript |
| 核心模块 (`src/core/`) | 8 | JavaScript |
| 离屏文档 (`offscreen/`) | 2 | HTML / JavaScript |
| **合计** | **22** | |
