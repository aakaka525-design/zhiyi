#!/Applications/Anaconda/anaconda3/bin/python3
import sys
import struct
import json

# 简单日志
with open("/tmp/test_native.log", "w") as f:
    f.write("Script started\n")

# 读取消息长度
raw_length = sys.stdin.buffer.read(4)
if raw_length:
    length = struct.unpack('<I', raw_length)[0]
    message = sys.stdin.buffer.read(length)
    
    with open("/tmp/test_native.log", "a") as f:
        f.write(f"Got message: {message}\n")
    
    # 发送响应
    response = json.dumps({"status": "ok", "test": True}).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('<I', len(response)))
    sys.stdout.buffer.write(response)
    sys.stdout.buffer.flush()
    
    with open("/tmp/test_native.log", "a") as f:
        f.write("Response sent\n")
