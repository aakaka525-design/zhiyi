
import traceback
from utils.messaging import log

# 缓存两种检测器
detector_server = None
detector_mobile = None
recognizer = None

def get_detector(detector_type='server'):
    """
    获取检测器
    detector_type: 'server' (精度高,慢) 或 'mobile' (速度快,稍弱)
    """
    global detector_server, detector_mobile
    
    if detector_type == 'mobile':
        if detector_mobile is None:
            try:
                log("Importing paddlex...")
                import paddlex
                log("Creating mobile detector model...")
                detector_mobile = paddlex.create_model('PP-OCRv5_mobile_det')
                log("Detector created (PP-OCRv5_mobile_det)")
            except Exception as e:
                log(f"Error loading mobile detector: {e}")
                log(traceback.format_exc())
                return None
        return detector_mobile
    else:
        # 默认使用 server 版
        if detector_server is None:
            try:
                log("Importing paddlex...")
                import paddlex
                log("Creating server detector model...")
                detector_server = paddlex.create_model('PP-OCRv5_server_det')
                log("Detector created (PP-OCRv5_server_det)")
            except Exception as e:
                log(f"Error loading server detector: {e}")
                log(traceback.format_exc())
                return None
        return detector_server

def get_recognizer():
    global recognizer
    if recognizer is None:
        try:
            import paddlex
            # 使用英文专用识别模型作为备用
            recognizer = paddlex.create_model('en_PP-OCRv5_mobile_rec')
            log("Recognizer created (en_PP-OCRv5_mobile_rec - English专用)")
        except Exception as e:
            log(f"Error loading recognizer: {e}")
            try:
                recognizer = paddlex.create_model('PP-OCRv5_mobile_rec')
                log("Fallback to PP-OCRv5_mobile_rec")
            except:
                pass
            return None
    return recognizer
