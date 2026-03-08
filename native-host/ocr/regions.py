"""
OCR 区域处理模块
- 过滤重复区域
- 合并碎片化文字框
"""

from utils.messaging import log
from utils.image import calc_iou


def filter_duplicate_regions(regions, iou_threshold=0.7, min_size=20):
    """
    过滤重复的区域，并移除过小的区域。
    """
    filtered_regions = []
    
    # 移除过小的区域
    valid_regions = []
    for r in regions:
        if 'box_2d' in r and len(r['box_2d']) == 4:
            ymin, xmin, ymax, xmax = r['box_2d']
            width = xmax - xmin
            height = ymax - ymin
            if width > min_size or height > min_size:
                valid_regions.append(r)
    
    # 过滤重复区域
    for r in valid_regions:
        is_dup = False
        for existing in filtered_regions:
            if calc_iou(r['box_2d'], existing['box_2d']) > iou_threshold:
                is_dup = True
                break
        if not is_dup:
            filtered_regions.append(r)
            
    return filtered_regions


def merge_text_regions(regions, real_width, real_height, max_gap_v=50, min_overlap_h=0.4):
    """
    将碎片化的文字框合并为更大的、连贯的块。
    主要用于处理 PP-OCRv5 按行检测的问题。
    """
    if not regions:
        return []
        
    # 确保每个 region 都有绝对坐标 abs_box [ymin, xmin, ymax, xmax]
    prepared = []
    for r in regions:
        if 'abs_box' in r:
            prepared.append(r)
        elif 'box_2d' in r:
            ymin, xmin, ymax, xmax = r['box_2d']
            r['abs_box'] = [
                (ymin / 1000) * real_height,
                (xmin / 1000) * real_width,
                (ymax / 1000) * real_height,
                (xmax / 1000) * real_width
            ]
            prepared.append(r)
            
    # 使用并查集 (Union-Find) 来记录可以合并的框
    parent = list(range(len(prepared)))
    
    def find(i):
        if parent[i] == i:
            return i
        parent[i] = find(parent[i])
        return parent[i]
        
    def union(i, j):
        root_i = find(i)
        root_j = find(j)
        if root_i != root_j:
            parent[root_i] = root_j
            
    # 双重循环检查两两是否可以合并
    for i in range(len(prepared)):
        for j in range(i + 1, len(prepared)):
            b1 = prepared[i]['abs_box']
            b2 = prepared[j]['abs_box']
            
            # 垂直间距检查
            v_gap = max(0, b2[0] - b1[2], b1[0] - b2[2])
            
            # 横向投影重合度检查
            overlap_xmin = max(b1[1], b2[1])
            overlap_xmax = min(b1[3], b2[3])
            overlap_w = max(0, overlap_xmax - overlap_xmin)
            
            w1 = b1[3] - b1[1]
            w2 = b2[3] - b2[1]
            min_w = min(w1, w2)
            
            if v_gap < max_gap_v and (overlap_w / max(1, min_w)) > min_overlap_h:
                union(i, j)
            elif v_gap < 10 and max(0, b2[1] - b1[3], b1[1] - b2[3]) < 20:
                union(i, j)

    # 按 Root 分组
    groups = {}
    for i in range(len(prepared)):
        root = find(i)
        if root not in groups:
            groups[root] = []
        groups[root].append(prepared[i])
        
    merged_results = []
    for root, members in groups.items():
        all_ymin = min(m['abs_box'][0] for m in members)
        all_xmin = min(m['abs_box'][1] for m in members)
        all_ymax = max(m['abs_box'][2] for m in members)
        all_xmax = max(m['abs_box'][3] for m in members)
        
        new_box_2d = [
            int(all_ymin / real_height * 1000),
            int(all_xmin / real_width * 1000),
            int(all_ymax / real_height * 1000),
            int(all_xmax / real_width * 1000)
        ]
        
        members.sort(key=lambda x: x['abs_box'][0])
        all_text = " ".join([m.get('text', '') for m in members if m.get('text')]).strip()
        
        merged_results.append({
            "box_2d": new_box_2d,
            "abs_box": [all_ymin, all_xmin, all_ymax, all_xmax],
            "text": all_text
        })
        
    log(f"[merge] Merged {len(prepared)} -> {len(merged_results)} regions")
    return merged_results
