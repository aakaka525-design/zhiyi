"""
Smol-Docling OCR 引擎
"""

import re
import traceback

from utils.messaging import log
from utils.image import base64_to_image


def smol_docling_ocr(image_base64, image_width, image_height):
    """
    使用 Smol-Docling 模型进行 OCR
    返回带有坐标的文字识别结果
    """
    try:
        import torch
        from models.smol_docling_model import get_smol_docling
        model, processor = get_smol_docling()
        if model is None:
            return {"error": "SmolDocling model initialization failed"}
        
        img = base64_to_image(image_base64)
        real_width, real_height = img.size
        log(f"[smol_docling] Image size: {real_width}x{real_height}")
        
        prompt = "Convert this page to docling."
        
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image"},
                    {"type": "text", "text": prompt}
                ]
            }
        ]
        
        text = processor.apply_chat_template(messages, add_generation_prompt=True)
        inputs = processor(text=text, images=[img], return_tensors="pt")
        
        device = next(model.parameters()).device
        inputs = {k: v.to(device) if isinstance(v, torch.Tensor) else v for k, v in inputs.items()}
        
        log("[smol_docling] Running inference...")
        with torch.no_grad():
            generated_ids = model.generate(
                **inputs,
                max_new_tokens=8192,
                do_sample=False,
            )
        
        prompt_length = inputs["input_ids"].shape[1]
        trimmed_ids = generated_ids[:, prompt_length:]
        output = processor.batch_decode(trimmed_ids, skip_special_tokens=False)[0]
        log(f"[smol_docling] Raw output length: {len(output)}")
        
        # 解析 DocTags 输出
        boxes = []
        
        patterns = [
            r'<loc_(\d+)><loc_(\d+)><loc_(\d+)><loc_(\d+)><(\w+)>([^<]+)</\5>',
            r'<(\w+)><loc_(\d+)><loc_(\d+)><loc_(\d+)><loc_(\d+)>([^<]+)</\1>',
            r'<text>([^<]+)</text>',
        ]
        
        for pattern_idx, pattern in enumerate(patterns):
            matches = re.findall(pattern, output)
            for idx, match in enumerate(matches):
                if pattern_idx == 0:
                    x1, y1, x2, y2, tag, text = match
                elif pattern_idx == 1:
                    tag, x1, y1, x2, y2, text = match
                else:
                    text = match
                    x1, y1, x2, y2 = 0, idx * 100, 1000, idx * 100 + 80
                
                text = text.strip()
                if not text or len(text) < 2:
                    continue
                
                try:
                    x1_n, y1_n = int(x1), int(y1)
                    x2_n, y2_n = int(x2), int(y2)
                    box_2d = [y1_n, x1_n, y2_n, x2_n]
                except:
                    box_2d = [idx * 80, 50, idx * 80 + 60, 950]
                
                boxes.append({
                    "original": text,
                    "translated": "",
                    "box_2d": box_2d,
                    "confidence": 0.9
                })
                log(f"[smol_docling] Found text: '{text[:30]}' at {box_2d}")
        
        log(f"[smol_docling] Total boxes found: {len(boxes)}")
        return {"boxes": boxes}
        
    except Exception as e:
        log(f"[smol_docling] Error: {e}")
        log(traceback.format_exc())
        return {"error": str(e)}
