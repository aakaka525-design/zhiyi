
import os
import math
from PIL import Image, ImageDraw, ImageFont

def render_translation(image: Image.Image, boxes: list) -> Image.Image:
    """
    Inpaint text regions and draw translated text.
    
    Args:
        image: Original PIL Image
        boxes: List of dicts with 'box_2d', 'text', 'translation'
        
    Returns:
        Processed PIL Image
    """
    # Create a copy to draw on
    canvas = image.copy()
    draw = ImageDraw.Draw(canvas)
    
    width, height = image.size
    
    # Load Font
    font_path = "/System/Library/Fonts/STHeiti Medium.ttc"
    if not os.path.exists(font_path):
         # Fallback
         font_path = "/System/Library/Fonts/Hiragino Sans GB.ttc"
         
    # Prepare font loader
    def load_font(size):
        try:
            return ImageFont.truetype(font_path, size)
        except:
            return ImageFont.load_default()

    for box in boxes:
        # Get coordinates
        box_norm = box.get('box_2d', [])
        if not box_norm:
            continue
            
        ymin, xmin, ymax, xmax = box_norm
        
        # Convert to absolute
        abs_xmin = (xmin / 1000) * width
        abs_xmax = (xmax / 1000) * width
        abs_ymin = (ymin / 1000) * height
        abs_ymax = (ymax / 1000) * height
        
        box_w = abs_xmax - abs_xmin
        box_h = abs_ymax - abs_ymin
        
        if box_w <= 0 or box_h <= 0:
            continue
            
        # 1. Inpainting (Simple solid color fill for now)
        # Calculate background color from the edge of the box
        # Sampling corners
        bg_color = (255, 255, 255) # Default white
        
        # Draw white rectangle to cover original text
        draw.rectangle([abs_xmin, abs_ymin, abs_xmax, abs_ymax], fill=bg_color)
        
        # 2. Draw Translated Text
        translation = box.get('translation', '')
        if not translation:
            continue
            
        # Auto-scaling font size
        # Heuristic: Area of box / len(translation)
        # Start large and shrink
        font_size = int(min(box_w / 2, box_h / 1.5))
        font_size = max(12, font_size)
        
        font = load_font(font_size)
        
        # Basic constraints
        target_width = box_w * 0.95
        target_height = box_h * 0.95
        
        # Text Wrapping Loop
        lines = []
        words = list(translation) # Treat each char as word for Chinese
        
        while font_size > 8:
            font = load_font(font_size)
            lines = []
            current_line = ""
            
            # Simple greedy wrapping
            valid_size = True
            for char in words:
                test_line = current_line + char
                # getbbox returns (left, top, right, bottom)
                bbox = font.getbbox(test_line)
                w = bbox[2] - bbox[0]
                
                if w <= target_width:
                    current_line = test_line
                else:
                    lines.append(current_line)
                    current_line = char
                    
            if current_line:
                lines.append(current_line)
                
            # Check height
            total_text_height = len(lines) * font_size * 1.2 # Line height 1.2
            if total_text_height <= target_height:
                break # Fits!
                
            font_size -= 2 # Try smaller
            
        # Draw text centered
        total_text_height = len(lines) * font_size * 1.2
        start_y = abs_ymin + (box_h - total_text_height) / 2
        
        for line in lines:
            # Center X
            bbox = font.getbbox(line)
            line_w = bbox[2] - bbox[0]
            start_x = abs_xmin + (box_w - line_w) / 2
            
            draw.text((start_x, start_y), line, font=font, fill=(0, 0, 0))
            start_y += font_size * 1.2
            
    return canvas
