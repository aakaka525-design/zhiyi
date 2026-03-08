
import os
import sys
import base64
import json
from PIL import Image, ImageDraw
import io

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ocr import detect_regions_only

def process_image(image_path, output_path):
    print(f"Processing {image_path}...")
    
    # Read image
    with open(image_path, 'rb') as f:
        img_bytes = f.read()
        base64_str = base64.b64encode(img_bytes).decode('utf-8')
        image_data = f"data:image/webp;base64,{base64_str}"
        
    # Get original dimensions
    img = Image.open(io.BytesIO(img_bytes))
    width, height = img.size
    print(f"Image size: {width}x{height}")
    
    # Run OCR (using PP-OCRv5_server_det via detect_regions_only)
    try:
        result = detect_regions_only(image_data, width, height)
    except Exception as e:
        print(f"Error running OCR: {e}")
        import traceback
        traceback.print_exc()
        return

    regions = result.get('regions', [])
    print(f"Detected {len(regions)} regions")
    print(f"Detected {len(regions)} regions")
    
    # Draw boxes
    draw = ImageDraw.Draw(img)
    
    for i, region in enumerate(regions):
        # box_2d is [ymin, xmin, ymax, xmax] normalized to 1000
        box = region.get('box_2d')
        if not box:
            continue
            
        ymin, xmin, ymax, xmax = box
        
        # Convert to absolute coordinates
        abs_xmin = (xmin / 1000) * width
        abs_xmax = (xmax / 1000) * width
        abs_ymin = (ymin / 1000) * height
        abs_ymax = (ymax / 1000) * height
        
        # Draw rectangle
        draw.rectangle([abs_xmin, abs_ymin, abs_xmax, abs_ymax], outline="red", width=5)
        
        # Draw label/index
        draw.text((abs_xmin, abs_ymin - 20), f"#{i}", fill="red")
        
        # Print debug info
        print(f"Region {i}: {box} -> [{abs_xmin:.1f}, {abs_ymin:.1f}, {abs_xmax:.1f}, {abs_ymax:.1f}]")
        
    # Save output
    img.save(output_path)
    print(f"Saved annotated image to {output_path}")

if __name__ == "__main__":
    input_dir = "../manga_image"
    output_dir = "../manga_image_debug"
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    for filename in os.listdir(input_dir):
        if filename.lower().endswith(('.webp', '.png', '.jpg', '.jpeg')):
            input_path = os.path.join(input_dir, filename)
            output_path = os.path.join(output_dir, "debug_" + filename.replace('.webp', '.png'))
            process_image(input_path, output_path)
