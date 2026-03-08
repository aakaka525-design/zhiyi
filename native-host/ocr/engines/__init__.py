"""
OCR 引擎模块
"""

from .paddleocr_vl import paddleocr_vl_ocr
from .smol_docling import smol_docling_ocr

__all__ = ['paddleocr_vl_ocr', 'smol_docling_ocr']
