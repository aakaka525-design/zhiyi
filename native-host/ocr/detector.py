"""
OCR 检测器模块
- PP-OCRv5 检测逻辑
- 混合模式检测
- 主检测入口
"""

import os
import io
import time
import traceback
from PIL import Image

from utils.messaging import log
from utils.image import (
    decode_image_data, image_to_base64, temp_save_image
)
from ocr.parsers import parse_paddlex_det_output
from ocr.regions import filter_duplicate_regions, merge_text_regions


def detect_paddlex_raw(img, real_width, real_height, detector_type='server'):
    """
    共享的 PP-OCRv5 检测逻辑，包含切片、反归一化和框合并。
    detector_type: 'server' (精度高,慢) 或 'mobile' (速度快,稍弱)
    返回合并后的 regions 列表。
    """
    from models.paddle_model import get_detector
    det = get_detector(detector_type)
    if not det:
        log(f"[detect_raw] Missing detector (type={detector_type})")
        return []

    SLICE_HEIGHT = 3500
    OVERLAP = 200
    all_regions = []

    if real_height > SLICE_HEIGHT:
        log(f"[detect_raw] Image is tall ({real_height}px), slicing...")
        y = 0
        while y < real_height:
            h = min(SLICE_HEIGHT, real_height - y)
            img_slice = img.crop((0, y, real_width, y + h))
            buffer = io.BytesIO()
            img_slice.save(buffer, format='PNG')
            temp_path = temp_save_image(buffer.getvalue())
            try:
                det_result = det.predict(temp_path)
                slice_regions = parse_paddlex_det_output(det_result, real_width, h)
                for region in slice_regions:
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
                     region['abs_box'] = [abs_ymin_full, abs_xmin_slice, abs_ymax_full, abs_xmax_slice]
                     all_regions.append(region)
            except Exception as e:
                log(f"[detect_raw] Error on slice y={y}: {e}")
            finally:
                if os.path.exists(temp_path): os.unlink(temp_path)
            if y + h >= real_height: break
            y += (SLICE_HEIGHT - OVERLAP)
    else:
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        temp_path = temp_save_image(buffer.getvalue())
        try:
            det_result = det.predict(temp_path)
            all_regions = parse_paddlex_det_output(det_result, real_width, real_height)
            for region in all_regions:
                 ymin_norm, xmin_norm, ymax_norm, xmax_norm = region['box_2d']
                 region['abs_box'] = [
                     (ymin_norm / 1000) * real_height,
                     (xmin_norm / 1000) * real_width,
                     (ymax_norm / 1000) * real_height,
                     (xmax_norm / 1000) * real_width
                 ]
        except Exception as e:
            log(f"[detect_raw] Error: {e}")
        finally:
            if os.path.exists(temp_path): os.unlink(temp_path)

    final_regions = filter_duplicate_regions(all_regions)
    final_regions = merge_text_regions(final_regions, real_width, real_height)
    return final_regions


def detect_regions_only(image_base64, image_width, image_height):
    """
    混合模式：只做检测，返回裁剪图片的 base64
    供云端 AI 进行识别和翻译
    使用 PP-OCRv5_server_det
    """
    try:
        # 解码图片
        img_data = decode_image_data(image_base64)
        img = Image.open(io.BytesIO(img_data))
        real_width, real_height = img.size
        log(f"[detect_only] Image size: {real_width}x{real_height}")

        # 调用共享检测逻辑
        final_regions = detect_paddlex_raw(img, real_width, real_height)

        # 生成 crop base64
        output_regions = []
        for r in final_regions:
            try:
                if 'abs_box' in r:
                    ymin, xmin, ymax, xmax = r['abs_box']
                    pad = 5
                    crop_xmin = max(0, int(xmin) - pad)
                    crop_ymin = max(0, int(ymin) - pad)
                    crop_xmax = min(real_width, int(xmax) + pad)
                    crop_ymax = min(real_height, int(ymax) + pad)
                    
                    if crop_xmax > crop_xmin and crop_ymax > crop_ymin:
                        crop = img.crop((crop_xmin, crop_ymin, crop_xmax, crop_ymax))
                        crop_base64 = image_to_base64(crop)
                        
                        output_regions.append({
                            "box_2d": r['box_2d'],
                            "crop_base64": f"data:image/png;base64,{crop_base64}",
                            "text": ""
                        })
            except Exception as e:
                 log(f"[detect_only] Crop error: {e}")

        log(f"[detect_only] Final result: {len(output_regions)} regions")
        return {"regions": output_regions}
        
    except Exception as e:
        log(f"[detect_only] Error: {e}")
        log(traceback.format_exc())
        return {"error": str(e)}


def detect_text(image_base64, image_width, image_height, use_ai=False, api_key=None, detector_type='server'):
    try:
        start_time = time.time()
        
        img_data = decode_image_data(image_base64)
        img = Image.open(io.BytesIO(img_data))
        real_width, real_height = img.size
        log(f"[detect_text] Image size: {real_width}x{real_height} (AI={use_ai}, detector={detector_type})")

        # 使用 PP-OCRv5 进行检测和合并
        detect_start = time.time()
        final_regions = detect_paddlex_raw(img, real_width, real_height, detector_type)
        log(f"[detect_text] Detection took {time.time() - detect_start:.2f}s, found {len(final_regions)} regions")
        
        # 识别后端
        m_ocr = None
        rec = None
        if not use_ai:
            from models.manga_ocr_model import get_manga_ocr
            from models.paddle_model import get_recognizer
            m_ocr = get_manga_ocr()
            rec = get_recognizer() if not m_ocr else None
        
        # 预处理：提取所有裁剪图像
        crops_data = []
        for r in final_regions:
            ymin, xmin, ymax, xmax = r['abs_box']
            crop_xmin = max(0, int(xmin) - 3)
            crop_ymin = max(0, int(ymin) - 3)
            crop_xmax = min(real_width, int(xmax) + 3)
            crop_ymax = min(real_height, int(ymax) + 3)
            crop = img.crop((crop_xmin, crop_ymin, crop_xmax, crop_ymax))
            
            # 转为 bytes
            buf = io.BytesIO()
            crop.save(buf, format='PNG')
            crops_data.append({
                'region': r,
                'crop': crop,
                'crop_bytes': buf.getvalue()
            })
        
        boxes = []
        
        if use_ai and crops_data:
            # 并行 AI 调用
            from concurrent.futures import ThreadPoolExecutor, as_completed
            from utils.ai_service import translate_crop_ai
            
            def process_region(idx, crop_bytes):
                try:
                    ai_res = translate_crop_ai(crop_bytes, api_key=api_key)
                    text = ""
                    translation = ""
                    if "|" in ai_res:
                        parts = ai_res.split("|")
                        text = parts[0].replace("OCR:", "").strip()
                        translation = parts[1].replace("Translation:", "").strip()
                    else:
                        text = ai_res
                    return idx, text, translation, None
                except Exception as e:
                    return idx, "", "", str(e)
            
            ai_start = time.time()
            results = {}
            with ThreadPoolExecutor(max_workers=6) as executor:
                futures = {
                    executor.submit(process_region, i, cd['crop_bytes']): i 
                    for i, cd in enumerate(crops_data)
                }
                for future in as_completed(futures):
                    idx, text, translation, error = future.result()
                    if error:
                        log(f"[detect_text] Region {idx} AI error: {error}")
                    results[idx] = (text, translation)
            
            log(f"[detect_text] Parallel AI took {time.time() - ai_start:.2f}s for {len(crops_data)} regions")
            
            # 按顺序组装结果
            for i, cd in enumerate(crops_data):
                text, translation = results.get(i, ("", ""))
                boxes.append({
                    "box_2d": cd['region']['box_2d'],
                    "text": text,
                    "translation": translation,
                    "confidence": 0.9
                })
        else:
            # 本地 OCR 模式（保持原有串行逻辑）
            for cd in crops_data:
                crop = cd['crop']
                r = cd['region']
                text = ""
                translation = ""
                confidence = 0.9
                
                try:
                    if m_ocr:
                        text = m_ocr(crop)
                    elif rec:
                        cpath = temp_save_image(cd['crop_bytes'])
                        rec_res = rec.predict(cpath)
                        if rec_res:
                            for item in rec_res:
                                text = getattr(item, 'rec_text', '')
                                confidence = float(getattr(item, 'rec_score', 0.9))
                                break
                        os.unlink(cpath)
                except Exception as e:
                    log(f"[detect_text] Rec error: {e}")

                boxes.append({
                    "box_2d": r['box_2d'],
                    "text": text,
                    "translation": translation,
                    "confidence": confidence
                })
        
        log(f"[detect_text] Total time: {time.time() - start_time:.2f}s")
        return {"boxes": boxes}
            
    except Exception as e:
        log(f"Detection error: {e}")
        log(traceback.format_exc())
        return {"error": str(e)}

def detect_regions_and_crops(image_base64, image_width, image_height, detector_type='server'):
    """
    Step 1 of Pipeline: Detect regions and extract crops.
    Returns list of dicts: {'box_2d': [...], 'crop_bytes': b'...'}
    """
    try:
        img_data = decode_image_data(image_base64)
        img = Image.open(io.BytesIO(img_data))
        real_width, real_height = img.size
        
        # 1. Detection (CPU Heavy)
        final_regions = detect_paddlex_raw(img, real_width, real_height, detector_type)
        
        # 2. Crop Extraction
        crops_data = []
        for r in final_regions:
            ymin, xmin, ymax, xmax = r['abs_box']
            crop_xmin = max(0, int(xmin) - 3)
            crop_ymin = max(0, int(ymin) - 3)
            crop_xmax = min(real_width, int(xmax) + 3)
            crop_ymax = min(real_height, int(ymax) + 3)
            crop = img.crop((crop_xmin, crop_ymin, crop_xmax, crop_ymax))
            
            buf = io.BytesIO()
            crop.save(buf, format='PNG')
            
            crops_data.append({
                'box_2d': r['box_2d'],
                'crop_bytes': buf.getvalue(),
                'text': '',
                'translation': ''
            })
            
        return {"result": crops_data}
    except Exception as e:
        log(f"Detection error: {e}")
        return {"error": str(e)}
