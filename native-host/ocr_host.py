#!/Applications/Anaconda/anaconda3/bin/python3
import sys
import os
import subprocess
import socket
import struct
import json
import time

# ==============================================================================
# Bulletproof Startup Section
# ==============================================================================
# 1. 立即重定向 stdout 到 stderr (OS 层面)
# Preserve original stdout for Native Messaging communication
try:
    # 保存原始 stdout fd 用于 Native Messaging
    NATIVE_STDOUT_FD = os.dup(sys.stdout.fileno())
    native_stdout = os.fdopen(NATIVE_STDOUT_FD, 'wb')
    
    # 在 OS 层面将 fd=1 重定向到 stderr
    # 这样 C 库的输出也会被重定向
    os.dup2(sys.stderr.fileno(), sys.stdout.fileno())
    sys.stdout = sys.stderr
except Exception:
    # If this fails, we are in trouble, but let's try to proceed using buffer
    native_stdout = sys.stdout.buffer

# 2. 禁用模型源检查（必须在任何 paddle 导入之前）
os.environ['DISABLE_MODEL_SOURCE_CHECK'] = 'True'
os.environ['PADDLEX_NO_CHECK'] = 'True'

# 3. 配置 matplotlib 缓存
try:
    mpl_cache = "/tmp/mpl_cache"
    if not os.path.exists(mpl_cache):
        os.makedirs(mpl_cache)
    os.environ['MPLCONFIGDIR'] = mpl_cache
except Exception:
    pass

# 4. 导入模块 - 只导入轻量级模块，OCR 模块延迟加载
try:
    # 确保当前目录在 path 中
    current_dir = os.path.dirname(os.path.abspath(__file__))
    if current_dir not in sys.path:
        sys.path.insert(0, current_dir)
        
    from utils.messaging import log, read_message, send_message
    # OCR 模块延迟导入，避免启动时加载 paddlex（需要 20+ 秒）
except Exception as e:
    # Fallback logging
    with open("/tmp/ocr_host_debug.log", "a") as f:
        f.write(f"CRITICAL: Failed to import modules: {e}\n")
    sys.exit(1)

# 延迟加载的 OCR 函数
_ocr_module = None

def get_ocr_module():
    global _ocr_module
    if _ocr_module is None:
        log("[host] Loading OCR module (this may take a moment)...")
        from ocr import detect_regions_only, detect_text, smol_docling_ocr, paddleocr_vl_ocr
        _ocr_module = {
            'detect_regions_only': detect_regions_only,
            'detect_text': detect_text,
            'smol_docling_ocr': smol_docling_ocr,
            'paddleocr_vl_ocr': paddleocr_vl_ocr
        }
        log("[host] OCR module loaded")
    return _ocr_module

# ==============================================================================
# Daemon Communication
# ==============================================================================
SOCKET_PATH = "/tmp/ocr_daemon.sock"
DAEMON_SCRIPT = os.path.join(current_dir, "ocr_daemon.py")
PYTHON_PATH = "/Applications/Anaconda/anaconda3/bin/python3"

def is_daemon_running():
    """检查守护进程是否运行"""
    return os.path.exists(SOCKET_PATH)

def start_daemon():
    """启动守护进程"""
    log("[host] Starting OCR daemon...")
    try:
        # 在后台启动守护进程
        subprocess.Popen(
            [PYTHON_PATH, DAEMON_SCRIPT],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True
        )
        # 等待 socket 可用
        for _ in range(30):  # 最多等 3 秒
            time.sleep(0.1)
            if os.path.exists(SOCKET_PATH):
                log("[host] Daemon started successfully")
                return True
        log("[host] Daemon startup timeout")
        return False
    except Exception as e:
        log(f"[host] Failed to start daemon: {e}")
        return False

def send_to_daemon(msg):
    """发送请求到守护进程"""
    try:
        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        sock.connect(SOCKET_PATH)
        
        # 发送请求
        msg_bytes = json.dumps(msg).encode('utf-8')
        sock.sendall(struct.pack('<I', len(msg_bytes)))
        sock.sendall(msg_bytes)
        
        # 接收响应长度
        length_data = sock.recv(4)
        if not length_data:
            return {"error": "No response from daemon"}
        length = struct.unpack('<I', length_data)[0]
        
        # 接收响应内容
        data = b''
        while len(data) < length:
            chunk = sock.recv(min(65536, length - len(data)))
            if not chunk:
                break
            data += chunk
        
        sock.close()
        return json.loads(data.decode('utf-8'))
    except Exception as e:
        log(f"[host] Daemon communication error: {e}")
        return {"error": str(e)}

def forward_to_daemon(msg):
    """转发请求到守护进程，必要时启动守护进程"""
    if not is_daemon_running():
        if not start_daemon():
            return {"error": "Failed to start daemon"}
    
    result = send_to_daemon(msg)
    
    # 如果通信失败，尝试重启守护进程
    if "error" in result and "Connection refused" in str(result.get("error", "")):
        log("[host] Daemon connection refused, restarting...")
        if os.path.exists(SOCKET_PATH):
            os.unlink(SOCKET_PATH)
        if start_daemon():
            result = send_to_daemon(msg)
    
    return result

# ==============================================================================
# Main Handler
# ==============================================================================
def main():
    log("--- SCRIPT STARTED (Refactored) ---")
    log(f"CWD: {os.getcwd()}")
    log(f"User: {os.environ.get('USER')}")
    
    while True:
        msg = read_message()
        if not msg:
            break
            
        action = msg.get('action')
        log(f"Action: {action}")
        
        if action == 'ping':
            # ping 快速响应，不加载任何重量级模块
            daemon_running = is_daemon_running()
            # 假设 paddlex 已安装（安装脚本已验证）
            send_message({
                "status": "ok", 
                "paddle_available": True, 
                "daemon_running": daemon_running
            }, native_stdout)
            
        elif action == 'smol_docling':
            ocr = get_ocr_module()
            res = ocr['smol_docling_ocr'](msg.get('image', ''), msg.get('width', 1000), msg.get('height', 1000))
            send_message(res, native_stdout)
        
        elif action == 'paddleocr_vl':
            ocr = get_ocr_module()
            res = ocr['paddleocr_vl_ocr'](msg.get('image', ''), msg.get('width', 1000), msg.get('height', 1000))
            send_message(res, native_stdout)
            

        elif action == 'detect_only':
            ocr = get_ocr_module()
            res = ocr['detect_regions_only'](msg.get('image', ''), msg.get('width', 1000), msg.get('height', 1000))
            send_message(res, native_stdout)
            
        elif action == 'detect_ai':
            # 转发到守护进程处理
            log("[host] Forwarding detect_ai to daemon...")
            res = forward_to_daemon(msg)
            send_message(res, native_stdout)
            
        elif action in ['detect', 'detect_and_translate']:
            # 如果启用了 AI 模式，也转发到守护进程
            use_ai = msg.get('use_ai', False)
            if use_ai:
                log("[host] Forwarding detect to daemon (use_ai=True)...")
                res = forward_to_daemon({**msg, 'action': 'detect_ai'})
            else:
                ocr = get_ocr_module()
                api_key = msg.get('api_key', None)
                detector_type = msg.get('detector_type', 'server')
                res = ocr['detect_text'](msg.get('image', ''), msg.get('width', 1000), msg.get('height', 1000), use_ai=False, api_key=api_key, detector_type=detector_type)
            send_message(res, native_stdout)
            
        else:
            send_message({"error": "unknown action"}, native_stdout)

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        log(f"Fatal error: {e}")
