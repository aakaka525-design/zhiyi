
import base64
import io
import tempfile
from PIL import Image
from .messaging import log

def decode_image_data(image_base64):
    if ',' in image_base64:
        image_base64 = image_base64.split(',')[1]
    return base64.b64decode(image_base64)

def base64_to_image(image_base64):
    data = decode_image_data(image_base64)
    return Image.open(io.BytesIO(data)).convert("RGB")

def image_to_base64(image):
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode('utf-8')

def temp_save_image(image_data, suffix='.png'):
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(image_data)
        return f.name

def calc_iou(box1, box2):
    y1_min, x1_min, y1_max, x1_max = box1
    y2_min, x2_min, y2_max, x2_max = box2
    
    inter_xmin = max(x1_min, x2_min)
    inter_ymin = max(y1_min, y2_min)
    inter_xmax = min(x1_max, x2_max)
    inter_ymax = min(y1_max, y2_max)
    
    if inter_xmax <= inter_xmin or inter_ymax <= inter_ymin:
        return 0.0
    
    inter_area = (inter_xmax - inter_xmin) * (inter_ymax - inter_ymin)
    area1 = (x1_max - x1_min) * (y1_max - y1_min)
    area2 = (x2_max - x2_min) * (y2_max - y2_min)
    
    return inter_area / min(area1, area2) if min(area1, area2) > 0 else 0.0
