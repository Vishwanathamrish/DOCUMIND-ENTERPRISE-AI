"""
ocr/ocr_service.py
───────────────────
Unified, production-ready OCR service with coordinate support.
"""
from __future__ import annotations

import hashlib
import io
import os
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple

import numpy as np
import pytesseract
from PIL import Image, ImageSequence

from ocr.image_preprocessing import prepare_image
from utils.config import get_settings
from utils.logger import logger

_settings = get_settings()

if os.path.isfile(_settings.tesseract_path):
    pytesseract.pytesseract.tesseract_cmd = _settings.tesseract_path

_LANG           = "eng+ara"
_CONFIG_PSM6    = "--oem 3 --psm 6"
_CONFIG_PSM4    = "--oem 3 --psm 4"
_CONF_THRESHOLD = 70.0

_OCR_CACHE: Dict[str, Dict[str, Any]] = {}

def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def _image_to_bytes(image: Image.Image, format: str = "PNG") -> bytes:
    buf = io.BytesIO()
    image.save(buf, format=format)
    return buf.getvalue()

def _ocr_image(
    image: Image.Image,
    lang: str = _LANG,
    config: str = _CONFIG_PSM6,
    apply_preprocessing: bool = True,
) -> Tuple[str, float, List[Dict[str, Any]]]:
    """
    Run Tesseract and return (text, confidence, ocr_data).
    """
    if apply_preprocessing:
        try:
            processed = prepare_image(image, min_width=1200, apply_osd=True, tesseract_cmd=_settings.tesseract_path)
        except Exception as exc:
            logger.warning("Preprocessing failed: %s", exc)
            processed = image
    else:
        processed = image

    # Get both string and data
    text = pytesseract.image_to_string(processed, lang=lang, config=config)
    data = pytesseract.image_to_data(processed, lang=lang, config=config, output_type=pytesseract.Output.DICT)
    
    ocr_words = []
    confs = []
    for i in range(len(data["text"])):
        c = int(data["conf"][i])
        if c >= 0:
            confs.append(c)
            word = data["text"][i].strip()
            if word:
                ocr_words.append({
                    "text": word,
                    "left": int(data["left"][i]),
                    "top": int(data["top"][i]),
                    "width": int(data["width"][i]),
                    "height": int(data["height"][i]),
                })
    
    mean_conf = (sum(confs) / len(confs)) if confs else 0.0
    # Manual round to 2 decimals for lint
    conf_final = float(int(mean_conf * 100.0)) / 100.0
    return text.strip(), conf_final, ocr_words

def _ocr_with_retry(image: Image.Image) -> Tuple[str, float, List[Dict[str, Any]]]:
    text6, conf6, data6 = _ocr_image(image, config=_CONFIG_PSM6)
    if conf6 >= _CONF_THRESHOLD:
        return text6, conf6, data6
    
    text4, conf4, data4 = _ocr_image(image, config=_CONFIG_PSM4, apply_preprocessing=False)
    return (text4, conf4, data4) if conf4 > conf6 else (text6, conf6, data6)

def _pdf_to_images(pdf_bytes: bytes) -> List[Image.Image]:
    """Convert PDF bytes to a list of PIL Images using Poppler."""
    try:
        from pdf2image import convert_from_bytes
        # Explicitly pass Poppler path from settings for Windows compatibility
        return convert_from_bytes(
            pdf_bytes, 
            dpi=200, 
            poppler_path=_settings.poppler_path if os.name == "nt" else None
        )
    except Exception as exc:
        logger.error("pdf2image conversion failed: %s", exc)
        return []

def _extract_digital_text_from_pdf(pdf_bytes: bytes) -> str:
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        return "\n".join([p.extract_text() or "" for p in reader.pages]).strip()
    except:
        return ""

def _process_pdf(pdf_bytes: bytes) -> Dict[str, Any]:
    images = _pdf_to_images(pdf_bytes)

    digital_text = _extract_digital_text_from_pdf(pdf_bytes)
    if digital_text and len(digital_text) > 200:
        return {
            "raw_text": digital_text,
            "confidence": 1.0,
            "pages": len(images) or 1,
            "ocr_data": [], 
            "preview_img_bytes": _image_to_bytes(images[0]) if images else None
        }

    pages_text, page_confs, ocr_data = [], [], []
    for img in images:
        t, c, d = _ocr_with_retry(img)
        pages_text.append(t)
        page_confs.append(c)
        ocr_data.append(d)

    raw_text = "\n\n--- Page Break ---\n\n".join(pages_text)
    mean_conf = (sum(page_confs) / len(page_confs) / 100.0) if page_confs else 0.0
    return {
        "raw_text": raw_text,
        "confidence": float(int(mean_conf * 1000.0)) / 1000.0,
        "pages": len(images),
        "ocr_data": ocr_data,
        "preview_img_bytes": _image_to_bytes(images[0]) if images else None
    }

def _process_image(image_bytes: bytes) -> Dict[str, Any]:
    try:
        img = Image.open(io.BytesIO(image_bytes))
    except Exception as e:
        raise ValueError(f"Invalid image: {e}")

    pages_text, page_confs, ocr_data = [], [], []
    for frame in ImageSequence.Iterator(img):
        t, c, d = _ocr_with_retry(frame.convert("RGB"))
        pages_text.append(t)
        page_confs.append(c)
        ocr_data.append(d)

    raw_text = "\n\n--- Page Break ---\n\n".join(pages_text)
    mean_conf = (sum(page_confs) / len(page_confs) / 100.0) if page_confs else 0.0
    
    img.seek(0)
    return {
        "raw_text": raw_text,
        "confidence": float(int(mean_conf * 1000.0)) / 1000.0,
        "pages": len(pages_text),
        "ocr_data": ocr_data,
        "preview_img_bytes": _image_to_bytes(img.convert("RGB"))
    }

def extract_text(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    cache_key = _sha256(file_bytes)
    if cache_key in _OCR_CACHE:
        return _OCR_CACHE[cache_key]

    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        res = _process_pdf(file_bytes)
    elif ext in {".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp", ".webp"}:
        res = _process_image(file_bytes)
    else:
        raise ValueError(f"Unsupported type: {ext}")

    _OCR_CACHE[cache_key] = res
    return res

def clear_cache() -> None:
    _OCR_CACHE.clear()
