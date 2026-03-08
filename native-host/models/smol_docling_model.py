
import traceback
from utils.messaging import log

smol_docling_model = None
smol_docling_processor = None

def get_smol_docling():
    """获取 SmolDocling 模型实例（轻量级文档 OCR）"""
    global smol_docling_model, smol_docling_processor
    if smol_docling_model is None:
        try:
            log("Loading SmolDocling model...")
            import torch
            from transformers import AutoProcessor, AutoModelForVision2Seq
            
            model_id = "ds4sd/SmolDocling-256M-preview"
            
            # 使用 MPS 加速（Mac M 系列芯片）
            device = "mps" if torch.backends.mps.is_available() else "cpu"
            log(f"Using device: {device}")
            
            smol_docling_processor = AutoProcessor.from_pretrained(model_id)
            smol_docling_model = AutoModelForVision2Seq.from_pretrained(
                model_id,
                torch_dtype=torch.float16 if device == "mps" else torch.float32,
                device_map=device
            )
            log("SmolDocling model loaded successfully")
        except Exception as e:
            log(f"Error loading SmolDocling: {e}")
            log(traceback.format_exc())
            return None, None
    return smol_docling_model, smol_docling_processor
