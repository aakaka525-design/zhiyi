# 智译 - Smart Translator

> Chrome 智能翻译扩展 — 支持划词翻译、沉浸式翻译、图片 OCR、漫画翻译、PDF 翻译

## 功能概览

| 功能 | 说明 |
|------|------|
| 划词翻译 | 选中文本自动翻译，支持浮窗 / 侧边栏 / 浮动球 |
| 沉浸式翻译 | 网页内联双语对照翻译 |
| 图片 OCR | 基于 PaddleOCR 的本地 OCR 识别与翻译 |
| 漫画翻译 | 检测漫画气泡文字并原位替换翻译 |
| PDF 翻译 | 文档翻译支持 |
| 语音朗读 | 多引擎 TTS（系统 / OpenAI / Edge / Fish Audio） |
| 广告拦截 | 基于 declarativeNetRequest 的轻量拦截 |

## 翻译引擎

- Google 翻译（免费，无需密钥）
- OpenAI（需 API Key）
- Google Gemini（需 API Key）
- DeepSeek（需 API Key）
- QwenVL 视觉模型（需 API Key）
- 离线词典（内置，无需网络）

## 快速开始

### 安装扩展

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本项目根目录

### 配置 API 密钥

参考 [API 配置指南](docs/api-configuration.md)

### 安装本地 OCR（可选）

参考 [Native Host 安装指南](docs/native-host-setup.md)

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
| [项目结构](docs/project-structure.md) | 目录与文件说明 |
| [架构设计](docs/architecture.md) | 系统架构与模块关系 |
| [功能说明](docs/features.md) | 各功能详细说明 |
| [API 配置](docs/api-configuration.md) | 翻译引擎密钥配置 |
| [Native Host](docs/native-host-setup.md) | 本地 OCR 服务安装 |
| [开发指南](docs/development.md) | 开发、调试与贡献 |
| [审核计划](docs/audit/AUDIT_PLAN.md) | 项目全面审核计划 |

## 技术栈

- **扩展前端**: JavaScript (ES6 Modules) + HTML5 + CSS3
- **后台服务**: Chrome Service Worker (Manifest V3)
- **本地 OCR**: Python 3 + FastAPI + PaddleOCR
- **存储**: Chrome Storage API

## 许可证

Private - All Rights Reserved
