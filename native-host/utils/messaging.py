
import sys
import os
import json
import struct

LOG_FILE = "/tmp/ocr_host_debug.log"

def log(msg):
    try:
        with open(LOG_FILE, "a") as f:
            f.write(msg + "\n")
    except:
        pass

def read_message(stdin_buffer=sys.stdin.buffer):
    try:
        log("Reading message length...")
        raw_length = stdin_buffer.read(4)
        if not raw_length:
            log("EOF received")
            return None
        message_length = struct.unpack('<I', raw_length)[0]
        log(f"Message length: {message_length}")
        
        message = stdin_buffer.read(message_length).decode('utf-8')
        log(f"Message content: {message[:100]}...")
        return json.loads(message)
    except Exception as e:
        log(f"Error reading message: {e}")
        return None

def send_message(message, stdout_buffer):
    try:
        log(f"Sending response: {str(message)[:100]}...")
        encoded = json.dumps(message, ensure_ascii=False).encode('utf-8')
        stdout_buffer.write(struct.pack('<I', len(encoded)))
        stdout_buffer.write(encoded)
        stdout_buffer.flush()
        log("Response sent")
    except Exception as e:
        log(f"Error sending message: {e}")
