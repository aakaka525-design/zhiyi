# 快速上手

## 适用范围

当前版本支持划词翻译、沉浸式翻译、PDF、TTS 和广告拦截；图片 OCR、漫画翻译和 Native Host 已移除。

## 1. 安装扩展

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目根目录

## 2. 配置翻译服务

- Google 免费翻译和离线词典可直接使用
- OpenAI、Gemini、DeepSeek 需要在扩展设置页填写 API Key
- 详细字段说明见 [API 配置指南](./api-configuration.md)

## 3. 常用入口

- 划词翻译: 在网页中选中文本后，通过气泡、侧边栏或悬浮窗查看结果
- 沉浸式翻译: 使用快捷键 `Alt+I`
- Popup: 打开扩展弹窗进行文本翻译、查看历史和收藏
- PDF: 通过 Popup 中的「PDF翻译」入口进入
- TTS: 在设置页配置服务，在内容页面触发朗读

## 4. 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Alt+T` | 翻译选中文本 |
| `Alt+I` | 切换沉浸式翻译 |
| `Alt+S` | 显示/隐藏侧边栏 |
| `Alt+W` | 显示/隐藏翻译小窗 |

## 5. 进一步阅读

- [功能说明](../reference/features.md)
- [架构设计](../reference/architecture.md)
- [项目结构](../reference/project-structure.md)
- [开发指南](../contributing/development.md)
- [Native Host（已移除）](./native-host-setup.md)
