# Native Host 安装指南

## 概述

Native Host 是智译的本地 OCR 服务，基于 Python + PaddleOCR，用于图片文字识别和漫画翻译。

> 这是可选组件。不安装 Native Host 仍可使用所有文本翻译功能，仅本地 OCR 功能不可用。

## 系统要求

- Python 3.8+
- pip 包管理器
- 约 1GB 磁盘空间（PaddleOCR 模型）

## 安装步骤

### 1. 安装 Python 依赖

```bash
cd native-host
pip install -r requirements.txt
```

依赖包：
- `paddlepaddle` — PaddlePaddle 深度学习框架
- `paddleocr[doc-parser]>=2.9.0` — PaddleOCR 文字识别

### 2. 注册 Native Messaging 主机

#### macOS

```bash
# 创建 Native Messaging 目录
mkdir -p ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts

# 复制清单文件
cp native-host/com.smarttranslator.ocr_host.json \
   ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/

# 确保 ocr_host.py 有执行权限
chmod +x native-host/ocr_host.py
```

#### Linux

```bash
mkdir -p ~/.config/google-chrome/NativeMessagingHosts

cp native-host/com.smarttranslator.ocr_host.json \
   ~/.config/google-chrome/NativeMessagingHosts/

chmod +x native-host/ocr_host.py
```

#### Windows

```powershell
# 将清单文件路径写入注册表
REG ADD "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.smarttranslator.ocr_host" ^
    /ve /t REG_SZ /d "C:\path\to\native-host\com.smarttranslator.ocr_host.json" /f
```

### 3. 修改清单文件中的路径

编辑 `native-host/com.smarttranslator.ocr_host.json`，将 `path` 字段改为 `ocr_host.py` 的**绝对路径**：

```json
{
    "name": "com.smarttranslator.ocr_host",
    "description": "智译翻译 - 本地 OCR 服务 (PaddleOCR)",
    "path": "/你的实际路径/native-host/ocr_host.py",
    "type": "stdio",
    "allowed_origins": [
        "chrome-extension://你的扩展ID/"
    ]
}
```

### 4. 更新扩展 ID

1. 在 `chrome://extensions/` 找到智译扩展的 ID
2. 更新 `com.smarttranslator.ocr_host.json` 中的 `allowed_origins`

### 5. 验证安装

在扩展设置页中点击「测试 OCR 连接」，验证 Native Host 是否正常工作。

## 漫画翻译 API 服务

漫画翻译需要额外启动 FastAPI 服务：

```bash
cd native-host
./start_api.sh
```

服务默认监听 `localhost`，供扩展调用。

## 故障排查

| 问题 | 排查方向 |
|------|----------|
| OCR 连接失败 | 检查清单文件路径、扩展 ID、文件权限 |
| PaddleOCR 导入失败 | 确认 `paddlepaddle` 和 `paddleocr` 已安装 |
| 模型下载慢 | PaddleOCR 首次运行会下载模型，需稳定网络 |
| 漫画翻译无响应 | 确认 `start_api.sh` 已启动 |
