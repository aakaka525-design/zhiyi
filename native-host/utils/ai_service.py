
import os
import base64
from openai import OpenAI
from utils.messaging import log

def get_ai_config():
    """从 config.txt 加载配置"""
    # 路径应该是项目根目录下的 config.txt
    # __file__ 是 native-host/utils/ai_service.py
    # 根目录是 native-host/..
    config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "config.txt")
    
    # Defaults
    config = {
        "api_key": "",
        "base_url": "https://api.ppinfra.com/openai",
        "model": "qwen/qwen3-vl-235b-a22b-instruct"
    }

    if os.path.exists(config_path):
        try:
            with open(config_path, "r") as f:
                content = f.read()
                for line in content.splitlines():
                    line = line.strip()
                    if line.startswith("API_key="):
                        config["api_key"] = line.split("=", 1)[1].strip()
                    elif line.startswith("Base_URL="):
                        config["base_url"] = line.split("=", 1)[1].strip()
                    elif line.startswith("Model="):
                        config["model"] = line.split("=", 1)[1].strip()
        except Exception as e:
            log(f"[ai_service] Error reading config: {e}")

    return config


def translate_crop_ai(crop_bytes, model_name="qwen/qwen3-vl-30b-a3b-instruct", api_key=None):
    """使用 Qwen-VL 模型进行 OCR + 翻译"""
    config = get_ai_config()
    # 优先使用传入的 api_key，否则 fallback 到 config.txt
    effective_api_key = api_key or config["api_key"]
    if not effective_api_key:
        return "Error: No API Key found"

    # Use model from config if available, otherwise use default
    actual_model = config.get("model") or model_name
    
    log(f"[ai_service] Using Model: {actual_model}")
    print(f"[ai_service] Using Model: {actual_model}") # Console output
    log(f"[ai_service] Using Base URL: {config['base_url']}")
    print(f"[ai_service] Using Base URL: {config['base_url']}") # Console output

    client = OpenAI(
        api_key=effective_api_key,
        base_url=config["base_url"],
        timeout=60.0 # 60 seconds timeout
    )
    
    # Encode crop to base64
    base64_image = base64.b64encode(crop_bytes).decode('utf-8')
    
    try:
        response = client.chat.completions.create(
            model=actual_model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Perform OCR on the English text in this image and translate it into Chinese. Return only the following format: OCR: [English text] | Translation: [Chinese text]"
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=300
        )
        
        result = response.choices[0].message.content
        log(f"[ai_service] AI Result: {result}")
        return result
    except Exception as e:
        log(f"[ai_service] API Error: {e}")
        return f"Error: {str(e)}"

