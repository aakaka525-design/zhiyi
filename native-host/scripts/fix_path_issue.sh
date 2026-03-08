#!/bin/bash
# 自动修复脚本：将 Native Host 移动到无中文路径并重新注册

TARGET_DIR="$HOME/debug_ocr_host"
SOURCE_SCRIPT="../ocr_host.py"
MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
EXTENSION_ID="ebdomkkaenblolfpaldccljemmokffjc" # 请确保这是正确的 ID

echo "=== 开始修复 Native Host 路径问题 ==="

# 1. 创建纯英文路径目录
echo "创建目录: $TARGET_DIR"
mkdir -p "$TARGET_DIR"

# 2. 复制脚本
echo "复制 ocr_host.py..."
cp "$SOURCE_SCRIPT" "$TARGET_DIR/ocr_host.py"
chmod +x "$TARGET_DIR/ocr_host.py"

# 3. 生成新的 Manifest 文件
MANIFEST_FILE="$TARGET_DIR/com.smarttranslator.ocr_host.json"
echo "生成 Manifest 文件..."

cat > "$MANIFEST_FILE" <<EOF
{
    "name": "com.smarttranslator.ocr_host",
    "description": "智译翻译 - 本地 OCR 服务 (PaddleOCR)",
    "path": "$TARGET_DIR/ocr_host.py",
    "type": "stdio",
    "allowed_origins": [
        "chrome-extension://$EXTENSION_ID/"
    ]
}
EOF

# 4. 安装 Manifest 到 Chrome
echo "安装 Manifest 到 Chrome..."
mkdir -p "$MANIFEST_DIR"
cp "$MANIFEST_FILE" "$MANIFEST_DIR/"

echo "=== 修复完成 ==="
echo "新的 Host 如果位于: $TARGET_DIR/ocr_host.py"
echo ""
echo "请务必：完全重启 Chrome (Command+Q) 后再试！"
