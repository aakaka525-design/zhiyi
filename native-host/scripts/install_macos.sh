#!/bin/bash
# 智译翻译 - Native Messaging Host 安装脚本 (macOS)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_NAME="com.smarttranslator.ocr_host"
HOST_PATH="$(cd "$SCRIPT_DIR/.." && pwd)/ocr_host.py"

# 检测浏览器
CHROME_MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
EDGE_MANIFEST_DIR="$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"

echo "================================"
echo "智译翻译 - Native Host 安装脚本"
echo "================================"
echo ""

# 获取扩展 ID
echo "请输入你的扩展 ID（可以在 chrome://extensions 中找到）:"
read -p "> " EXTENSION_ID

if [ -z "$EXTENSION_ID" ]; then
    echo "错误：扩展 ID 不能为空"
    exit 1
fi

# 创建 manifest
cat > "$SCRIPT_DIR/../com.smarttranslator.ocr_host.json" << EOF
{
    "name": "$HOST_NAME",
    "description": "智译翻译 - 本地 OCR 服务 (PaddleOCR)",
    "path": "$HOST_PATH",
    "type": "stdio",
    "allowed_origins": [
        "chrome-extension://$EXTENSION_ID/"
    ]
}
EOF

# 设置权限
chmod +x "$HOST_PATH"

# 安装到 Chrome
if [ -d "$HOME/Library/Application Support/Google/Chrome" ]; then
    mkdir -p "$CHROME_MANIFEST_DIR"
    cp "$SCRIPT_DIR/../com.smarttranslator.ocr_host.json" "$CHROME_MANIFEST_DIR/"
    echo "✓ 已安装到 Chrome"
fi

# 安装到 Edge
if [ -d "$HOME/Library/Application Support/Microsoft Edge" ]; then
    mkdir -p "$EDGE_MANIFEST_DIR"
    cp "$SCRIPT_DIR/$HOST_NAME.json" "$EDGE_MANIFEST_DIR/"
    echo "✓ 已安装到 Edge"
fi

echo ""
echo "================================"
echo "安装完成！"
echo ""
echo "接下来请安装 Python 依赖:"
echo "  pip install paddlepaddle paddleocr"
echo ""
echo "然后在扩展设置中选择'本地 OCR (PaddleOCR)'"
echo "================================"
