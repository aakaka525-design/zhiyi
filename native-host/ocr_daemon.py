#!/usr/bin/env python3
"""
OCR Daemon - 常驻进程，保持模型预加载
通过 Unix Socket 接收请求，5 分钟空闲自动退出
"""

import os
import sys
import json
import socket
import signal
import threading
import time
import traceback

# 设置工作目录
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(SCRIPT_DIR)
sys.path.insert(0, SCRIPT_DIR)

# 配置
SOCKET_PATH = "/tmp/ocr_daemon.sock"
IDLE_TIMEOUT = 300  # 5 分钟空闲超时
LOG_FILE = "/tmp/ocr_daemon.log"

# 全局状态
last_activity_time = time.time()
shutdown_flag = False
detector_cache = {}

def log(msg):
    """写入日志"""
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {msg}\n"
    try:
        with open(LOG_FILE, "a") as f:
            f.write(line)
    except:
        pass

def preload_detector(detector_type='mobile'):
    """预加载检测器模型"""
    global detector_cache
    if detector_type in detector_cache:
        return detector_cache[detector_type]
    
    try:
        log(f"Preloading {detector_type} detector...")
        import paddlex
        model_name = 'PP-OCRv5_mobile_det' if detector_type == 'mobile' else 'PP-OCRv5_server_det'
        detector = paddlex.create_model(model_name)
        detector_cache[detector_type] = detector
        log(f"Detector {detector_type} loaded successfully")
        return detector
    except Exception as e:
        log(f"Error loading detector: {e}")
        return None

def handle_request(request_data):
    """处理单个请求"""
    global last_activity_time
    last_activity_time = time.time()
    
    try:
        msg = json.loads(request_data)
        action = msg.get('action')
        log(f"Daemon received action: {action}")
        
        if action == 'ping':
            detector_type = msg.get('detector_type', 'mobile')
            det = preload_detector(detector_type)
            return json.dumps({
                "status": "ok",
                "daemon": True,
                "detector_loaded": det is not None
            })
        
        elif action == 'detect_ai':
            # 导入检测逻辑
            from ocr import detect_text
            
            image = msg.get('image', '')
            width = msg.get('width', 1000)
            height = msg.get('height', 1000)
            api_key = msg.get('api_key', None)
            detector_type = msg.get('detector_type', 'mobile')
            
            # 确保检测器已加载
            preload_detector(detector_type)
            
            result = detect_text(image, width, height, use_ai=True, api_key=api_key, detector_type=detector_type)
            return json.dumps(result)
        
        elif action == 'shutdown':
            global shutdown_flag
            shutdown_flag = True
            return json.dumps({"status": "shutting_down"})
        
        else:
            return json.dumps({"error": f"Unknown action: {action}"})
            
    except Exception as e:
        log(f"Error handling request: {e}")
        log(traceback.format_exc())
        return json.dumps({"error": str(e)})

def handle_client(conn):
    """处理客户端连接"""
    try:
        # 读取请求长度（4字节）
        length_data = conn.recv(4)
        if not length_data:
            return
        
        import struct
        length = struct.unpack('<I', length_data)[0]
        
        # 读取请求内容
        data = b''
        while len(data) < length:
            chunk = conn.recv(min(65536, length - len(data)))
            if not chunk:
                break
            data += chunk
        
        request = data.decode('utf-8')
        
        # 处理请求
        response = handle_request(request)
        
        # 发送响应
        response_bytes = response.encode('utf-8')
        conn.sendall(struct.pack('<I', len(response_bytes)))
        conn.sendall(response_bytes)
        
    except Exception as e:
        log(f"Client handler error: {e}")
    finally:
        conn.close()

def idle_watchdog():
    """空闲超时监控"""
    global shutdown_flag
    while not shutdown_flag:
        time.sleep(10)
        idle_time = time.time() - last_activity_time
        if idle_time > IDLE_TIMEOUT:
            log(f"Idle timeout ({IDLE_TIMEOUT}s), shutting down...")
            shutdown_flag = True
            break

def cleanup():
    """清理 socket 文件"""
    try:
        if os.path.exists(SOCKET_PATH):
            os.unlink(SOCKET_PATH)
    except:
        pass

def signal_handler(signum, frame):
    """信号处理"""
    global shutdown_flag
    log(f"Received signal {signum}, shutting down...")
    shutdown_flag = True

def main():
    global shutdown_flag
    
    log("="*50)
    log("OCR Daemon starting...")
    log(f"Socket: {SOCKET_PATH}")
    log(f"Idle timeout: {IDLE_TIMEOUT}s")
    
    # 清理旧 socket
    cleanup()
    
    # 注册信号处理
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    # 创建 Unix socket
    server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(SOCKET_PATH)
    server.listen(5)
    server.settimeout(1.0)  # 1秒超时用于检查 shutdown_flag
    
    # 启动空闲监控线程
    watchdog = threading.Thread(target=idle_watchdog, daemon=True)
    watchdog.start()
    
    # 预加载默认检测器
    preload_detector('mobile')
    
    log("Daemon ready, waiting for connections...")
    
    try:
        while not shutdown_flag:
            try:
                conn, addr = server.accept()
                # 用线程处理客户端（支持并发）
                client_thread = threading.Thread(target=handle_client, args=(conn,), daemon=True)
                client_thread.start()
            except socket.timeout:
                continue
            except Exception as e:
                if not shutdown_flag:
                    log(f"Accept error: {e}")
    finally:
        server.close()
        cleanup()
        log("Daemon stopped")

if __name__ == "__main__":
    main()
