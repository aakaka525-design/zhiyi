"""
OCR 输出解析模块
- 解析 PaddleOCR-VL 输出
- 解析 PaddleX 检测输出
"""

import os
import json
import tempfile
import traceback

from utils.messaging import log


def parse_paddleocr_vl_output(output_results, real_width, real_height):
    """
    解析 PaddleOCR-VL 的原始输出，提取文本块及其坐标。
    返回的 bbox 是归一化到 0-1000 的 box_2d 格式。
    """
    regions = []
    
    for result in output_results:
        try:
            ocr_data = {}
            # 尝试从结果获取 OCR 数据
            if hasattr(result, 'ocr_result'):
                ocr_data = result.ocr_result
            elif hasattr(result, 'layout_parsing_result'):
                ocr_data = result.layout_parsing_result
            else:
                # 直接保存 JSON 并读取
                json_dir = tempfile.mkdtemp()
                result.save_to_json(save_path=json_dir)
                
                json_files = [f for f in os.listdir(json_dir) if f.endswith('.json')]
                if json_files:
                    with open(os.path.join(json_dir, json_files[0]), 'r') as f:
                        ocr_data = json.load(f)
                
                import shutil
                shutil.rmtree(json_dir, ignore_errors=True)
            
            log(f"[paddleocr_vl] OCR data keys: {ocr_data.keys() if isinstance(ocr_data, dict) else 'not dict'}")
            
            text_blocks = []
            if isinstance(ocr_data, dict):
                # 1. 首先尝试 parsing_res_list
                if 'parsing_res_list' in ocr_data and ocr_data['parsing_res_list']:
                    for item in ocr_data['parsing_res_list']:
                        if isinstance(item, dict):
                            text = item.get('text', item.get('content', ''))
                            bbox = item.get('bbox', item.get('box', item.get('position', [])))
                            if text and bbox:
                                text_blocks.append({'text': text, 'bbox': bbox})
                    log(f"[paddleocr_vl] Found {len(text_blocks)} from parsing_res_list")
                
                # 2. 尝试 layout_det_res
                if not text_blocks and 'layout_det_res' in ocr_data and ocr_data['layout_det_res']:
                    layout_res = ocr_data['layout_det_res']
                    log(f"[paddleocr_vl] layout_det_res type={type(layout_res).__name__}")
                    
                    if isinstance(layout_res, list):
                        for item in layout_res:
                            if isinstance(item, dict):
                                text = item.get('transcription', item.get('text', ''))
                                coords = item.get('coordinate', [])
                                label = item.get('label', '')
                                if coords and label != 'image':
                                    text_blocks.append({'text': text, 'bbox': coords, 'label': label})
                    elif isinstance(layout_res, dict):
                        boxes = layout_res.get('boxes', layout_res.get('dt_polys', []))
                        texts = layout_res.get('rec_text', layout_res.get('texts', []))
                        
                        if boxes:
                            for i, box in enumerate(boxes):
                                if isinstance(box, dict):
                                    coords = box.get('coordinate', [])
                                    label = box.get('label', '')
                                    text = texts[i] if i < len(texts) else ''
                                    if coords and label != 'image':
                                        text_blocks.append({'text': text, 'bbox': coords, 'label': label})
                                elif isinstance(box, (list, tuple)) and len(box) >= 4:
                                    text = texts[i] if i < len(texts) else ''
                                    text_blocks.append({'text': text, 'bbox': box})
                        else:
                            for key, value in layout_res.items():
                                if isinstance(value, list):
                                    for item in value:
                                        if isinstance(item, dict):
                                            text = item.get('transcription', item.get('text', ''))
                                            coords = item.get('coordinate', item.get('points', item.get('bbox', [])))
                                            label = item.get('label', '')
                                            if coords and label != 'image':
                                                text_blocks.append({'text': text, 'bbox': coords, 'label': label})
                    log(f"[paddleocr_vl] Found {len(text_blocks)} from layout_det_res")
                
                # 3. 尝试其他常见键名
                if not text_blocks:
                    for key in ['text_blocks', 'ocr_result', 'texts', 'rec_polys', 'dt_polys']:
                        if key in ocr_data and ocr_data[key]:
                            items = ocr_data[key]
                            if isinstance(items, list):
                                for item in items:
                                    if isinstance(item, dict):
                                        text = item.get('text', item.get('transcription', ''))
                                        bbox = item.get('bbox', item.get('points', []))
                                        text_blocks.append({'text': text, 'bbox': bbox})
                                    elif isinstance(item, (list, tuple)) and len(item) >= 4:
                                        text_blocks.append({'text': '', 'bbox': item})
                            break
                    log(f"[paddleocr_vl] Found {len(text_blocks)} from fallback keys")
            
            log(f"[paddleocr_vl] Total text blocks: {len(text_blocks)}")
            
            for idx, block in enumerate(text_blocks):
                if isinstance(block, dict):
                    text = block.get('text', block.get('content', ''))
                    bbox = block.get('bbox', block.get('box', block.get('position', [])))
                else:
                    continue
                
                if not bbox:
                    continue
                
                # 解析 bbox
                try:
                    if len(bbox) == 4 and all(isinstance(x, (int, float)) for x in bbox):
                        xmin, ymin, xmax, ymax = bbox
                    elif len(bbox) >= 4:
                        if isinstance(bbox[0], (list, tuple)):
                            xs = [p[0] for p in bbox]
                            ys = [p[1] for p in bbox]
                        else:
                            xs = [bbox[i] for i in range(0, len(bbox), 2)]
                            ys = [bbox[i] for i in range(1, len(bbox), 2)]
                        xmin, xmax = min(xs), max(xs)
                        ymin, ymax = min(ys), max(ys)
                    else:
                        continue
                except Exception as e:
                    log(f"[paddleocr_vl] Block {idx}: bbox parse error: {e}")
                    continue
                
                # 归一化坐标 (0-1000)
                box_2d = [
                    int(ymin / real_height * 1000),
                    int(xmin / real_width * 1000),
                    int(ymax / real_height * 1000),
                    int(xmax / real_width * 1000)
                ]
                
                regions.append({
                    "box_2d": box_2d,
                    "text": text
                })
                
        except Exception as e:
            log(f"[paddleocr_vl] Parse error: {e}")
            log(traceback.format_exc())
    
    return regions


def parse_paddlex_det_output(det_result, real_width, real_height):
    """解析 PaddleX 检测模型的输出"""
    regions = []
    if det_result:
        for result in det_result:
            polys = []
            if hasattr(result, 'dt_polys'):
                polys = result.dt_polys
            elif isinstance(result, dict) and 'dt_polys' in result:
                polys = result['dt_polys']
            
            is_empty = (polys is None) or (hasattr(polys, 'size') and polys.size == 0) or (not hasattr(polys, 'size') and len(polys) == 0)
            
            if is_empty and isinstance(result, dict) and 'boxes' in result:
                pass

            for idx, poly in enumerate(polys):
                xs = [p[0] for p in poly]
                ys = [p[1] for p in poly]
                xmin, xmax = min(xs), max(xs)
                ymin, ymax = min(ys), max(ys)
                
                box_2d = [
                    int(ymin / real_height * 1000),
                    int(xmin / real_width * 1000),
                    int(ymax / real_height * 1000),
                    int(xmax / real_width * 1000)
                ]
                
                regions.append({
                    "box_2d": box_2d,
                    "text": "",
                    "abs_box": [ymin, xmin, ymax, xmax]
                })
    return regions
