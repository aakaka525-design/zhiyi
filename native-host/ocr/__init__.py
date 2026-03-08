"""
OCR 模块
统一导出主要的 OCR 功能函数
"""

from .detector import detect_text, detect_regions_only
from .engines import paddleocr_vl_ocr, smol_docling_ocr

__all__ = [
    'detect_text',
    'detect_regions_only',
    'paddleocr_vl_ocr',
    'smol_docling_ocr'
]
