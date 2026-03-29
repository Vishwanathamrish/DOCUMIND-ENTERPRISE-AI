"""
ocr/image_preprocessing.py
───────────────────────────
Production-grade OpenCV + Pillow image preprocessing pipeline.

Designed to normalise any uploaded image (JPG/PNG/TIFF/BMP/WEBP) to the
same quality level that pdf2image + 300-DPI conversion gives for PDFs.

Pipeline (in order):
  1. EXIF transpose               — fix smartphone rotation
  2. Upscale (INTER_CUBIC ×2)     — if width < 1200 px
  3. RGB → Grayscale              — remove color noise
  4. CLAHE equalisation           — adaptive contrast enhancement
  5. Gaussian denoise             — reduce high-frequency noise
  6. Adaptive thresholding        — binarise text
  7. Morphological opening        — remove salt-and-pepper specks
  8. Unsharp / sharpening mask    — crisp character edges
  9. Deskew                       — correct rotation
 10. OSD orientation correction   — 90/180/270° auto-rotate via Tesseract OSD

Public API
──────────
  prepare_image(pil_image)  → PIL.Image   (ready for Tesseract)
  correct_orientation(pil_image, tesseract_cmd) → PIL.Image
"""

from __future__ import annotations

import os
from typing import Optional

import cv2
import numpy as np
import pytesseract
from PIL import Image, ImageOps

from utils.logger import logger


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _to_cv2_gray(image: Image.Image) -> np.ndarray:
    """Convert a PIL image to an OpenCV uint8 grayscale array."""
    rgb = np.array(image.convert("RGB"), dtype=np.uint8)
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)


def _to_pil(gray_array: np.ndarray) -> Image.Image:
    """Convert an OpenCV grayscale array back to a PIL Image."""
    return Image.fromarray(gray_array)


# ─── Step 1: EXIF / orientation normalisation ─────────────────────────────────

def fix_exif_orientation(image: Image.Image) -> Image.Image:
    """
    Rotate the image according to its embedded EXIF orientation tag.
    Critical for smartphone photos that are stored rotated.
    """
    return ImageOps.exif_transpose(image)


# ─── Step 2: Resolution upscaling ────────────────────────────────────────────

def upscale_if_needed(image: Image.Image, min_width: int = 1200) -> Image.Image:
    """
    If the image width is below *min_width*, upscale by ×2 using LANCZOS
    (PIL) for the initial resize, then the CV2 INTER_CUBIC pass later in
    the pipeline sharpens further during adaptive thresholding.

    Tesseract works best at ~300 DPI (≄ 2480 px for A4 width).
    Upscaling to at least 1200 px ensures LSTM LSTM recognises characters.
    """
    w, h = image.size
    if w < min_width:
        scale = min_width / w
        new_size = (int(w * scale), int(h * scale))
        logger.info("Upscaling image %dx%d → %dx%d (min_width=%d)",
                    w, h, new_size[0], new_size[1], min_width)
        image = image.resize(new_size, Image.Resampling.LANCZOS)
    return image


def upscale_cv2(gray: np.ndarray, fx: float = 2.0, fy: float = 2.0) -> np.ndarray:
    """
    Upscale a grayscale OpenCV array using INTER_CUBIC for sub-pixel
    sharpness — required when source image is low resolution.
    Only applied when the width is below the threshold (caller decides).
    """
    return cv2.resize(gray, None, fx=fx, fy=fy, interpolation=cv2.INTER_CUBIC)


# ─── Step 3-4: Grayscale + CLAHE contrast enhancement ────────────────────────

def apply_clahe(gray: np.ndarray,
                clip_limit: float = 2.0,
                tile_grid: tuple[int, int] = (8, 8)) -> np.ndarray:
    """
    Contrast Limited Adaptive Histogram Equalization.
    Enhances text contrast locally without over-amplifying noise.
    clip_limit=2.0 is conservative; raise to 3.0 for very low-contrast docs.
    """
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid)
    return clahe.apply(gray)


# ─── Step 5: Gaussian denoising ──────────────────────────────────────────────

def gaussian_denoise(gray: np.ndarray, kernel: int = 3) -> np.ndarray:
    """
    Light Gaussian blur to smooth noise before thresholding.
    kernel=3 is the minimum effective size; kernel=5 for noisier scans.
    """
    return cv2.GaussianBlur(gray, (kernel, kernel), 0)


# ─── Step 6: Adaptive thresholding ───────────────────────────────────────────

def adaptive_threshold(blurred: np.ndarray,
                       block_size: int = 21,
                       c_constant: int = 11) -> np.ndarray:
    """
    Gaussian adaptive thresholding binarises the image locally.
    block_size must be odd. c_constant subtracts from the local mean.
    Handles uneven illumination (shadows, folds, worn pages).
    """
    return cv2.adaptiveThreshold(
        blurred,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        block_size,
        c_constant,
    )


# ─── Step 7: Morphological noise removal ─────────────────────────────────────

def remove_noise_morphological(binary: np.ndarray,
                                kernel_size: tuple[int, int] = (2, 2)) -> np.ndarray:
    """
    Morphological OPENING removes small isolated white blobs
    (salt-and-pepper noise) that confuse Tesseract's LSTM.
    """
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, kernel_size)
    return cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)


# ─── Step 8: Sharpening ───────────────────────────────────────────────────────

def sharpen(gray: np.ndarray) -> np.ndarray:
    """
    Unsharp mask sharpening — subtracts a blurred copy to enhance edges.
    Applied BEFORE thresholding for cleaner character outlines.
    """
    blurred = cv2.GaussianBlur(gray, (0, 0), sigmaX=3)
    sharpened = cv2.addWeighted(gray, 1.5, blurred, -0.5, 0)
    return sharpened


# ─── Step 9: Deskew ──────────────────────────────────────────────────────────

def deskew(binary: np.ndarray) -> np.ndarray:
    """
    Correct small rotational skew (< 45°) using the minimum bounding
    rectangle of foreground pixels.

    Only rotates when skew > 0.5° to avoid artefacts on clean images.
    """
    coords = np.column_stack(np.where(binary > 0))
    if coords.size == 0:
        return binary

    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle

    if abs(angle) < 0.5:
        return binary

    (h, w) = binary.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(
        binary, M, (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )
    logger.debug("Deskewed image by %.2f°", angle)
    return rotated


# ─── Step 10: OSD orientation correction ─────────────────────────────────────

def correct_orientation(image: Image.Image,
                         tesseract_cmd: Optional[str] = None) -> Image.Image:
    """
    Use Tesseract's Orientation and Script Detection (OSD) to detect and
    correct 90°/180°/270° rotations that deskew() cannot handle.

    Falls back to the original image if OSD fails (e.g., too little text).
    """
    if tesseract_cmd and os.path.isfile(tesseract_cmd):
        pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

    try:
        osd = pytesseract.image_to_osd(image, output_type=pytesseract.Output.DICT)
        rotation = osd.get("rotate", 0)
        if rotation and rotation != 0:
            logger.info("OSD detected rotation=%d° — correcting.", rotation)
            image = image.rotate(-rotation, expand=True)
    except Exception as exc:
        # OSD needs ≥ a few lines of text — silently skip for sparse images
        logger.debug("OSD orientation detection skipped: %s", exc)

    return image


# ─── Full pipeline ────────────────────────────────────────────────────────────

def prepare_image(
    image: Image.Image,
    min_width: int = 1200,
    apply_osd: bool = True,
    tesseract_cmd: Optional[str] = None,
) -> Image.Image:
    """
    Master preprocessing pipeline — converts any PIL Image into a
    high-quality binarised image ready for Tesseract OCR.

    Parameters
    ----------
    image       : Input PIL Image (any mode/size).
    min_width   : Upscale threshold in pixels (default 1200).
    apply_osd   : If True, run Tesseract OSD orientation correction.
    tesseract_cmd : Path to Tesseract binary (optional).

    Returns
    -------
    PIL.Image   : Preprocessed grayscale binarised image.
    """
    # 1. Fix EXIF rotation (smartphone photos stored sideways)
    image = fix_exif_orientation(image)

    # 2. OSD orientation correction (90°/180°/270° page rotations)
    if apply_osd:
        image = correct_orientation(image, tesseract_cmd)

    # 3. Upscale if below minimum width (PIL LANCZOS first for quality)
    original_width = image.size[0]
    image = upscale_if_needed(image, min_width=min_width)

    # 4. Sharpen BEFORE converting to grayscale (works on RGB edges)
    rgb_array = np.array(image.convert("RGB"), dtype=np.uint8)
    gray = cv2.cvtColor(rgb_array, cv2.COLOR_RGB2GRAY)

    # 5. Additional INTER_CUBIC upscale for very small originals
    if original_width < min_width:
        gray = upscale_cv2(gray, fx=2.0, fy=2.0)
        logger.debug("Applied INTER_CUBIC ×2 upscale (original width=%d)", original_width)

    # 6. CLAHE — adaptive contrast enhancement
    gray = apply_clahe(gray)

    # 7. Sharpen — enhance character edges
    gray = sharpen(gray)

    # 8. Gaussian denoise — smooth before threshold
    gray = gaussian_denoise(gray, kernel=3)

    # 9. Adaptive thresholding — binarise
    binary = adaptive_threshold(gray)

    # 10. Morphological noise removal
    binary = remove_noise_morphological(binary)

    # 11. Deskew — correct small rotational skew
    binary = deskew(binary)

    return _to_pil(binary)


def save_debug_image(image: Image.Image, tag: str = "debug") -> None:
    """Save preprocessed image to data/debug/ when DEBUG_OCR=true."""
    if os.getenv("DEBUG_OCR", "false").lower() != "true":
        return
    import time
    from pathlib import Path
    debug_dir = Path("data/debug")
    debug_dir.mkdir(parents=True, exist_ok=True)
    ts = int(time.time() * 1000)
    path = debug_dir / f"{tag}_{ts}.png"
    image.save(str(path))
    logger.info("OCR debug image saved: %s", path)
