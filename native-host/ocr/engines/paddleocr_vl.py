"""
PaddleOCR-VL 1B 模型 OCR 引擎
独立的大模型模式，不属于混合模式。
"""

import os
import io
import traceback

from PIL import Image

from utils.messaging import log
from utils.image import decode_image_data, temp_save_image
from ocr.parsers import parse_paddleocr_vl_output
from ocr.regions import filter_duplicate_regions, merge_text_regions


def paddleocr_vl_ocr(image_base64, image_width, image_height):
    """
    使用 PaddleOCR-VL 1B 模型进行 OCR
    """
    try:
        from models.paddleocr_vl_model import get_paddleocr_vl
        pipeline = get_paddleocr_vl()
    except Exception as e:
        log(f"[paddleocr_vl] Failed to load PaddleOCR-VL model: {e}")
        return {"regions": [], "error": "Failed to load PaddleOCR-VL model"}

    log("[paddleocr_vl] Version 2.0: Slicing Logic Enabled")
    SLICE_HEIGHT = 3500
    OVERLAP = 200
    
    # 解码图片
    try:
        img_data = decode_image_data(image_base64)
        img = Image.open(io.BytesIO(img_data))
        real_width, real_height = img.size
        log(f"[paddleocr_vl] Image size: {real_width}x{real_height}")
    except Exception as e:
        log(f"[paddleocr_vl] Error decoding image: {e}")
        return {"regions": [], "error": str(e)}

    if not pipeline:
        return {"regions": [], "error": "Failed to load PaddleOCR-VL model"}

    all_detected_regions = []
    
    if real_height > SLICE_HEIGHT:
        log(f"[paddleocr_vl] Image is tall ({real_height}px), slicing...")
        y = 0
        slice_idx = 0
        
        while y < real_height:
            h = min(SLICE_HEIGHT, real_height - y)
            img_slice = img.crop((0, y, real_width, y + h))
            
            buffer = io.BytesIO()
            img_slice.save(buffer, format='PNG')
            temp_path = temp_save_image(buffer.getvalue())
            
            try:
                log(f"[paddleocr_vl] Processing slice {slice_idx}: y={y}, h={h}")
                output = pipeline.predict(temp_path)
                
                slice_regions = parse_paddleocr_vl_output(output, real_width, h)
                log(f"[paddleocr_vl] Slice {slice_idx} found {len(slice_regions)} regions")
                
                for region in slice_regions:
                    if 'box_2d' in region:
                        ymin_norm, xmin_norm, ymax_norm, xmax_norm = region['box_2d']
                        
                        abs_xmin_slice = (xmin_norm / 1000) * real_width
                        abs_xmax_slice = (xmax_norm / 1000) * real_width
                        abs_ymin_slice = (ymin_norm / 1000) * h
                        abs_ymax_slice = (ymax_norm / 1000) * h
                        
                        abs_ymin_full = abs_ymin_slice + y
                        abs_ymax_full = abs_ymax_slice + y
                        
                        norm_ymin_full = int((abs_ymin_full / real_height) * 1000)
                        norm_ymax_full = int((abs_ymax_full / real_height) * 1000)
                        norm_xmin_full = int((abs_xmin_slice / real_width) * 1000)
                        norm_xmax_full = int((abs_xmax_slice / real_width) * 1000)
                        
                        region['box_2d'] = [norm_ymin_full, norm_xmin_full, norm_ymax_full, norm_xmax_full]
                        all_detected_regions.append(region)
                        
            except Exception as e:
                log(f"[paddleocr_vl] Error on slice {slice_idx}: {e}")
                log(traceback.format_exc())
            finally:
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
            
            if y + h >= real_height:
                break
            y += (SLICE_HEIGHT - OVERLAP)
            slice_idx += 1
            
    else:
        # 不需要切片
        temp_path = temp_save_image(img_data)
        try:
            log("[paddleocr_vl] Running inference on full image...")
            output = pipeline.predict(temp_path)
            all_detected_regions = parse_paddleocr_vl_output(output, real_width, real_height)
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    # 去重和合并
    final_regions = filter_duplicate_regions(all_detected_regions)
    final_regions = merge_text_regions(final_regions, real_width, real_height)
    
    log(f"[paddleocr_vl] Final result: {len(final_regions)} regions")
    
    return {"regions": final_regions}
