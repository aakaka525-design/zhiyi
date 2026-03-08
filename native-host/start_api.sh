#!/bin/bash
# start_api.sh

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "Starting Manga Translation API..."

# Set necessary environment variables for optimization and bypassing checks
export DISABLE_MODEL_SOURCE_CHECK=True
export PADDLEX_NO_CHECK=True
export MPLCONFIGDIR=/tmp/mpl_cache

# Check for Anaconda Python first
if [ -f "/Applications/Anaconda/anaconda3/bin/python3" ]; then
    PYTHON_CMD="/Applications/Anaconda/anaconda3/bin/python3"
elif command -v python3 &> /dev/null; then
    PYTHON_CMD=python3
else
    PYTHON_CMD=python
fi

# Run the server
$PYTHON_CMD api_server.py
