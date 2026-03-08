
import os
import sys
import io
import uvicorn
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from PIL import Image

# ==============================================================================
# Environment Configuration (Must be before imports)
# ==============================================================================
os.environ['DISABLE_MODEL_SOURCE_CHECK'] = 'True'
os.environ['PADDLEX_NO_CHECK'] = 'True'
try:
    mpl_cache = "/tmp/mpl_cache"
    if not os.path.exists(mpl_cache): os.makedirs(mpl_cache)
    os.environ['MPLCONFIGDIR'] = mpl_cache
except: pass

# Add current dir to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ocr.detector import detect_text
from ocr.renderer import render_translation

app = FastAPI(title="Manga Translation API")

from starlette.concurrency import run_in_threadpool
import traceback
from models.paddle_model import get_detector

@app.on_event("startup")
def startup_event():
    print("Pre-loading OCR models...")
    # Trigger model load
    get_detector()
    print("OCR models loaded.")

# Semaphore to limit concurrent OCR steps
# PaddleOCR CPU mode is resource heavy and not thread-safe.
# Limit to 1 significantly reduces CPU pressure and prevents crashes.
import asyncio
ocr_lock = asyncio.Semaphore(1)

@app.post("/translate")
async def translate_manga(
    file: UploadFile = File(...),
    use_ai: bool = Form(True),
    target_lang: str = Form("zh")
):
    try:
        # 1. Load Image
        print("Reading uploaded file...")
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        width, height = image.size
        print(f"Image loaded: {width}x{height}")
        
        # 2. Encode to Base64 for OCR function
        import base64
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG")
        img_b64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        img_str = f"data:image/jpeg;base64,{img_b64}"

        # 3. Detect (Guarded by Lock, CPU Heavy)
        print("Waiting for OCR slot...")
        async with ocr_lock:
            print("Starting detection (blocking)...")
            from ocr.detector import detect_regions_and_crops
            
            det_result = await run_in_threadpool(
                detect_regions_and_crops,
                image_base64=img_str,
                image_width=width,
                image_height=height
            )
        print("Detection complete. Releasing lock.")
        
        if "error" in det_result:
           return {"error": det_result["error"]}
           
        crops_data = det_result.get("result", [])
        print(f"Got {len(crops_data)} regions. Starting Parallel AI Translation (IO Bound)...")
        
        # 4. Parallel AI Translation (Unlocked, IO Bound)
        # Use ThreadPool to send requests concurrently
        from utils.ai_service import translate_crop_ai
        from concurrent.futures import ThreadPoolExecutor, as_completed
        
        boxes = []
        if use_ai and crops_data:
             def process_one(cd):
                 try:
                     ai_res = translate_crop_ai(cd['crop_bytes'])
                     text = ""
                     translation = ""
                     if "|" in ai_res:
                         parts = ai_res.split("|")
                         text = parts[0].replace("OCR:", "").strip()
                         translation = parts[1].replace("Translation:", "").strip()
                     else:
                         text = ai_res
                         translation = ai_res # Fallback
                     return {
                         "box_2d": cd['box_2d'],
                         "text": text,
                         "translation": translation
                     }
                 except Exception as e:
                     print(f"AI Error: {e}")
                     return {
                         "box_2d": cd['box_2d'],
                         "text": "",
                         "translation": ""
                     }

             loop = asyncio.get_event_loop()
             # Run threadpool in executor to not block async loop
             with ThreadPoolExecutor(max_workers=10) as executor:
                 # Wrap executor map in run_in_executor
                 futures = [
                     loop.run_in_executor(executor, process_one, cd)
                     for cd in crops_data
                 ]
                 # Wait for all
                 boxes = await asyncio.gather(*futures)
                 
        else:
             boxes = crops_data # No translation

        print(f"Translation complete.")
        if boxes:
            print(f"Sample Box 0: {boxes[0]}")
            for i, b in enumerate(boxes[:3]):
                print(f"Box {i} translation: '{b.get('translation', '')}'")
        
        # 4. Render
        print("Rendering...")
        final_image = render_translation(image, boxes)
        
        # 5. Return Image
        output_buffer = io.BytesIO()
        final_image.save(output_buffer, format="JPEG", quality=85)
        output_buffer.seek(0)
        print(f"Returning image size: {output_buffer.getbuffer().nbytes}")
        
        return StreamingResponse(output_buffer, media_type="image/jpeg")
        
    except Exception as e:
        print(f"Server Error: {e}")
        traceback.print_exc()
        return {"error": str(e)}

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
