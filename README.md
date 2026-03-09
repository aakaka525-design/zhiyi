# 智译 - Smart Translator

> Chrome 智能翻译扩展 — 支持划词翻译、沉浸式翻译、PDF 翻译、语音朗读和广告拦截

> 当前版本已移除图片 OCR、漫画翻译和 Native Host 本地服务。

## 功能概览

| 功能 | 说明 |
|------|------|
| 划词翻译 | 选中文本后可通过气泡、侧边栏或悬浮窗查看翻译结果 |
| 沉浸式翻译 | 在网页原文下方插入译文，形成双语对照阅读体验 |
| PDF 翻译 | 提供 PDF 翻译入口，具体处理逻辑位于 `src/core/pdf.js` |
| 语音朗读 | 支持系统语音和多服务 TTS 配置 |
| 广告拦截 | 基于内容脚本的轻量 DOM 清理，减少常见广告干扰 |
| 历史与收藏 | 保存翻译历史与收藏内容，便于回查 |

## 翻译引擎

- Google 翻译（免费，无需密钥）
- OpenAI（需 API Key）
- Google Gemini（需 API Key）
- DeepSeek（需 API Key）
- 离线词典（内置，无需网络）

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
