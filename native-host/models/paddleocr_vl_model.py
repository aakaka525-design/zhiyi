
import traceback
from utils.messaging import log

paddleocr_vl_pipeline = None

def get_paddleocr_vl():
    """获取 PaddleOCR-VL 模型实例（视觉语言 OCR）"""
    global paddleocr_vl_pipeline
    if paddleocr_vl_pipeline is None:
        try:
            log("Loading PaddleOCR-VL model...")
            from paddleocr import PaddleOCRVL
            paddleocr_vl_pipeline = PaddleOCRVL()
            log("PaddleOCR-VL model loaded successfully")
        except Exception as e:
            log(f"Error loading PaddleOCR-VL: {e}")
            log(traceback.format_exc())
            return None
    return paddleocr_vl_pipeline
