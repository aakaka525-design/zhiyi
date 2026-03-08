#!/bin/bash
# Native Messaging Host Wrapper Script
# IMPORTANT: Do NOT redirect stdout - it's used for Native Messaging protocol

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PYTHON_PATH="/Applications/Anaconda/anaconda3/bin/python3"
HOST_SCRIPT="$SCRIPT_DIR/../ocr_host.py"

exec "$PYTHON_PATH" "$HOST_SCRIPT"
