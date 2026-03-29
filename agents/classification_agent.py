"""
agents/classification_agent.py
────────────────────────────────
ClassificationAgent — uses the existing Groq-powered extractor to
classify the document type and primary language.
"""
from __future__ import annotations

from typing import Any

from agents.base_agent import BaseAgent
from app.services.extractor import classify_document
from utils.logger import logger
from utils.text_processor import clean_text


class ClassificationAgent(BaseAgent):
    """
    Responsibilities:
    - Clean raw OCR text.
    - Call Groq to classify document type and language.
    - Attach doc_type, language, and classification_confidence to context.
    """

    name = "ClassificationAgent"

    def _execute(self, payload: dict[str, Any]) -> dict[str, Any]:
        raw_text: str = payload["raw_text"]

        # ── Clean text ─────────────────────────────────────────────────────────
        cleaned = clean_text(raw_text)

        # ── Classify via Groq ──────────────────────────────────────────────────
        doc_type, language, confidence = classify_document(cleaned)

        logger.info(
            "[%s] type=%s lang=%s conf=%.2f",
            self.name, doc_type, language, confidence,
        )

        return {
            "clean_text": cleaned,
            "doc_type": doc_type,
            "language": language,
            "classification_confidence": confidence,
        }
