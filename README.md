# 智译 - Smart Translator

> Chrome 智能翻译扩展 — 支持划词翻译、沉浸式翻译、语音朗读和广告拦截

> 当前版本已移除图片 OCR、漫画翻译和 Native Host 本地服务。

## 功能概览

| 功能 | 说明 |
|------|------|
| 划词翻译 | 选中文本后可通过气泡、侧边栏或悬浮窗查看翻译结果 |
| 沉浸式翻译 | 支持双语对照和替换模式，可在网页中直接阅读译文 |
| 原文悬停气泡 | 替换模式下可悬停译文查看原文，减少版面干扰 |
| 悬浮翻译胶囊 | 页面右下角提供可拖拽的悬浮入口，快捷打开沉浸翻译、小窗和侧边栏 |
| 语音朗读 | 支持系统语音和多服务 TTS 配置 |
| 广告拦截 | 基于内容脚本的轻量 DOM 清理，减少常见广告干扰 |
| 历史与收藏 | 保存翻译历史与收藏内容，便于回查 |

## 兼容性与体验

- 动态页面沉浸翻译已针对 Discord、Telegram、X/Twitter 等滚动加载场景补强去重与缓存。
- GitHub、LinkedIn 等站点的文件名、元数据、职位卡等非正文区域会尽量跳过，减少误翻译。
- 代码块、`translate="no"` 和高置信受保护内容会优先排除，避免把技术片段误送去翻译。

## 翻译引擎

- Google 翻译（免费，无需密钥）
- OpenAI（需 API Key）
- Google Gemini（需 API Key）
- DeepSeek（需 API Key）
- 离线词典（当前仅英译中，无需网络）

## 快速开始

### 安装扩展

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本项目根目录

### 配置 API 密钥

参考 [API 配置指南](docs/guide/api-configuration.md)。

完整安装与使用说明见 [快速上手](docs/guide/getting-started.md)。

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Alt+T` | 翻译选中文本 |
| `Alt+I` | 切换沉浸式翻译 |
| `Alt+S` | 显示/隐藏侧边栏 |
| `Alt+W` | 显示/隐藏翻译小窗 |

## 文档

| 文档 | 说明 |
|------|------|
| [文档索引](docs/README.md) | docs 目录总览 |
| [快速上手](docs/guide/getting-started.md) | 安装、配置与常用入口 |
| [项目结构](docs/reference/project-structure.md) | 目录与文件说明 |
| [架构设计](docs/reference/architecture.md) | 当前系统架构与模块关系 |
| [功能说明](docs/reference/features.md) | 各功能详细说明 |
| [API 配置](docs/guide/api-configuration.md) | 翻译引擎密钥配置 |
| [开发指南](docs/contributing/development.md) | 开发、调试与发布流程 |
| [Native Host（已移除）](docs/guide/native-host-setup.md) | 已下线功能的历史说明 |
| [协作工作台](docs/workbench/) | 内部任务、讨论与执行报告 |

## 技术栈

- **扩展前端**: JavaScript (ES6 Modules) + HTML5 + CSS3
- **后台服务**: Chrome Service Worker (Manifest V3)
- **音频播放**: Offscreen Document
- **存储**: Chrome Storage API

## 许可证

Private - All Rights Reserved
