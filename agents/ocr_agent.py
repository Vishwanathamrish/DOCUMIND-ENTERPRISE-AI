"""
agents/ocr_agent.py
─────────────────────
OCRProcessingAgent — wraps the existing OCR engine and layout
detector to produce structured text with layout metadata.
"""
from __future__ import annotations

from typing import Any

from agents.base_agent import BaseAgent
from ocr.ocr_service import extract_text
from utils.logger import logger


class OCRProcessingAgent(BaseAgent):
    """
    Responsibilities:
    - Run Tesseract OCR (via existing ocr_service).
    - Attach raw text, page count, and OCR confidence to context.
    - Optionally run layout detection to extract bounding boxes.
    """

    name = "OCRProcessingAgent"

    def _execute(self, payload: dict[str, Any]) -> dict[str, Any]:
        content: bytes = payload["content"]
        filename: str = payload["filename"]

        # ── Run core OCR ────────────────────────────────────────────────────────
        ocr_result = extract_text(content, filename)
        raw_text = ocr_result["raw_text"]
        page_count = ocr_result["pages"]
        ocr_confidence = float(ocr_result["confidence"])

        logger.info(
            "[%s] OCR done: %d chars, %d page(s), confidence=%.2f",
            self.name, len(raw_text), page_count, ocr_confidence,
        )

        # ── Optional layout detection ───────────────────────────────────────────
        layout_info: dict = {}
        try:
            from ocr.layout_detector import detect_layout
            layout_info = detect_layout(content, filename)
            logger.info("[%s] Layout detection done: %s", self.name, layout_info.get("summary", ""))
        except Exception as exc:
            logger.warning("[%s] Layout detection skipped: %s", self.name, exc)

        # ── Save preview & raw text ─────────────────────────────────────────────
        doc_id = payload.get("document_id")
        if doc_id:
            self._save_assets(doc_id, ocr_result.get("preview_img_bytes"), raw_text)

        return {

            "raw_text": raw_text,
            "page_count": page_count,
            "ocr_confidence": ocr_confidence,
            "layout_info": layout_info,
            "preview_img_bytes": ocr_result.get("preview_img_bytes"),
        }

    def _save_assets(self, doc_id: str, img_bytes: bytes | None, text: str) -> None:
        from pathlib import Path
        from utils.config import get_settings
        _settings = get_settings()
        doc_dir = Path(_settings.upload_dir) / doc_id
        doc_dir.mkdir(parents=True, exist_ok=True)

        if img_bytes:
            with open(doc_dir / "preview.png", "wb") as f:
                f.write(img_bytes)
            logger.info("[OCRProcessingAgent] Preview image saved.")

        with open(doc_dir / "ocr_text.txt", "w", encoding="utf-8") as f:
            f.write(text)
        logger.info("[OCRProcessingAgent] Raw text saved for re-extraction.")

