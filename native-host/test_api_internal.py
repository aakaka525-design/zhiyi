
import os
import sys
import base64
import io
from PIL import Image

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ocr.detector import detect_text
from ocr.renderer import render_translation

def test_internal():
    img_path = "test_data/manga_image/1-1-0.jpg"
    print(f"Loading {img_path}...")
    
    with open(img_path, "rb") as f:
        img_bytes = f.read()
        
    img_b64 = base64.b64encode(img_bytes).decode('utf-8')
    img_str = f"data:image/jpeg;base64,{img_b64}"
    
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    width, height = img.size
    
    print("Running detect_text...")
    # use_ai=False to test local OCR first, assume faster & less prone to API key issues for now
    # But user wants API which uses AI? Let's try use_ai=True as that's what failed
    result = detect_text(img_str, width, height, use_ai=True)
    
    if "error" in result:
        print(f"Error: {result['error']}")
        return
        
    boxes = result.get("boxes", [])
    print(f"Got {len(boxes)} boxes")
    
    print("Rendering...")
    final_img = render_translation(img, boxes)
    
    out_path = "test_data/internal_test.jpg"
    final_img.save(out_path)
    print(f"Saved to {out_path}")

if __name__ == "__main__":
    test_internal()
