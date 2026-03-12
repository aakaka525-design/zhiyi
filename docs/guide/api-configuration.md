# API 配置指南

## 概述

智译支持多个翻译引擎，部分引擎需要 API 密钥。Google 免费翻译和离线词典无需配置。

## 配置方式

打开扩展设置页（右键扩展图标 → 选项），在对应引擎区域填入 API 密钥。

## 引擎配置

### Google 翻译（免费）

无需配置，开箱即用。

> 注意：免费接口有请求频率限制，大量翻译时可能触发限流。

### OpenAI

| 字段 | 说明 |
|------|------|
| API Key | 以 `sk-` 开头的密钥 |
| Base URL | 默认 `https://api.openai.com/v1`，可自定义兼容接口 |
| Model | 默认 `gpt-4o-mini`，可选 `gpt-4o` 等 |

获取密钥：[platform.openai.com/api-keys](https://platform.openai.com/api-keys)

### Google Gemini

| 字段 | 说明 |
|------|------|
| API Key | Google AI Studio 密钥 |
| Model | 默认 `gemini-2.5-flash` |

获取密钥：[aistudio.google.com/apikey](https://aistudio.google.com/apikey)

### DeepSeek

> 当前设置页中的 DeepSeek 区域使用 ppinfra 兼容接口配置。

| 字段 | 说明 |
|------|------|
| API Key | ppinfra API 密钥 |
| Base URL | 默认 `https://api.ppinfra.com/openai` |
| Model | 默认 `deepseek/deepseek-ocr` |

### 离线翻译

无需配置。使用内置词典（`assets/dictionaries/`）。

> 当前仓库仅内置 `en-zh` 词典，离线翻译仅支持英译中。

## 安全提示

- API 密钥存储在 Chrome 本地存储中，不会上传到项目仓库
- **不要**将包含真实密钥的 `config.txt` 提交到版本控制
- 如需本地私有配置模板，请从 `config.example.txt` 复制生成 `config.txt`
- 建议为翻译用途单独创建 API 密钥，并设置用量限制
