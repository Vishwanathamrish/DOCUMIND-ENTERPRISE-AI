"""
ocr/layout_detector.py
───────────────────────
OpenCV + OCR-assisted layout detection for "perfect place" highlights.
"""
from __future__ import annotations

import io
from pathlib import Path
from typing import Any, List, Optional, Dict

import cv2
import numpy as np

from utils.logger import logger


def _bytes_to_cv2(content: bytes, filename: str) -> Optional[np.ndarray]:
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        try:
            from pdf2image import convert_from_bytes
            pages = convert_from_bytes(content, first_page=1, last_page=1, dpi=150)
            if pages: return np.array(pages[0].convert("L"))
        except: return None
    try:
        arr = np.frombuffer(content, dtype=np.uint8)
        return cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    except: return None


def _to_pct(bbox: Optional[List[int]], w: int, h: int) -> Optional[List[float]]:
    if not bbox or len(bbox) != 4: return None
    bx, by, bw, bh = bbox
    return [
        float(int(float(bx) * 1000.0 / w)) / 10.0,
        float(int(float(by) * 1000.0 / h)) / 10.0,
        float(int(float(bw) * 1000.0 / w)) / 10.0,
        float(int(float(bh) * 1000.0 / h)) / 10.0,
    ]


def _find_keyword_bbox(ocr_words: List[Dict[str, Any]], keywords: List[str], expand_w: int = 150) -> Optional[List[int]]:
    """Finds the first occurrence of any keyword and returns a bounding box."""
    for kw in keywords:
        kw_l = kw.lower()
        for w in ocr_words:
            if kw_l in w["text"].lower():
                # Return the box around the keyword
                return [w["left"] - 5, w["top"] - 5, w["width"] + expand_w, w["height"] + 10]
    return None


def detect_layout(content: bytes, filename: str, ocr_data: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """
    Analyzes document layout using OpenCV and OCR assistance.
    """
    img = _bytes_to_cv2(content, filename)
    if img is None:
        return {"columns": 1, "header_bbox": None, "footer_bbox": None, "text_blocks": [], "table_regions": [], "summary": "N/A"}

    th, tw = img.shape
    words = ocr_data or []

    # 1. OCR-Assisted Header (Title/Invoice No)
    # Search for common header labels
    header_box = _find_keyword_bbox(words, ["Invoice", "Receipt", "Agreement", "Contract", "Bill", "Summary"], expand_w=300)
    if not header_box:
        # Fallback to top text cluster
        _, binary = cv2.threshold(img, 180, 255, cv2.THRESH_BINARY_INV)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (30, 5))
        dilated = cv2.dilate(binary, kernel, iterations=3)
        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        raw_blocks = sorted([cv2.boundingRect(c) for c in contours if cv2.boundingRect(c)[2]*cv2.boundingRect(c)[3] > 500], key=lambda b: b[1])
        top_blocks = [b for b in raw_blocks if b[1] < th * 0.2]
        if top_blocks:
            x1 = min(b[0] for b in top_blocks)
            y1 = min(b[1] for b in top_blocks)
            x2 = max(b[0] + b[2] for b in top_blocks)
            y2 = max(b[1] + b[3] for b in top_blocks)
            header_box = [x1, y1, x2-x1, y2-y1]
        else:
            header_box = [0, 0, tw, int(th * 0.1)]

    # 2. OCR-Assisted Date
    date_box = _find_keyword_bbox(words, ["Date", "Dated", "On"], expand_w=200)

    # 3. OCR-Assisted Table / Items Region
    table_start = _find_keyword_bbox(words, ["Description", "Items", "Qty", "Quantity", "Item", "Service", "Duration"], expand_w=tw)
    table_regions_px = []
    if table_start:
        # If we found a table header, create a region from there down to 85% of page
        y_start = table_start[1]
        y_end = int(th * 0.88)
        if y_end > y_start + 50:
            table_regions_px.append([int(tw * 0.05), y_start, int(tw * 0.9), y_end - y_start])
    else:
        # Fallback to OpenCV line clustering
        _, binary = cv2.threshold(img, 180, 255, cv2.THRESH_BINARY_INV)
        h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (tw // 4, 1))
        h_lines = cv2.morphologyEx(binary, cv2.MORPH_OPEN, h_kernel)
        line_contours, _ = cv2.findContours(h_lines, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        yy = sorted([cv2.boundingRect(c)[1] for c in line_contours if cv2.boundingRect(c)[2] > tw * 0.35 and th * 0.15 < cv2.boundingRect(c)[1] < th * 0.88])
        if yy:
            sy, ey = yy[0], yy[-1]
            if ey - sy > 50:
                table_regions_px.append([int(tw * 0.05), sy - 20, int(tw * 0.9), ey - sy + 40])

    # 4. Result Mapping
    return {
        "columns": 1,
        "header_bbox": _to_pct(header_box, tw, th),
        "date_bbox": _to_pct(date_box, tw, th), # NEW: specifically for dates
        "footer_bbox": _to_pct([0, int(th*0.9), tw, int(th*0.1)], tw, th),
        "text_blocks": [], # simplified
        "table_regions": [_to_pct(reg, tw, th) for reg in table_regions_px[:3]],
        "summary": f"OCR-assisted alignment used for {filename}"
    }
