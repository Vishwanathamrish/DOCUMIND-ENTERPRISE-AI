"""
ocr/ocr_engine.py
─────────────────
Advanced Computer Vision OCR pipeline:
  PDF  → images (pdf2image / poppler)  → Tesseract OCR → raw text
  Image (JPG/PNG/TIFF/etc.) → pre-processing (OpenCV) → Tesseract OCR → raw text

This module implements a high-fidelity Computer Vision pipeline designed for 
maximum accuracy on diverse document types and image qualities.
"""
import io
import os
import tempfile
from pathlib import Path

import cv2
import numpy as np
import pytesseract
from PIL import Image, ImageOps, ImageSequence

from utils.config import get_settings
from utils.logger import logger

_settings = get_settings()

# ─── Point pytesseract at the Tesseract binary ────────────────────────────────
if os.path.isfile(_settings.tesseract_path):
    pytesseract.pytesseract.tesseract_cmd = _settings.tesseract_path
else:
    logger.warning(
        "Tesseract binary not found at '%s'. "
        "Relying on PATH lookup.",
        _settings.tesseract_path,
    )

# Language string passed to Tesseract (English + Arabic)
_LANG = "eng+ara"

# Tesseract configuration: 
# OEM 3 = Default (LSTM)
# PSM 6 = Assume a single uniform block of text (optimized for structured document alignment)
_TESSERACT_CONFIG = "--oem 3 --psm 6"


# ─── Image pre-processing helpers ─────────────────────────────────────────────

def _deskew(image: np.ndarray) -> np.ndarray:
    """
    Correct the skew (rotation) of a document image using Hough Line Transform logic.
    """
    # Use bitwise_not if the background is light
    coords = np.column_stack(np.where(image > 0))
    if coords.size == 0:
        return image
        
    angle = cv2.minAreaRect(coords)[-1]
    
    # Correcting the angle format from minAreaRect
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle
        
    # Rotate only if skew is significant (> 0.5 degrees)
    if abs(angle) < 0.5:
        return image

    (h, w) = image.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    
    return rotated


def _preprocess_image(image: Image.Image) -> Image.Image:
    """
    Apply advanced Senior Computer Vision pre-processing to boost OCR accuracy:
    1. Grayscale & EXIF Orientation
    2. Resolution standardisation (Upscale to 2500px min_dim)
    3. CLAHE (Contrast Limited Adaptive Histogram Equalization)
    4. Gaussian Blur
    5. Adaptive Gaussian Thresholding
    6. Morphological Noise Removal (Opening)
    7. Skew Correction
    """
    # ── Handle EXIF orientation (smartphone photos) ───────────────────────────
    image = ImageOps.exif_transpose(image)

    # ── Standardise Resolution (Upscale small images) ─────────────────────────
    # Aim for ~300 DPI density (Approx 2500px for A4/Letter width)
    min_dimension = 2500
    width, height = image.size
    if width < min_dimension or height < min_dimension:
        ratio = max(min_dimension / width, min_dimension / height)
        new_size = (int(width * ratio), int(height * ratio))
        logger.info("Upscaling image from %dx%d to %dx%d for high-fidelity OCR.", 
                    width, height, new_size[0], new_size[1])
        image = image.resize(new_size, Image.Resampling.LANCZOS)

    # PIL → OpenCV (BGR to Gray)
    img_array = np.array(image.convert("RGB"))
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)

    # ── Illumination Normalisation (CLAHE) ────────────────────────────────────
    # Contrast Limited Adaptive Histogram Equalization prevents over-amplification 
    # of noise while bringing out text in dimly lit or shadow-heavy images.
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    equalized = clahe.apply(gray)

    # ── Noise Reduction (Gaussian Blur) ───────────────────────────────────────
    # Smooths sharp gradients to prevent broken character edges during thresholding.
    blurred = cv2.GaussianBlur(equalized, (3, 3), 0)

    # ── Adaptive Thresholding (Gaussian) ──────────────────────────────────────
    # Dynamically calculates threshold levels based on local pixel neighborhoods.
    # Gaussian weight prevents artifacts at shadow boundaries.
    binary = cv2.adaptiveThreshold(
        blurred, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        21,   # blockSize
        11    # C (Tuned for contrast-rich blocks)
    )

    # ── Morphological Noise Removal (Opening) ─────────────────────────────────
    # Filter out small disconnected components (salt-and-pepper noise).
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    noise_removed = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)

    # ── Skew Correction ───────────────────────────────────────────────────────
    # Rotate the image to ensure text lines are perfectly horizontal.
    processed = _deskew(noise_removed)

    # ── Debug Mode: Save preprocessed image ───────────────────────────────────
    if os.getenv("DEBUG_OCR", "false").lower() == "true":
        debug_dir = Path("data/debug")
        debug_dir.mkdir(parents=True, exist_ok=True)
        import time
        ts = int(time.time() * 1000)
        cv2.imwrite(str(debug_dir / f"ocr_debug_{ts}.png"), processed)
        logger.info("OCR debug image saved to %s", debug_dir)

    # OpenCV → PIL
    return Image.fromarray(processed)


# ─── Validate Poppler installation (Windows) ─────────────────────────────────
_poppler_path: str | None = None
if os.name == "nt":  # Windows
    if os.path.isdir(_settings.poppler_path):
        _poppler_path = _settings.poppler_path
        logger.info("Poppler found at '%s'.", _poppler_path)
    else:
        logger.warning(
            "Poppler directory not found at '%s'. "
            "PDF processing will fail unless poppler is on PATH.\n"
            "  → Download from: https://github.com/oschwartz10612/poppler-windows/releases\n"
            "  → Set POPPLER_PATH in .env to the 'bin' folder.",
            _settings.poppler_path,
        )


# ─── PDF helpers ──────────────────────────────────────────────────────────────

def _extract_digital_text(pdf_bytes: bytes) -> str:
    """Try to extract text directly from a digital PDF using pypdf."""
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        return text.strip()
    except Exception as exc:
        logger.warning("Digital PDF text extraction failed: %s", exc)
        return ""


def _pdf_to_images(pdf_bytes: bytes, dpi: int = 300) -> list[Image.Image]:
    """Convert a PDF to a list of PIL Images using pdf2image."""
    try:
        from pdf2image import convert_from_bytes
        return convert_from_bytes(
            pdf_bytes,
            dpi=dpi,
            poppler_path=_poppler_path,
        )
    except Exception as exc:
        logger.exception("Failed to convert PDF to images.")
        raise RuntimeError(f"PDF conversion failed: {exc}") from exc


# ─── Core OCR function ────────────────────────────────────────────────────────

def _ocr_image(image: Image.Image) -> str:
    """
    Run Tesseract OCR on a PIL Image with automatic fallback if binarisation
    was too aggressive.
    """
    # 1. Primary Pass (Advanced Preprocessing)
    processed = _preprocess_image(image)
    text: str = pytesseract.image_to_string(
        processed, lang=_LANG, config=_TESSERACT_CONFIG
    )

    # 2. Fallback Pass (Grayscale only)
    # catches edge cases where thresholding washed out critical gradients
    if len(text.strip()) < 50:
        logger.info("OCR Pass 1 yielded low results (%d chars). Running grayscale fallback...", len(text))
        image = ImageOps.exif_transpose(image)
        fallback_processed = ImageOps.grayscale(image)
        fallback_text = pytesseract.image_to_string(
            fallback_processed, lang=_LANG, config=_TESSERACT_CONFIG
        )
        if len(fallback_text) > len(text):
            logger.info("Fallback OCR successful (+%d chars).", len(fallback_text) - len(text))
            return fallback_text
            
    return text


# ─── Public API ───────────────────────────────────────────────────────────────

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Full PDF pipeline: Digital Extraction → OCR fallback."""
    digital_text = _extract_digital_text(pdf_bytes)
    if digital_text and len(digital_text.strip()) > 200:
        logger.info("Direct PDF extraction successful.")
        return digital_text

    logger.info("Falling back to OCR for PDF...")
    images = _pdf_to_images(pdf_bytes)
    pages = [_ocr_image(img) for img in images]
    return "\n\n--- Page Break ---\n\n".join(pages)


def extract_text_from_image(image_bytes: bytes) -> str:
    """Full image pipeline (handles multi-page TIFF/WEBP and transparency)."""
    try:
        image = Image.open(io.BytesIO(image_bytes))
    except Exception as exc:
        raise ValueError(f"Invalid image file: {exc}") from exc

    pages: list[str] = []
    for idx, frame in enumerate(ImageSequence.Iterator(image), start=1):
        # Flatten transparency (RGBA -> RGB with white background)
        if frame.mode in ("RGBA", "LA") or (frame.mode == "P" and "transparency" in frame.info):
            frame = frame.convert("RGBA")
            new_img = Image.new("RGBA", frame.size, "WHITE")
            new_img.paste(frame, (0, 0), frame)
            frame = new_img.convert("RGB")
        else:
            frame = frame.convert("RGB")

        logger.info("OCR processing page %d …", idx)
        pages.append(_ocr_image(frame))

    return "\n\n--- Page Break ---\n\n".join(pages)


def extract_text(file_bytes: bytes, filename: str) -> str:
    """Main entry point: Dispatches by file extension."""
    ext = Path(filename).suffix.lower()
    logger.info("Starting OCR for '%s' (type=%s).", filename, ext)

    if ext == ".pdf":
        return extract_text_from_pdf(file_bytes)
    elif ext in {".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp", ".webp"}:
        return extract_text_from_image(file_bytes)
    else:
        raise ValueError(
            f"Unsupported file type '{ext}'. "
            "Supported: PDF, JPG, JPEG, PNG, TIFF, TIF, BMP, WEBP."
        )
