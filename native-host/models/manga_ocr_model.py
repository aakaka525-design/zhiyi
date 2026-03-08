
import traceback
from utils.messaging import log

manga_ocr_model = None

def get_manga_ocr():
    """获取 manga-ocr 模型实例（专门针对漫画优化）"""
    global manga_ocr_model
    if manga_ocr_model is None:
        try:
            log("Loading manga-ocr model...")
            from manga_ocr import MangaOcr
            manga_ocr_model = MangaOcr()
            log("Manga-OCR model loaded successfully")
        except Exception as e:
            log(f"Error loading manga-ocr: {e}")
            log(traceback.format_exc())
            return None
    return manga_ocr_model
